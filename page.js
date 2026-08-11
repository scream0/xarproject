'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

function OrderDetailPage({ params }) {
  const orderId = params.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, startSyncTransition] = useTransition();

  // Fungsi untuk membersihkan query params dari URL
  const cleanupUrl = () => {
    router.replace(pathname, { scroll: false });
  };

  // Fungsi untuk sinkronisasi status
  const syncStatus = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/sync-status`, {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to sync status');
      }
      if (result.statusChanged) {
        setSyncMessage(`Status pesanan berhasil diperbarui menjadi: ${result.newStatus}`);
        // Muat ulang data order jika status berubah
        fetchOrder(); 
      }
    } catch (err) {
      console.error('Sync error:', err);
      // Tidak menampilkan error sync ke user agar tidak membingungkan
    }
  };

  // Fungsi untuk mengambil data order
  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/orders/${orderId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to fetch order details');
      }
      const data = await response.json();
      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const transactionStatus = searchParams.get('transaction_status');

    // Jika ada parameter `transaction_status` di URL (dari redirect Midtrans)
    if (transactionStatus) {
      startSyncTransition(async () => {
        await syncStatus();
        cleanupUrl(); // Bersihkan URL setelah sinkronisasi
      });
    }

    // Selalu ambil data order saat komponen dimuat
    fetchOrder();

  }, [orderId]); // Hanya dijalankan sekali saat orderId berubah

  if (loading) return <div>Loading order details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!order) return <div>Order not found.</div>;

  return (
    <div>
      <h1>Order Details #{order.id.substring(0, 8)}</h1>
      {syncMessage && <div style={{ color: 'green', marginBottom: '1rem' }}>{syncMessage}</div>}
      <p><strong>Status:</strong> {order.status}</p>
      <p><strong>Total Amount:</strong> {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(order.amount)}</p>
      <p><strong>Customer:</strong> {order.customer_name}</p>
      
      <h2>Items</h2>
      <ul>
        {order.order_items.map(item => (
          <li key={item.id}>
            {item.product_name} ({item.variant_name}) - {item.quantity} x {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}
          </li>
        ))}
      </ul>

      {/* Tampilkan detail lainnya sesuai kebutuhan */}
    </div>
  );
}

export default OrderDetailPage;