"use client";
import { useProductForm } from "@/hooks/useProductForm";
import styles from "./ProductForm.module.css";
import config from "@/data/ui/productFormConfig.json";

// Reusable Input Component
const Input = ({ label, ...props }) => (
  <div className={styles.inputGroup}>
    <label className={styles.fieldLabel}>{label}</label>
    <input {...props} className={styles.inputField} />
  </div>
);

const Select = ({ label, children, ...props }) => (
    <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{label}</label>
        <select {...props} className={styles.selectField}>{children}</select>
    </div>
);

const Textarea = ({ label, ...props }) => (
    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
        <label className={styles.fieldLabel}>{label}</label>
        <textarea {...props} className={styles.textareaField} />
    </div>
);

const FileInput = ({ label, file, onChange, previewUrl, onRemove }) => (
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


export default function ProductForm({ product, onSuccess, onCancel }) {
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
          onChange={(e) => handleFormChange("name", e.target.value)}
          required
        />
        <Select
            label={config.labels.category}
            value={formData.category}
            onChange={e => handleFormChange('category', e.target.value)}
        >
            {config.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </Select>

        <FileInput 
            label={config.labels.mainImage}
            file={mainImage.file}
            previewUrl={mainImage.previewUrl}
            onChange={handleMainFileChange}
            onRemove={() => handleMainFileChange(null)} // Simplified remove
        />

        <div className={styles.variantsBox}>
            <label className={styles.fieldLabel}>{config.labels.variants}</label>
            {variants.map((v, index) => (
                <div key={index} className={styles.variantRow}>
                    <input placeholder={config.placeholders.size} value={v.size} onChange={e => handleVariantChange(index, "size", e.target.value)} className={styles.variantInput} required/>
                    <input type="number" placeholder={config.placeholders.price} value={v.price} onChange={e => handleVariantChange(index, "price", e.target.value)} className={styles.variantInput} required/>
                    <input type="number" placeholder={config.placeholders.stock} value={v.stock} onChange={e => handleVariantChange(index, "stock", e.target.value)} className={styles.variantInput} required/>
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
            onChange={e => handleFormChange('description', e.target.value)}
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
