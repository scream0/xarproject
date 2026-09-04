// @ts-nocheck
"use client";
import { useProductForm } from "@/hooks/useProductForm";
import styles from "./ProductForm.module.css";
import config from "@/data/ui/productFormConfig.json";
import { BiteshipAreaSelect } from "@/components/UI/BiteshipAreaSelect/BiteshipAreaSelect";

// Reusable Input Component
const Input = ({ label, value, ...props }: any) => (
  <div className={styles.inputGroup}>
    <label className={styles.fieldLabel}>{label}</label>
    <input value={value ?? ""} {...props} className={styles.inputField} />
  </div>
);

const Select = ({ label, value, children, ...props }: any) => (
    <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{label}</label>
        <select value={value ?? ""} {...props} className={styles.selectField}>{children}</select>
    </div>
);

const Textarea = ({ label, value, ...props }: any) => (
    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
        <label className={styles.fieldLabel}>{label}</label>
        <textarea value={value ?? ""} {...props} className={styles.textareaField} />
    </div>
);

const FileInput = ({ label, file, onChange, previewUrl, onRemove }: any) => (
    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
        <label className={styles.fieldLabel}>{label}</label>
        <div className={styles.imageUploadWrapper}>
            {previewUrl && (
                <div className={styles.previewContainer}>
                    <img src={previewUrl} alt="Preview" className={styles.mainPreviewImg} />
                    <button type="button" onClick={onRemove} className={styles.removeImgBtn}>&times;</button>
                </div>
            )}
            <label className={styles.customFileBtn}>
                <input type="file" accept="image/*" className={styles.fileInputHidden} onChange={e => onChange(e.target.files[0])} />
                {config.buttons.chooseFile}
            </label>
            <span className={styles.fileChosenText}>{file?.name || config.buttons.noFile}</span>
        </div>
    </div>
);


export default function ProductForm({ product, onSuccess, onCancel }: any) {
  const {
    isEditMode,
    formData,
    variants,
    mainImage,
    isUploading,
    handleFormChange,
    handleVariantChange,
    addVariant,
    removeVariant,
    handleMainFileChange,
    handleSubmit,
  } = useProductForm(product, onSuccess);

  const currentConfig = isEditMode ? config.edit : config.add;

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h3 className={styles.title}>{currentConfig.title}</h3>
      <div className={styles.grid}>
        <Input
          label={config.labels.name}
          placeholder={config.placeholders.name}
          value={formData.name}
          onChange={(e: any) => handleFormChange("name", e.target.value)}
          required
        />
        <Select
            label={config.labels.category}
            value={formData.category}
            onChange={(e: any) => handleFormChange('category', e.target.value)}
        >
            {config.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </Select>

        <Select
            label="Status"
            value={formData.status}
            onChange={(e: any) => handleFormChange('status', e.target.value)}
        >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
        </Select>

        <div className={styles.dimensionGroup}>
            <Input
            label="Panjang (cm)"
            type="number"
            min="0"
            placeholder="10"
            value={formData.length}
            onChange={(e: any) => handleFormChange("length", e.target.value)}
            />
            <Input
            label="Lebar (cm)"
            type="number"
            min="0"
            placeholder="10"
            value={formData.width}
            onChange={(e: any) => handleFormChange("width", e.target.value)}
            />
            <Input
            label="Tinggi (cm)"
            type="number"
            min="0"
            placeholder="10"
            value={formData.height}
            onChange={(e: any) => handleFormChange("height", e.target.value)}
            />
        </div>

        <Input
          label="Berat (gram)"
          type="number"
          min="0"
          placeholder="Contoh: 250"
          value={formData.weight}
          onChange={(e: any) => handleFormChange("weight", e.target.value)}
        />

        <Input
          label="Lokasi Stok"
          placeholder="Contoh: Gudang Utama"
          value={formData.stockLocation}
          onChange={(e: any) => handleFormChange("stockLocation", e.target.value)}
          required
        />

        <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
            <label className={styles.fieldLabel}>Asal Pengiriman (Biteship)</label>
            <BiteshipAreaSelect
                value={{
                    province: formData.province,
                    city: formData.city,
                    district: formData.district,
                    postalCode: formData.postalCode,
                    biteshipAreaId: formData.biteshipAreaId,
                }}
                onChange={(value: any) => {
                    handleFormChange("province", value.province);
                    handleFormChange("city", value.city);
                    handleFormChange("district", value.district);
                    handleFormChange("postalCode", value.postalCode);
                    handleFormChange("biteshipAreaId", value.biteshipAreaId);
                }}
            />
        </div>

        <FileInput 
            label={config.labels.mainImage}
            file={mainImage.file}
            previewUrl={mainImage.previewUrl}
            onChange={handleMainFileChange}
            onRemove={() => handleMainFileChange(null)} // Simplified remove
        />

        <div className={styles.variantsBox}>
            <label className={styles.fieldLabel}>{config.labels.variants}</label>
            {variants.map((v, index: any) => (
                <div key={index} className={styles.variantRow}>
                    <input placeholder={config.placeholders.size} value={v.size || ""} onChange={e => handleVariantChange(index, "size", e.target.value)} className={styles.variantInput} required/>
                    <input placeholder="SKU" value={v.sku || ""} onChange={e => handleVariantChange(index, "sku", e.target.value)} className={styles.variantInput} />
                    <input type="number" placeholder={config.placeholders.price} value={v.price ?? ""} onChange={e => handleVariantChange(index, "price", e.target.value)} className={styles.variantInput} required/>
                    <input type="number" placeholder={config.placeholders.stock} value={v.stock ?? 0} onChange={e => handleVariantChange(index, "stock", e.target.value)} className={styles.variantInput} required/>
                    {/* Simplified variant image input for brevity */}
                    <button type="button" onClick={() => removeVariant(index)} className={styles.variantActionBtn}>&times;</button>
                </div>
            ))}
            <button type="button" onClick={addVariant} className={styles.addVariantBtn}>{config.buttons.addVariant}</button>
        </div>

        <Textarea
            label={config.labels.description}
            placeholder={config.placeholders.description}
            value={formData.description}
            onChange={(e: any) => handleFormChange('description', e.target.value)}
        />

        <div className={styles.buttonGroup}>
            {onCancel && <button type="button" onClick={onCancel} className={styles.cancelBtn}>{config.buttons.cancel}</button>}
            <button type="submit" disabled={isUploading} className={styles.submitBtn}>
                {isUploading ? currentConfig.submittingButton : currentConfig.submitButton}
            </button>
        </div>
      </div>
    </form>
  );
}
