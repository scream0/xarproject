
import { db } from "@/lib/firebaseAdmin";

export async function migrateAddresses() {
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();

  if (snapshot.empty) {
    console.log("No users found.");
    return;
  }

  const batch = db.batch();

  for (const userDoc of snapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    if (userData.addresses && Array.isArray(userData.addresses)) {
      console.log(`Migrating addresses for user ${userId}...`);
      const addressesToMigrate = userData.addresses;
      const newAddressesRef = db.collection("users").doc(userId).collection("addresses");

      addressesToMigrate.forEach((address) => {
        const newAddressDoc = newAddressesRef.doc();
        batch.set(newAddressDoc, {
          ...address,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Unset the old addresses array
      batch.update(userDoc.ref, { addresses: FieldValue.delete() });
    }
  }

  await batch.commit();
  console.log("Address migration completed.");
}
