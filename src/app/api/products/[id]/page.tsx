"use client";

import { useState, useEffect, use } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import styles from './ProductDetail.module.css';

interface Variant {
  size: string;
  price: number;
  stock: number;
  stok?: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  image_url: string;
  variants: Variant[];
  category: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    if (!id || id === 'undefined') return;

    setLoading(true);
    fetch(`/api/products?id=${id}`)
      .then(async res => {
        if (res.status === 404) {
          setIsNotFound(true);
          throw new Error('Produk tidak ditemukan.');
        }
        if (!res.ok) {
          throw new Error(`Gagal memuat detail produk (Status: ${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        const productData = Array.isArray(data.data) ? data.data[0] : data.data;

        if (data.success && productData) {
          setProduct(productData);
        } else {
          setIsNotFound(true);
          throw new Error('Produk tidak ditemukan.');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching product:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Memuat detail produk...</p>
      </div>
    );
  }

  if (isNotFound) {
    notFound();
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div style={{ color: 'red', padding: '20px', textAlign: 'center' }}>
          <h3>Terjadi Kesalahan</h3>
          <p>{error}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>ID Produk: {id}</p>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return null;
  }

  const firstVariant = product.variants?.[0];

  return (
    <div className={styles.container}>
      <div className={styles.imageWrapper}>
        <Image 
          src={product.image_url || '/placeholder.png'} 
          alt={product.name} 
          width={500} 
          height={500} 
          className={styles.productImage} 
        />
      </div>
      <div className={styles.detailsWrapper}>
        <h1 className={styles.productName}>{product.name}</h1>
        <span className={styles.productCategory}>{product.category}</span>
        <p className={styles.productDescription}>{product.description}</p>
        {firstVariant && (
          <div className={styles.price}>
            Rp {(firstVariant.price || 0).toLocaleString('id-ID')}
          </div>
        )}
        <div className={styles.variants}>
          <h3>Pilihan Ukuran:</h3>
          {product.variants?.map(variant => (
            <span key={variant.size} className={styles.variantTag}>
              {variant.size} - Stok: {variant.stock ?? variant.stok ?? 0}
            </span>
          ))}
        </div>
        <button className={styles.addToCartButton}>Tambah ke Keranjang</button>
      </div>
    </div>
  );
}