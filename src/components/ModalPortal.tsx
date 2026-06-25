'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal — renders children directly into document.body,
 * bypassing any CSS stacking contexts (backdrop-filter, transform, z-index)
 * that would otherwise clip or hide position:fixed modal overlays.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
