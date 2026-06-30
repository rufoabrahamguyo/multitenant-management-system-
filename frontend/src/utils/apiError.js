function formatFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : item?.msg || String(item))).join(' ');
  }
  if (typeof value === 'object' && value !== null) return String(value);
  return String(value);
}

/** Extract per-field validation messages from a DRF error response. */
export function getApiFieldErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return {};

  if (typeof data.detail === 'string' || Array.isArray(data.detail)) return {};

  const errors = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'detail') continue;
    errors[key] = formatFieldValue(value);
  }
  return errors;
}

export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) {
    if (err?.request) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    return err?.message || fallback;
  }

  const data = err.response.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => (typeof item === 'string' ? item : item?.msg || String(item))).join(' ');
  }
  if (typeof data === 'object') {
    const messages = Object.entries(data).flatMap(([key, value]) => {
      const text = formatFieldValue(value);
      return key === 'detail' ? [text] : [`${key.replace(/_/g, ' ')}: ${text}`];
    });
    if (messages.length) return messages.join(' ');
  }

  return fallback;
}
