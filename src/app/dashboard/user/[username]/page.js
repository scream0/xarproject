import ProfileSection from "@/components/Dashboard/User/Profil/ProfileSection";

export default function UserDashboardPage({ params }) {
  const { username } = params; // Mendapatkan username dari props

  return (
    <div>
      {/* Anda bisa memakai username tersebut atau langsung merender ProfileSection */}
      <ProfileSection username={username} />
    </div>
  );
}
