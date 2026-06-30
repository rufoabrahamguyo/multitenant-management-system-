export default function LoadingScreen({ message = 'Loading Propizy…' }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}
