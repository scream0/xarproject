// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./PromoManagement.module.css";
import config from "@/data/ui/operationConfig.json";
import { Ticket, Percent, Truck, Plus, Trash2, Calendar, Scissors } from "lucide-react";

export default function PromoManagement() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [voucherForm, setVoucherForm] = useState({
    code: "", 
    title: "", 
    type: "percentage", 
    discount_amount: 0, 
    min_purchase: 0, 
    valid_until: "", 
    usage_limit: 1
  });

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = await getSupabaseToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const vouchersRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers", { headers });
        if (vouchersRes.ok) {
          const vData = (vouchersRes.headers?.get("content-type")?.includes("application/json") ? await vouchersRes.json() : {});
          setVouchers(vData.vouchers || []);
        }
      } catch (error) {
        console.error("Error loading vouchers:", error);
        toast.error("Gagal memuat data voucher.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSaveVoucher = async () => {
    if (!voucherForm.code || !voucherForm.title || !voucherForm.discount_amount) {
      toast.error("Harap lengkapi kode, judul, dan jumlah diskon.");
      return;
    }
    
    try {
      const token = await getSupabaseToken();
      let validUntilIso = null;
      if (voucherForm.valid_until) {
        const [year, month, day] = voucherForm.valid_until.split("-").map(Number);
        if (year && month && day) {
          const d = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
          validUntilIso = d.toISOString();
        } else {
          const d = new Date(voucherForm.valid_until);
          d.setHours(23, 59, 59, 999);
          validUntilIso = d.toISOString();
        }
      }

      const payload = {
        ...voucherForm,
        discount_amount: Number(voucherForm.discount_amount) || 0,
        min_purchase: Number(voucherForm.min_purchase) || 0,
        usage_limit: Number(voucherForm.usage_limit) || 1,
        valid_until: validUntilIso,
      };

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify(payload),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan voucher");
      
      toast.success("Voucher berhasil disimpan!");
      setVoucherForm({ code: "", title: "", type: "percentage", discount_amount: 0, min_purchase: 0, valid_until: "", usage_limit: 1 });
      
      const updatedRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers", { headers: { Authorization: `Bearer ${token}` } });
      const updated = (updatedRes.headers?.get("content-type")?.includes("application/json") ? await updatedRes.json() : {});
      setVouchers(updated.vouchers || []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteVoucher = async (id: any) => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/vouchers?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal menghapus voucher");

      setVouchers(vouchers.filter(v => v.id !== id));
      toast.success("Voucher berhasil dihapus");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus");
    }
  };

  const formatRupiah = (val: any) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

  if (loading) return <div className={styles.loadingState}><div className={styles.spinner} /><span>Memuat data...</span></div>;

  const activeCount = vouchers.length;
  
  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroSubtitle}>{config.hero.subtitle}</p>
          <h2 className={styles.heroTitle}>{config.hero.description}</h2>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Voucher Aktif</span>
            <span className={styles.statValue}>{activeCount}</span>
          </div>
        </div>
      </header>

      <div className={styles.mainGrid}>
        <section className={styles.createSection}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>Buat Promo Baru</h3>
              <p>Tambahkan voucher untuk menarik pelanggan</p>
            </div>
            
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label>Kode Voucher</label>
                <div className={styles.inputWrapper}>
                  <Scissors className={styles.inputIcon} size={16} />
                  <input placeholder="Contoh: MERDEKA99" value={voucherForm.code} onChange={e => setVoucherForm({...voucherForm, code: e.target.value.toUpperCase()})} />
                </div>
              </div>
              
              <div className={styles.inputGroup}>
                <label>Nama / Judul Promo</label>
                <input placeholder="Diskon Spesial Kemerdekaan" value={voucherForm.title} onChange={e => setVoucherForm({...voucherForm, title: e.target.value})} />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Tipe Diskon</label>
                  <select value={voucherForm.type} onChange={e => setVoucherForm({...voucherForm, type: e.target.value})}>
                    <option value="percentage">Diskon Persentase (%)</option>
                    <option value="fixed">Diskon Rupiah</option>
                    <option value="shipping">Gratis Ongkir</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Jumlah / Nilai</label>
                  <input type="number" placeholder="Cth: 10 atau 50000" value={voucherForm.discount_amount} onChange={e => setVoucherForm({...voucherForm, discount_amount: Number(e.target.value)})} />
                </div>
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Minimal Belanja</label>
                  <input type="number" placeholder="Rp 0" value={voucherForm.min_purchase} onChange={e => setVoucherForm({...voucherForm, min_purchase: Number(e.target.value)})} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Batas Waktu</label>
                  <div className={styles.inputWrapper}>
                    <Calendar className={styles.inputIcon} size={16} />
                    <input type="date" value={voucherForm.valid_until} onChange={e => setVoucherForm({...voucherForm, valid_until: e.target.value})} />
                  </div>
                </div>
              </div>

              <button className={styles.saveButton} onClick={handleSaveVoucher}>
                <Plus size={18} /> Simpan Voucher
              </button>
            </div>
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeader}>
            <h3>Daftar Voucher</h3>
            <p>Kelola voucher yang tersedia untuk pelanggan</p>
          </div>
          
          <div className={styles.voucherGrid}>
            {vouchers.map(v => (
              <div className={styles.voucherCard} key={v.id}>
                <div className={styles.voucherIcon}>
                  {v.type === "shipping" ? <Truck size={24} /> : v.type === "percentage" ? <Percent size={24} /> : <Ticket size={24} />}
                </div>
                <div className={styles.voucherContent}>
                  <div className={styles.voucherTop}>
                    <span className={styles.voucherCode}>{v.code}</span>
                    <button className={styles.deleteBtn} onClick={() => handleDeleteVoucher(v.id)} title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h4 className={styles.voucherTitle}>{v.title}</h4>
                  <p className={styles.voucherDetail}>
                    <strong>{v.type === "percentage" ? `${v.discount_amount}%` : formatRupiah(v.discount_amount)}</strong> Off
                    {v.min_purchase > 0 && <span> · Min. belanja {formatRupiah(v.min_purchase)}</span>}
                  </p>
                  {v.valid_until && (
                    <div className={styles.voucherExpiry}>
                      <Calendar size={12} /> Exp: {new Date(v.valid_until).toLocaleDateString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {!vouchers.length && (
              <div className={styles.emptyState}>
                <Ticket size={48} className={styles.emptyIcon} />
                <h4>Belum Ada Voucher</h4>
                <p>Buat voucher diskon pertamamu untuk menarik pelanggan!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}