package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// OrderAutomationResult contains the statistics of an automation run
type OrderAutomationResult struct {
	AutoCancelledCount    int      `json:"auto_cancelled_count"`
	AutoCompleteCount     int      `json:"auto_completed_count"`
	AutoCleanedProofsCount int     `json:"auto_cleaned_proofs_count"`
	CancelledOrderIDs     []string `json:"cancelled_order_ids"`
	CompletedOrderIDs     []string `json:"completed_order_ids"`
	ProcessedAt           string   `json:"processed_at"`
}

// RunOrderAutomation processes auto-cancel, auto-complete, and payment proof cleanup
func RunOrderAutomation(db *sql.DB) (*OrderAutomationResult, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection is nil")
	}

	result := &OrderAutomationResult{
		CancelledOrderIDs: make([]string, 0),
		CompletedOrderIDs: make([]string, 0),
		ProcessedAt:       time.Now().Format(time.RFC3339),
	}

	now := time.Now()

	// =========================================================================
	// 1. AUTO-CANCEL: Orders with pending/unpaid status older than 24 hours
	// =========================================================================
	cancelQuery := `
		SELECT id::text, order_number, COALESCE(items::text, '[]'), COALESCE(status_history::text, '[]'), COALESCE(shipping_detail->>'payment_proof_url', '')
		FROM orders
		WHERE status IN ('pending', 'unpaid')
		  AND created_at < NOW() - INTERVAL '24 hours'
	`
	cancelRows, err := db.Query(cancelQuery)
	if err == nil {
		type orderToCancel struct {
			id              string
			orderNumber     string
			itemsJSON       string
			historyJSON     string
			paymentProofURL string
		}
		var ordersToCancel []orderToCancel
		for cancelRows.Next() {
			var o orderToCancel
			if err := cancelRows.Scan(&o.id, &o.orderNumber, &o.itemsJSON, &o.historyJSON, &o.paymentProofURL); err == nil {
				ordersToCancel = append(ordersToCancel, o)
			}
		}
		cancelRows.Close()

		for _, o := range ordersToCancel {
			// A. Parse & append status history
			var history []map[string]interface{}
			_ = json.Unmarshal([]byte(o.historyJSON), &history)
			history = append(history, map[string]interface{}{
				"status":      "cancelled",
				"status_to":   "cancelled",
				"notes":       "Dibatalkan otomatis oleh sistem (melebihi batas waktu pembayaran 24 jam)",
				"timestamp":   now.Format(time.RFC3339),
				"created_at":  now.Format(time.RFC3339),
				"actor":       "system",
				"actor_label": "Sistem Otomatis",
			})
			newHistoryJSON, _ := json.Marshal(history)

			// B. Update order status
			_, updateErr := db.Exec(`
				UPDATE orders 
				SET status = 'cancelled', status_history = $1::jsonb, updated_at = NOW()
				WHERE id::text = $2
			`, string(newHistoryJSON), o.id)

			if updateErr == nil {
				result.AutoCancelledCount++
				result.CancelledOrderIDs = append(result.CancelledOrderIDs, o.id)

				// C. Delete payment proof from Cloudinary if existed
				if o.paymentProofURL != "" {
					go DeleteCloudinaryImage(o.paymentProofURL)
				}

				// D. Release any locked vouchers
				_, _ = db.Exec(`
					UPDATE user_vouchers 
					SET used_at = NULL, order_id = NULL 
					WHERE order_id = $1 OR order_id = $2
				`, o.id, o.orderNumber)

				// E. Restore product variant stocks if present
				var items []struct {
					ProductID string  `json:"productId"`
					ID        string  `json:"id"`
					Size      string  `json:"size"`
					Quantity  float64 `json:"quantity"`
				}
				if err := json.Unmarshal([]byte(o.itemsJSON), &items); err == nil {
					for _, it := range items {
						pID := it.ProductID
						if pID == "" {
							pID = it.ID
						}
						qty := int(it.Quantity)
						if qty <= 0 {
							qty = 1
						}
						if pID != "" {
							if it.Size != "" {
								_, _ = db.Exec(`
									UPDATE product_variants 
									SET stock = stock + $1 
									WHERE product_id::text = $2 AND size = $3
								`, qty, pID, it.Size)
							}
						}
					}
				}
			}
		}
	} else {
		log.Printf("[Order Automation Error - Cancel]: %v", err)
	}

	// =========================================================================
	// 2. AUTO-COMPLETE: Orders with shipped/delivered status older than 14 days
	// =========================================================================
	completeQuery := `
		SELECT id::text, order_number, COALESCE(status_history::text, '[]')
		FROM orders
		WHERE status IN ('shipped', 'delivered')
		  AND updated_at < NOW() - INTERVAL '14 days'
	`
	completeRows, err := db.Query(completeQuery)
	if err == nil {
		type orderToComplete struct {
			id          string
			orderNumber string
			historyJSON string
		}
		var ordersToComplete []orderToComplete
		for completeRows.Next() {
			var o orderToComplete
			if err := completeRows.Scan(&o.id, &o.orderNumber, &o.historyJSON); err == nil {
				ordersToComplete = append(ordersToComplete, o)
			}
		}
		completeRows.Close()

		for _, o := range ordersToComplete {
			var history []map[string]interface{}
			_ = json.Unmarshal([]byte(o.historyJSON), &history)
			history = append(history, map[string]interface{}{
				"status":    "completed",
				"notes":     "Pesanan otomatis diselesaikan oleh sistem (melebihi batas waktu konfirmasi 14 hari sejak pengiriman)",
				"timestamp": now.Format(time.RFC3339),
				"actor":     "SYSTEM_AUTO_COMPLETE",
			})
			newHistoryJSON, _ := json.Marshal(history)

			_, updateErr := db.Exec(`
				UPDATE orders 
				SET status = 'completed', status_history = $1::jsonb, updated_at = NOW()
				WHERE id::text = $2
			`, string(newHistoryJSON), o.id)

			if updateErr == nil {
				result.AutoCompleteCount++
				result.CompletedOrderIDs = append(result.CompletedOrderIDs, o.id)
			}
		}
	} else {
		log.Printf("[Order Automation Error - Complete]: %v", err)
	}

	// =========================================================================
	// 3. AUTO-CLEAN: Payment Proofs for Completed Orders older than 30 days
	// =========================================================================
	proofCleanQuery := `
		SELECT id::text, COALESCE(shipping_detail->>'payment_proof_url', '')
		FROM orders
		WHERE status = 'completed'
		  AND updated_at < NOW() - INTERVAL '30 days'
		  AND shipping_detail->>'payment_proof_url' IS NOT NULL
		  AND shipping_detail->>'payment_proof_url' != ''
	`
	proofRows, err := db.Query(proofCleanQuery)
	if err == nil {
		type proofToClean struct {
			id  string
			url string
		}
		var proofsToClean []proofToClean
		for proofRows.Next() {
			var p proofToClean
			if err := proofRows.Scan(&p.id, &p.url); err == nil && p.url != "" {
				proofsToClean = append(proofsToClean, p)
			}
		}
		proofRows.Close()

		for _, p := range proofsToClean {
			// A. Delete image from Cloudinary
			go DeleteCloudinaryImage(p.url)

			// B. Remove payment_proof_url key from shipping_detail in db
			_, updateErr := db.Exec(`
				UPDATE orders 
				SET shipping_detail = shipping_detail - 'payment_proof_url', updated_at = NOW()
				WHERE id::text = $1
			`, p.id)
			if updateErr == nil {
				result.AutoCleanedProofsCount++
			}
		}
	} else {
		log.Printf("[Order Automation Error - Proof Clean]: %v", err)
	}

	if result.AutoCancelledCount > 0 || result.AutoCompleteCount > 0 || result.AutoCleanedProofsCount > 0 {
		log.Printf("[Order Automation] Processed: %d cancelled, %d completed, %d payment proofs cleaned (>30d)",
			result.AutoCancelledCount, result.AutoCompleteCount, result.AutoCleanedProofsCount)
	}

	return result, nil
}

// StartOrderAutomationWorker launches a recurring background ticker every 15 minutes
func StartOrderAutomationWorker(db *sql.DB) {
	if db == nil {
		return
	}

	// Run once immediately on server startup
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Order Automation Worker Recovered]: %v", r)
			}
		}()
		time.Sleep(3 * time.Second) // wait for database pool to stabilize
		_, _ = RunOrderAutomation(db)
	}()

	// Recurring timer every 15 minutes
	ticker := time.NewTicker(15 * time.Minute)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Order Automation Worker Recovered]: %v", r)
			}
		}()
		for range ticker.C {
			_, _ = RunOrderAutomation(db)
		}
	}()
	log.Printf("🤖 Order Automation Worker started (Interval: 15 minutes)")
}
