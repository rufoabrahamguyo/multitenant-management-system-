const NAVBAR_OFFSET = 96;

/** Scroll to a page section by hash, accounting for the fixed marketing navbar. */
export function scrollToSection(hash, offset = NAVBAR_OFFSET) {
  const id = String(hash || '').replace(/^#/, '');
  if (!id) return false;

  const target = document.getElementById(id);
  if (!target) return false;

  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: 'smooth' });
  window.history.replaceState(null, '', `#${id}`);
  return true;
}
