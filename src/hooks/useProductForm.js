import { useState, useEffect } from "react";
import toast from "react-hot-toast";

// Konfigurasi bisa digabungkan nanti jika diperlukan
import addConfig from "@/data/ui/addProductConfig.json";
import editConfig from "@/data/ui/editProductConfig.json";

export function useProductForm(initialProduct = null, onSuccess) {
  const isEditMode = Boolean(initialProduct);

  const [formData, setFormData] = useState({
    name: "",
    category: "Parfum",
    description: "",
  });
  const [variants, setVariants] = useState([
    { size: "10ml", price: "", stock: 0, imageFile: null, imageUrl: "", imagePublicId: "" },
  ]);
  const [mainImage, setMainImage] = useState({ file: null, previewUrl: "", publicId: "" });
  const [isUploading, setUploading] = useState(false);

  useEffect(() => {
    if (isEditMode && initialProduct) {
      setFormData({
        name: initialProduct.name || "",
        category: initialProduct.category || "Parfum",
        description: initialProduct.description || "",
      });
      setVariants(
        initialProduct.variants?.map((v) => ({
          size: v.size || "",
          price: v.price || "",
          stock: v.stock ?? 0,
          imageUrl: v.image_url || v.imageUrl || "",
          imagePublicId: v.imagePublicId || "",
          imageFile: null,
        })) || [{ size: "10ml", price: "", stock: 0, imageFile: null, imageUrl: "", imagePublicId: "" }]
      );
      setMainImage({
        file: null,
        previewUrl: initialProduct.image_url || initialProduct.imageUrl || "",
        publicId: initialProduct.image_public_id || initialProduct.imagePublicId || "",
      });
    }
  }, [initialProduct, isEditMode]);

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };
  
  const handleVariantFileChange = (index, file) => {
    const newVariants = [...variants];
    newVariants[index].imageFile = file;
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { size: "", price: "", stock: 0, imageFile: null, imageUrl: "", imagePublicId: "" }]);
  };

  const removeVariant = (index) => {
    if (variants.length > 1) {
        const newVariants = variants.filter((_, i) => i !== index);
        setVariants(newVariants);
    } else {
        toast.error("Setidaknya harus ada satu varian produk.");
    }
  };
  
  const handleMainFileChange = (file) => {
      if (file) {
          setMainImage({ ...mainImage, file, previewUrl: URL.createObjectURL(file) });
      }
  };

  const uploadImage = async (file, folderName, oldPublicId = null) => {
    if (!file) return { secure_url: null, public_id: null };

    const data = new FormData();
    data.append("file", file);
    data.append("userId", folderName); // Menggunakan userId sebagai nama folder
    if (oldPublicId) {
        data.append("oldPublicId", oldPublicId);
    }
    
    const res = await fetch("/api/cloudinary", { method: "POST", body: data });
    const result = await res.json();

    if (!res.ok) {
        throw new Error(result.error || "Gagal mengunggah gambar.");
    }
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditMode && !mainImage.file) {
      toast.error(addConfig.toast.selectImage);
      return;
    }

    const toastId = toast.loading(isEditMode ? editConfig.buttons.saving : addConfig.toast.uploading);
    setUploading(true);

    try {
      const productId = initialProduct?.id || Date.now();

      // 1. Upload main image
      const mainImageResult = await uploadImage(mainImage.file, `product_${productId}`, mainImage.publicId);
      const finalImageUrl = mainImage.file ? mainImageResult.secure_url : mainImage.previewUrl;
      const finalImagePublicId = mainImage.file ? mainImageResult.public_id : mainImage.publicId;

      // 2. Upload variant images
      const processedVariants = await Promise.all(
        variants.map(async (v, index) => {
            const variantImageResult = await uploadImage(v.imageFile, `product_${productId}_var_${index}`, v.imagePublicId);
            return {
                size: v.size,
                price: Number(v.price) || 0,
                stock: Number(v.stock) || 0,
                imageUrl: v.imageFile ? variantImageResult.secure_url : v.imageUrl,
                imagePublicId: v.imageFile ? variantImageResult.public_id : v.imagePublicId,
            };
        })
      );

      // 3. Prepare payload
      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        imageUrl: finalImageUrl,
        imagePublicId: finalImagePublicId,
        variants: processedVariants,
      };
      if (isEditMode) {
          payload.productId = initialProduct.id;
      }

      // 4. Submit to products API
      const res = await fetch("/api/products", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan produk.");
      
      toast.success(isEditMode ? editConfig.alerts.success : addConfig.toast.success, { id: toastId });
      onSuccess?.();

    } catch (error) {
      console.error("Product form submission error:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return {
    isEditMode,
    formData,
    variants,
    mainImage,
    isUploading,
    handleFormChange,
    handleVariantChange,
    handleVariantFileChange,
    addVariant,
    removeVariant,
    handleMainFileChange,
    handleSubmit,
  };
}
