export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  avatar_url?: string;
  points?: number;
  created_at?: string;
}

export interface Variant {
  size: string;
  price: number;
  stock?: number;
  stok?: number;
  image_url?: string;
  imageUrl?: string;
  imagePublicId?: string;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price?: number;
  image_url?: string;
  imageUrl?: string;
  image_public_id?: string;
  variants: Variant[];
  status?: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  payment_status?: string;
  shipping_status?: string;
  created_at: string;
  items?: any[];
  shipping_address?: any;
}
