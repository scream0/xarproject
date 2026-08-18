import { Navbar } from "@/components/Navbar/Navbar";
import { Hero } from "@/components/Hero/Hero";
import { About } from "@/components/About/About";
import { Footer } from "@/components/Footer/Footer";
import dynamic from "next/dynamic";
import { getInitialProducts, getSalesData, getPublicReviews } from "@/lib/productService";
import type { InitialDataType } from '@/types/data';

// Dynamically import client-side and below-the-fold components
const HomePageClient = dynamic(() => import('./HomePageClient').then(mod => mod.HomePageClient), {
  loading: () => <p>Loading Products...</p> // Optional loading component
});

// This is now a React Server Component
export default async function Home() {
  // Fetch initial data on the server
  const productsData = await getInitialProducts();
  const salesData = await getSalesData();
  const reviewsData = await getPublicReviews();

  const initialData: InitialDataType = {
    products: productsData.products,
    totalProducts: productsData.total,
    salesMap: salesData,
    reviews: reviewsData,
  };

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />

        {/* HomePageClient will handle the interactive parts */}
        <HomePageClient initialData={initialData} />
        
      </main>
      <Footer />
    </>
  );
}