export default function FormField({ id, label, error, className = '', children }) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="label-field">{label}</label>
      {typeof children === 'function'
        ? children({ id, errorId, invalid: Boolean(error) })
        : children}
      {error && (
        <p id={errorId} className="text-red-600 text-xs mt-1.5" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
