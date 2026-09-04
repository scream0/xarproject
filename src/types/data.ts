// src/types/data.ts

export type ProductVariant = {
  size: string;
  price: number;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string;
  variants?: ProductVariant[]; // Variants can be optional
  created_at: string;
  total_sold?: number;
  price?: number; // Price can be optional, especially if variants exist
};

export type SalesMap = {
  [productId: string]: number;
};

export type Review = {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type InitialDataType = {
  products: Product[];
  totalProducts: number;
  salesMap: SalesMap;
  reviews: Review[];
};
