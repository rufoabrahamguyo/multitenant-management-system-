/** Normalize DRF paginated or plain list responses. */
export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/** Format Kenyan Shilling amounts consistently across the dashboard. */
export function formatKes(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'KES 0';
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}k`;
  return `KES ${n.toLocaleString()}`;
}

/** Basic Kenya phone validation for manager registration. */
export function isValidKenyaPhone(phone) {
  const normalized = String(phone || '').replace(/[\s-]/g, '');
  return /^(\+254|254|0)[17]\d{8}$/.test(normalized);
}

/** Minimum password rules aligned with Django validators. */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return '';
}
