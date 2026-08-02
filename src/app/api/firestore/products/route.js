
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// A (very) basic auth check
// In a real app, you'd use Firebase Auth tokens and a more robust user roles system
async function isAdmin(request) {
    // For now, let's assume a header 'x-admin-secret' is our "auth"
    // THIS IS NOT SECURE FOR PRODUCTION
    const secret = request.headers.get('x-admin-secret');
    return secret === process.env.ADMIN_SECRET;
}

// GET /api/firestore/products -> Get all products
export async function GET(request) {
    try {
        const productsRef = db.collection("products");
        const snapshot = await productsRef.orderBy("createdAt", "desc").get();

        if (snapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(products, { status: 200 });
    } catch (error) {
        console.error("Failed to get products:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/firestore/products -> Add a new product
export async function POST(request) {
    if (!await isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, description, imageUrl, variants, weight, category } = body;

        if (!name || !imageUrl) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newProduct = {
            name,
            description,
            imageUrl,
            variants: variants || [],
            weight: Number(weight) || 0,
            category: category || "Uncategorized",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const newDocRef = await db.collection("products").add(newProduct);
        return NextResponse.json({ id: newDocRef.id, ...newProduct }, { status: 201 });
    } catch (error) {
        console.error("Failed to add product:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT /api/firestore/products/[id] -> Update a product
// Note: This should be in a [id]/route.js file, but for simplicity, we'll handle it here.
export async function PUT(request) {
    if (!await isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    try {
        const body = await request.json();
        const { id, ...productData } = body;

        if (!id) {
            return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
        }

        const productRef = db.collection("products").doc(id);
        await productRef.update({
            ...productData,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ message: "Product updated successfully" });
    } catch (error) {
        console.error("Failed to update product:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/firestore/products/[id] -> Delete a product
export async function DELETE(request) {
    if (!await isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
        }

        await db.collection("products").doc(id).delete();

        return NextResponse.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Failed to delete product:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/firestore/products/stock -> Update stock for a variant
export async function PATCH(request) {
    if (!await isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { productId, variantId, quantity } = await request.json();

        if (!productId || !variantId || !quantity) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const productRef = db.collection("products").doc(productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const product = productDoc.data();
        const variantIndex = product.variants.findIndex(v => v.id === variantId);

        if (variantIndex === -1) {
            return NextResponse.json({ error: "Variant not found" }, { status: 404 });
        }

        const newStock = Number(product.variants[variantIndex].stock) - Number(quantity);
        if (newStock < 0) {
            return NextResponse.json({ error: "Not enough stock" }, { status: 400 });
        }

        const newVariants = [...product.variants];
        newVariants[variantIndex].stock = newStock;

        await productRef.update({ variants: newVariants });

        return NextResponse.json({ message: "Stock updated successfully" });
    } catch (error) {
        console.error("Failed to update stock:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
