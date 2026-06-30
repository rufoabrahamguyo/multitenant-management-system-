import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

const FeedbackContext = createContext(null);

const TOAST_STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-slate-50 border-slate-200 text-slate-800',
};

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`pointer-events-auto border rounded-xl shadow-lg px-4 py-3 text-sm flex items-start gap-3 animate-[slideIn_0.2s_ease-out] ${TOAST_STYLES[toast.type]}`}
        >
          <span className="font-bold shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/60 text-xs" aria-hidden="true">
            {TOAST_ICONS[toast.type]}
          </span>
          <p className="flex-1 leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Dismiss notification: ${toast.message}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const titleId = 'confirm-dialog-title';
  const messageId = 'confirm-dialog-message';

  useFocusTrap(dialogRef, Boolean(dialog));

  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, onCancel]);

  if (!dialog) return null;

  const isDanger = dialog.variant === 'danger';
  const isAlert = dialog.mode === 'alert';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={isAlert ? onConfirm : onCancel}
        aria-label="Close dialog"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <h3 id={titleId} className="text-lg font-semibold text-slate-900">{dialog.title}</h3>
        <p id={messageId} className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{dialog.message}</p>
        <div className={`flex ${isAlert ? 'justify-end' : 'flex-col-reverse sm:flex-row sm:justify-end'} gap-3 mt-6`}>
          {!isAlert && (
            <button type="button" onClick={onCancel} className="btn-secondary btn-sm min-h-[44px]">
              {dialog.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] ${isDanger ? 'btn btn-sm bg-red-600 text-white hover:bg-red-700' : 'btn-primary btn-sm'}`}
          >
            {dialog.confirmLabel || (isAlert ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const dialogResolver = useRef(null);
  const toastId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'success', duration = 4500) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
    return id;
  }, [dismissToast]);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolver.current = resolve;
      setDialog({
        title: options.title || 'Are you sure?',
        message: options.message || 'This action cannot be undone.',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'danger',
        mode: 'confirm',
      });
    });
  }, []);

  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolver.current = resolve;
      setDialog({
        title: options.title || 'Notice',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'OK',
        mode: 'alert',
      });
    });
  }, []);

  const handleConfirm = () => {
    dialogResolver.current?.(true);
    dialogResolver.current = null;
    setDialog(null);
  };

  const handleCancel = () => {
    dialogResolver.current?.(false);
    dialogResolver.current = null;
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm, alert }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog dialog={dialog} onConfirm={handleConfirm} onCancel={handleCancel} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
