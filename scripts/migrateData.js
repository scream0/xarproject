// scripts/migrateData.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readFileSync, writeFileSync } from "fs";

// =================================================================
// 1. MIGRATE USERS & AUTH
// =================================================================
/**
 * Migrates a single user's profile data from Firestore to the Supabase 'users' table.
 * @param {string} firebaseUserId - The user's ID from Firebase.
 * @param {string} supabaseUserId - The user's new ID from Supabase Auth.
 * @param {object} db - The Firestore admin instance.
 * @param {object} supabaseAdmin - The Supabase admin client.
 */
async function migratePublicUser(firebaseUserId, supabaseUserId, db, supabaseAdmin) {
  console.log(`- Migrating public user profile for ${firebaseUserId}`);
  const userDoc = await db.collection("users").doc(firebaseUserId).get();

  if (!userDoc.exists) {
    console.log(`  - No public user record found for ${firebaseUserId}. Skipping.`);
    return;
  }

  const userData = userDoc.data();
  const { error } = await supabaseAdmin.from("users").upsert({
    id: supabaseUserId,
    role: userData.role || 'customer',
    total_spent: userData.total_spent || 0,
    created_at: userData.createdAt?.toDate() || new Date(),
    updated_at: userData.updatedAt?.toDate() || new Date(),
  });

  if (error) {
    console.error(`  - FAILED to migrate public user ${firebaseUserId}: ${error.message}`);
  } else {
    console.log(`  - SUCCESS for public user ${firebaseUserId}.`);
  }
}

/**
 * Migrates users from a Firebase Auth JSON export to Supabase Auth.
 * @param {string} jsonPath - Path to the users.json file exported from Firebase Auth.
 * @param {object} db - The Firestore admin instance.
 * @param {object} supabaseAdmin - The Supabase admin client.
 */
async function migrateAuthUsers(jsonPath, db, supabaseAdmin) {
  console.log("Starting Firebase Auth to Supabase Auth migration...");
  const usersFile = readFileSync(jsonPath, "utf8");
  const { users: firebaseUsers } = JSON.parse(usersFile);

  console.log(`Found ${firebaseUsers.length} users in the export file.`);

  // Filter for users with password hash (email/password auth)
  const usersToMigrate = firebaseUsers.filter(u => u.passwordHash);
  console.log(`${usersToMigrate.length} users have passwords and will be migrated.`);

  for (const user of usersToMigrate) {
    console.log(`Migrating user: ${user.email} (${user.localId})`);

    try {
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        id: user.localId,
        email: user.email,
        email_confirm: user.emailVerified || false,
        password_hash: user.passwordHash,
        password_salt: user.salt,
        // IMPORTANT: This assumes you used SCRYPT in Firebase Identity Platform
        password_hash_algorithm: 'scrypt', 
        created_at: new Date(parseInt(user.createdAt)).toISOString(),
      });

      if (error) {
        // Handle cases where user might already exist
        if (error.message.includes("already exists")) {
          console.log(`- User ${user.email} already exists in Supabase Auth. Skipping creation.`);
          // Still try to migrate their public profile
          await migratePublicUser(user.localId, user.localId, db, supabaseAdmin);
        } else {
          throw new Error(`Failed to create auth user ${user.email}: ${error.message}`);
        }
      } else {
        console.log(`- Auth user ${newUser.user.email} created successfully.`);
        // Now migrate their public data
        await migratePublicUser(user.localId, newUser.user.id, db, supabaseAdmin);
      }
    } catch (e) {
      console.error(`An unexpected error occurred for user ${user.email}:`, e);
    }
  }

  console.log("SUCCESS: Auth user migration process completed.");
}

/**
 * =================================================================
 * 3. MIGRATE STORE SETTINGS
 * =================================================================
 */
