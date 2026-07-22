function PhotoGlyph({ className = 'w-8 h-8' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={{ color: 'var(--desk-teal, #76d2c4)' }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/**
 * Staff ID photo upload zone — matches Qcare / Raise-a-Ticket dashed teal style.
 */
export default function IdUploadZone({
  label,
  imageUrl,
  fileName,
  uploading = false,
  disabled = false,
  onSelect,
  accept = 'image/jpeg,image/png,image/webp',
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--desk-teal-hover, #5fc4b4)' }}>
          {label}
        </p>
        {imageUrl && <span className="desk-badge desk-badge-info">On file</span>}
        {!imageUrl && fileName && <span className="desk-badge desk-badge-warn">Ready</span>}
      </div>

      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
          <img
            src={imageUrl}
            alt={label}
            className="w-full max-h-44 object-contain rounded-lg border border-dashed border-slate-200 bg-slate-50"
          />
        </a>
      ) : (
        <div className="mb-3 flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 px-3 text-center">
          {fileName ? fileName : 'No image uploaded'}
        </div>
      )}

      {!disabled && (
        <label className={`desk-upload min-h-[5.5rem] ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onSelect) onSelect(file);
              e.target.value = '';
            }}
          />
          <PhotoGlyph className="w-9 h-9 mb-2" />
          <span className="text-sm text-slate-500">
            {uploading ? 'Uploading…' : imageUrl || fileName ? 'Replace photo' : 'Upload ID photo'}
          </span>
          <span className="text-xs text-slate-400 mt-1">JPEG, PNG or WebP</span>
        </label>
      )}
    </div>
  );
}
