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

/**
 * Spread onto a number input: `<input {...selectAllProps} />`.
 *
 * Binds the deferred select to both focus AND click so the value is
 * always selected when you interact with the field — first focus, a
 * focusing click (desktop mouseup would otherwise drop the selection),
 * and any later click while already focused. First keystroke replaces
 * the whole number; use the +/- buttons for nudges.
 */
export const selectAllProps = {
  onFocus: selectAllOnFocus,
  onClick: selectAllOnFocus,
};
