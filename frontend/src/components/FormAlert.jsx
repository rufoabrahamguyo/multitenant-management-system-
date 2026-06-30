const STYLES = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  info: 'bg-slate-50 border-slate-200 text-slate-700',
};

const ICONS = {
  error: '✕',
  warning: '!',
  success: '✓',
  info: 'i',
};

const LIVE = {
  error: 'assertive',
  warning: 'assertive',
  success: 'polite',
  info: 'polite',
};

export default function FormAlert({ type = 'error', children, id }) {
  if (!children) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live={LIVE[type]}
      className={`flex items-start gap-2 text-sm p-3 rounded-xl border ${STYLES[type]}`}
    >
      <span className="font-bold shrink-0" aria-hidden="true">{ICONS[type]}</span>
      <p className="leading-snug">{children}</p>
    </div>
  );
}