async function migrateStoreSettings(db, supabaseAdmin) {
  console.log("Starting store_settings migration...");

  // 1. Read from Firestore
  const mainConfigDoc = await db.collection("store_config").doc("main").get();
  const automationConfigDoc = await db.collection("store_config").doc("automation").get();

  if (!mainConfigDoc.exists) {
    console.log("No main config found in Firestore. Skipping.");
    return;
  }

  const mainConfig = mainConfigDoc.data();
  const automationConfig = automationConfigDoc.exists ? automationConfigDoc.data() : {};

  // 2. Prepare data for Supabase
  const supabaseConfig = {
    singleton_id: true,
    store_name: mainConfig.store_name,
    store_email: mainConfig.store_email,
    currency: mainConfig.currency,
    admin_locale: mainConfig.admin_locale,
    low_stock_threshold: mainConfig.low_stock_threshold,
    store_city_id: mainConfig.store_city_id,
    store_city_name: mainConfig.store_city_name,
    hero: mainConfig.hero,
    about: mainConfig.about,
    product: mainConfig.product,
    contact: mainConfig.contact,
    footer: mainConfig.footer,
    promo_banner_enabled: mainConfig.promo_banner_enabled,
    promo_banner_text: mainConfig.promo_banner_text,
    promo_discount_type: mainConfig.promo_discount_type,
    promo_discount_value: mainConfig.promo_discount_value,
    promo_start_date: mainConfig.promo_start_date?.toDate(),
    promo_end_date: mainConfig.promo_end_date?.toDate(),
    promo_code: mainConfig.promo_code,
    promo_destination: mainConfig.promo_destination,
    automation_rules: automationConfig.rules || [],
  };

  // 3. Upsert into Supabase
  console.log("Upserting store config into Supabase...");
  const { error } = await supabaseAdmin
    .from("store_config")
    .upsert(supabaseConfig, { onConflict: 'singleton_id' });

  if (error) {
    throw new Error(`Failed to upsert store config: ${error.message}`);
  }

  console.log("SUCCESS: Store settings migration completed.");
}

/**
 * =================================================================
 * 4. MIGRATE PRODUCTS
 * =================================================================
 */
async function migrateProducts(db, supabaseAdmin) {
  console.log("Starting products migration...");

  const productsRef = db.collection("products");
  const snapshot = await productsRef.get();

  if (snapshot.empty) {
    console.log("No products found in Firestore.");
    return;
  }

  console.log(`Found ${snapshot.size} products to migrate.`);

  const products = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Using batch upsert for efficiency
  const { error } = await supabaseAdmin
    .from("products")
    .upsert(products, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`);
  }

  console.log(`SUCCESS: ${products.length} products migrated.`);
}

/**
 * =================================================================
 * 5. MIGRATE REVIEWS
 * =================================================================
 */
async function migrateReviews(db, supabaseAdmin) {
  console.log("Starting reviews migration...");

  const reviewsRef = db.collection("reviews");
  const snapshot = await reviewsRef.get();

  if (snapshot.empty) {
    console.log("No reviews found in Firestore.");
    return;
  }

  console.log(`Found ${snapshot.size} reviews to migrate.`);

  const reviews = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      created_at: data.createdAt?.toDate(),
      updated_at: data.updatedAt?.toDate(),
    };
  });

  // Using batch upsert for efficiency
  const { error } = await supabaseAdmin
    .from("reviews")
    .upsert(reviews, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert reviews: ${error.message}`);
  }

  console.log(`SUCCESS: ${reviews.length} reviews migrated.`);
}

/**
 * =================================================================
 * 6. MIGRATE ORDERS AND ITEMS
 * =================================================================
 */
async function migrateOrdersAndItems(db, supabaseAdmin) {
  console.log("Starting orders and order_items migration...");

  const ordersRef = db.collection("orders");
  const snapshot = await ordersRef.get();

  if (snapshot.empty) {
    console.log("No orders found in Firestore.");
    return;
  }

  console.log(`Found ${snapshot.size} orders to migrate.`);

  for (const orderDoc of snapshot.docs) {
    const orderData = orderDoc.data();
    const orderId = orderDoc.id;
    console.log(`- Migrating order ${orderId}`);

    const { items, ...order } = orderData;

    // 1. Insert the main order
    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .upsert({
        id: orderId,
        ...order,
        created_at: order.createdAt?.toDate(),
        updated_at: order.updatedAt?.toDate(),
      }, { onConflict: 'id' });

    if (orderError) {
      console.error(`  - FAILED to migrate order ${orderId}: ${orderError.message}`);
      continue; // Skip to next order
    }

    // 2. Insert the order items
    if (items && Array.isArray(items)) {
      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.name,
        variant_name: item.size,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .upsert(orderItems);

      if (itemsError) {
        console.error(`  - FAILED to migrate items for order ${orderId}: ${itemsError.message}`);
      }
    }
  }

  console.log("SUCCESS: Orders and items migration finished.");
}

