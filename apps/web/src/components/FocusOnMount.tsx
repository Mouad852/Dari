'use client';

import { useEffect } from 'react';

/**
 * Focuses `targetId` once, on mount. No visual output -- a client island on
 * an otherwise server-rendered page, same pattern as `ContactButton`/
 * `ReportDialog` on this same page.
 *
 * No route-change announcement exists anywhere in this app for a
 * client-side transition (the default for `next/link`) -- see the fix on
 * `account/listings/page.tsx` and the other pages that already carry it.
 * This is the same fix for pages whose heading is rendered by a Server
 * Component, which cannot hold a ref or run an effect itself.
 */
export function FocusOnMount({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.focus();
  }, [targetId]);

  return null;
}
