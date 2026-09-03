'use client';

import { useState, type FocusEvent } from 'react';

/**
 * Keyboard-focus state for controls that hide their native input.
 *
 * `Checkbox`, `Radio` and `Switch` all paint a custom box and hide the real
 * `<input>` with `opacity: 0`. That hides the browser's focus ring with it, so
 * a keyboard user tabbing through a filter panel gets no indication of where
 * they are — a quality-floor failure the sources share.
 *
 * `:focus-visible` is the heuristic the browser already computes for "focus
 * that deserves a ring": true when tabbing, false on a mouse click. Matching
 * against it beats reimplementing the distinction from key and pointer events.
 */
export function useFocusRing() {
  const [focusVisible, setFocusVisible] = useState(false);

  return {
    focusVisible,
    focusProps: {
      onFocus: (event: FocusEvent<Element>) => {
        let visible = true;
        try {
          visible = event.target.matches(':focus-visible');
        } catch {
          // Selector unsupported: show the ring. Erring towards a visible ring
          // costs a stray outline; erring the other way strands the keyboard.
          visible = true;
        }
        setFocusVisible(visible);
      },
      onBlur: () => setFocusVisible(false),
    },
  };
}