/**
 * =================================================================
 * 7. MIGRATE RETURNS
 * =================================================================
 */
async function migrateReturns(db, supabaseAdmin) {
  console.log("Starting returns migration...");

  const returnsRef = db.collection("return_requests");
  const snapshot = await returnsRef.get();

  if (snapshot.empty) {
    console.log("No return requests found in Firestore.");
    return;
  }

  console.log(`Found ${snapshot.size} return requests to migrate.`);

  const returns = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      created_at: data.createdAt?.toDate(),
      updated_at: data.updatedAt?.toDate(),
    };
  });

  // Using batch upsert for efficiency
  const { error } = await supabaseAdmin
    .from("return_requests")
    .upsert(returns, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert return requests: ${error.message}`);
  }

  console.log(`SUCCESS: ${returns.length} return requests migrated.`);
}

/**
 * =================================================================
 * 8. MIGRATE NOTIFICATIONS
 * =================================================================
 */
async function migrateNotifications(db, supabaseAdmin) {
  console.log("Starting notifications migration...");

  const notificationsRef = db.collection("notifications");
  const snapshot = await notificationsRef.get();

  if (snapshot.empty) {
    console.log("No notifications found in Firestore.");
    return;
  }

  console.log(`Found ${snapshot.size} notifications to migrate.`);

  const notifications = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      created_at: data.createdAt?.toDate(),
      updated_at: data.updatedAt?.toDate(),
      read_at: data.readAt?.toDate(),
    };
  });

  // Using batch upsert for efficiency
  const { error } = await supabaseAdmin
    .from("notifications")
    .upsert(notifications, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert notifications: ${error.message}`);
  }

  console.log(`SUCCESS: ${notifications.length} notifications migrated.`);
}

/**
 * =================================================================
 * 9. MIGRATE ADDRESSES
 * =================================================================
 */
async function migrateAddresses(db, supabaseAdmin) {
  console.log("Starting addresses migration...");

  const usersRef = db.collection("users");
  const usersSnapshot = await usersRef.get();

  if (usersSnapshot.empty) {
    console.log("No users found in Firestore.");
    return;
  }

  let allAddresses = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const addressesRef = userDoc.ref.collection("addresses");
    const addressesSnapshot = await addressesRef.get();

    if (!addressesSnapshot.empty) {
      console.log(`- Found ${addressesSnapshot.size} addresses for user ${userId}`);
      const userAddresses = addressesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          user_id: userId,
          ...data,
          created_at: data.createdAt?.toDate(),
          updated_at: data.updatedAt?.toDate(),
        };
      });
      allAddresses = allAddresses.concat(userAddresses);
    }
  }

  if (allAddresses.length === 0) {
    console.log("No addresses found to migrate.");
    return;
  }

  console.log(`Total of ${allAddresses.length} addresses to migrate.`);

  // Using batch upsert for efficiency
  const { error } = await supabaseAdmin
    .from("addresses")
    .upsert(allAddresses, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert addresses: ${error.message}`);
  }

  console.log(`SUCCESS: ${allAddresses.length} addresses migrated.`);
}


async function main() {
  const { db } = await import("../src/lib/firebaseAdmin.js");
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");

  // The order follows the dependency chain.
  await migrateAuthUsers('users.json', db, supabaseAdmin);
  await migrateStoreSettings(db, supabaseAdmin);
  await migrateProducts(db, supabaseAdmin);
  await migrateReviews(db, supabaseAdmin);
  await migrateOrdersAndItems(db, supabaseAdmin);
  await migrateReturns(db, supabaseAdmin);
  await migrateNotifications(db, supabaseAdmin);
  await migrateAddresses(db, supabaseAdmin);

  console.log("All migrations executed.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
