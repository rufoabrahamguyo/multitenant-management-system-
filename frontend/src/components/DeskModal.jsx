import { useEffect, useRef } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

export default function DeskModal({
  open,
  title,
  icon = '?',
  onClose,
  children,
  footer,
}) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-modal-title"
        className="desk-modal relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="desk-modal-icon shrink-0" aria-hidden="true">{icon}</span>
            <h2 id="desk-modal-title" className="text-xl font-bold text-slate-800 truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-lg"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap items-center gap-4">{footer}</div>}
      </div>
    </div>
  );
}
