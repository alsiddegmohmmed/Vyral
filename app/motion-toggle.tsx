'use client';

import { useEffect, useState } from 'react';

const storageKey = 'vyral-motion';

export default function MotionToggle() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'off') {
        document.documentElement.dataset.motion = 'off';
        setPaused(true);
      }
    } catch {
      // Motion can still be paused for the current page.
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-in-view', entry.isIntersecting);
    });
    document.querySelectorAll('[data-loop]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = !paused;
    setPaused(next);
    document.documentElement.dataset.motion = next ? 'off' : 'on';
    try {
      localStorage.setItem(storageKey, next ? 'off' : 'on');
    } catch {
      // Keep the current page setting when storage is unavailable.
    }
  }

  return (
    <button type="button" className="motion-toggle" aria-label="Motion effects" aria-pressed={!paused} onClick={toggle}>
      <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
      <span>Motion</span>
    </button>
  );
}
