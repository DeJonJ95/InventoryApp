"use client";

/**
 * Mobile-safe "select all on focus".
 *
 * On touch browsers, a plain onFocus `select()` runs before the browser
 * places the caret at the tapped point, so the caret wins and you end up
 * typing into the middle of the existing value. Deferring the select to
 * the next tick lets it run *after* caret placement, so tapping anywhere
 * in a pre-filled number field selects it and the first keystroke starts
 * a fresh value.
 */
export function selectAllOnFocus(e) {
  const el = e.target;
  setTimeout(() => {
    try {
      el.select();
    } catch {
      /* element unmounted/blurred before the deferred select — ignore */
    }
  }, 0);
}
