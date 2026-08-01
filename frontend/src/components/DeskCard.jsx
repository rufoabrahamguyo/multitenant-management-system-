export function DeskCard({ icon, title, onEdit, children, className = '' }) {
  return (
    <section className={`desk-card ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="desk-card-icon shrink-0" aria-hidden="true">{icon}</span>}
          <h3 className="font-semibold text-slate-800 truncate">{title}</h3>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="desk-link shrink-0">
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function DeskField({ label, value, empty = '-' }) {
  const display = value === null || value === undefined || value === '' ? empty : value;
  return (
    <div className="min-w-0">
      <p className="desk-label">{label}</p>
      <p className="desk-value break-words">{display}</p>
    </div>
  );
}

export function DeskStatusBadge({ active }) {
  if (active === false) {
    return <span className="desk-badge desk-badge-danger">Suspended</span>;
  }
  return <span className="desk-badge desk-badge-success">Active</span>;
}
