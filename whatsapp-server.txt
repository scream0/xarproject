const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
app.use(cors());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.payload?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Koneksi WhatsApp terputus, mencoba menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Gateway Berhasil Terhubung dan Siap Digunakan!');
        }
    });
}

// Endpoint lokal yang akan dipanggil oleh Next.js untuk mengirim pesan
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Nomor dan pesan wajib diisi.' });
        }

        if (!sock) {
            return res.status(500).json({ success: false, error: 'WhatsApp Gateway belum siap/terhubung.' });
        }

        // Format nomor target Baileys (contoh: 628xxxxxxxx@s.whatsapp.net)
        let formattedPhone = phone.replace(/\D/g, "");
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "62" + formattedPhone.slice(1);
        }
        const jid = `${formattedPhone}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: message });
        return res.json({ success: true, message: 'Pesan berhasil dikirim via Baileys.' });
    } catch (err) {
        console.error('Gagal kirim pesan:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp Server berjalan di http://localhost:${PORT}`);
    connectToWhatsApp();
});