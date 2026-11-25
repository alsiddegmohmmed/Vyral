'use client';
import { useEffect, useState } from 'react';

/**
 * Self-filling card preview: one stamp every `stepMs` up to a full card, a pause
 * on the reward, then it starts again. Stops while the tab is hidden, and never
 * runs under prefers-reduced-motion (the caller's still value shows instead).
 */
export function useStampLoop(total: number, playing: boolean, { stepMs = 1200, holdMs = 2400 } = {}) {
  const [reduced, setReduced] = useState(false);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const running = playing && !reduced && total > 0;
  useEffect(() => {
    if (!running) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.hidden) { t = setTimeout(tick, stepMs); return; }
      n = n >= total ? 0 : n + 1;
      setFilled(n);
      t = setTimeout(tick, n >= total ? holdMs : stepMs);
    };
    setFilled(0);
    t = setTimeout(tick, stepMs / 2);
    return () => clearTimeout(t);
  }, [running, total, stepMs, holdMs]);

  return { filled, running, reduced };
}
