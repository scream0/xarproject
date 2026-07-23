"use client";
import { useParams } from "next/navigation";
import ProfileSection from "@/components/Dashboard/ProfileSection"; // Sesuaikan jalur komponen Anda

export default function UserDashboardPage() {
  const params = useParams();
  const { username } = params; // Mendapatkan username dari URL

  return (
    <div>
      {/* Anda bisa memakai username tersebut atau langsung merender ProfileSection */}
      <ProfileSection />
    </div>
  );
}
