// @ts-nocheck
"use client";
import ProfileSection from "@/components/Dashboard/User/Profil/UserProfil";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Content() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username");
  return (
    <div>
      <ProfileSection username={username} />
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}
