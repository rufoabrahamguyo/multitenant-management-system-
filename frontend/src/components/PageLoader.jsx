export default function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
