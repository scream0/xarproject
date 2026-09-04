package whatsapp

import (
	"context"
	"fmt"
	"strings"

	"xar-backend-go/internal/config"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

var Client *whatsmeow.Client

// InitWhatsApp initializes the WhatsApp client using the existing Supabase Postgres DB
func InitWhatsApp() error {
	if config.DB == nil {
		return fmt.Errorf("database not initialized, cannot start WhatsApp store")
	}

	dbLog := waLog.Stdout("Database", "WARN", true)

	container := sqlstore.NewWithDB(config.DB, "postgres", dbLog)
	err := container.Upgrade(context.Background())
	if err != nil {
		return fmt.Errorf("failed to upgrade WhatsApp store: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get WhatsApp device store: %v", err)
	}

	clientLog := waLog.Stdout("WhatsApp", "INFO", true)
	Client = whatsmeow.NewClient(deviceStore, clientLog)

	if Client.Store.ID == nil {
		// No ID stored, new login
		qrChan, _ := Client.GetQRChannel(context.Background())
		err = Client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect WhatsApp client: %v", err)
		}
		
		fmt.Println("==================================================")
		fmt.Println("   SCAN QR CODE INI DI APLIKASI WHATSAPP KAMU")
		fmt.Println("==================================================")
		for evt := range qrChan {
			if evt.Event == "code" {
				q, _ := qrcode.New(evt.Code, qrcode.Low)
				art := q.ToSmallString(false)
				fmt.Println(art)
			} else {
				fmt.Println("WhatsApp Login event:", evt.Event)
			}
		}
	} else {
		// Already logged in, just connect
		err = Client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect WhatsApp client: %v", err)
		}
		fmt.Println("? WhatsApp Gateway (whatsmeow) terhubung!")
	}
	
	return nil
}

// SendMessage sends a text message to a specific phone number
func SendMessage(phone string, message string) error {
	if Client == nil || !Client.IsConnected() {
		return fmt.Errorf("whatsapp client not connected")
	}

	// Format phone number to JID
	phone = strings.ReplaceAll(phone, "+", "")
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if strings.HasPrefix(phone, "0") {
		phone = "62" + phone[1:]
	}

	targetJID := types.NewJID(phone, types.DefaultUserServer)

	msg := &waProto.Message{
		Conversation: proto.String(message),
	}

	_, err := Client.SendMessage(context.Background(), targetJID, msg)
	return err
}
