'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-fetch the card every 15 s while the page is visible, so stamps appear live. */
export function LiveRefresh({ every = 15_000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const t = setInterval(tick, every);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [router, every]);
  return null;
}
