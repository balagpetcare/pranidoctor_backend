"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` on the server and on the browser's first render, then `true` after
 * the client has committed (microtask). Use to gate async-derived UI so SSR and the
 * initial hydration pass stay aligned (e.g. list loaders, `disabled` on controls).
 */
export function useClientMountReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setReady(true);
    });
  }, []);
  return ready;
}
