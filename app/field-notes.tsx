'use client';

import { useEffect, useRef } from 'react';
import { Mark } from './mark';
import './field-notes.css';

export default function FieldNotes() {
  const section = useRef<HTMLElement>(null);
  const night = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chapter = section.current;
    const layer = night.current;
    if (!chapter || !layer || !window.IntersectionObserver || !window.KeyframeEffect || !layer.getAnimations) return;

    const imageLayer = layer;
    const root = document.documentElement;
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const duration = 1000;
    let inView = false;
    let source: KeyframeEffect | undefined;
    let easedShutter: Animation | undefined;
    let frame: number | undefined;
    let previousTime = 0;
    let progress = 0;

    function stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      easedShutter?.cancel();
      easedShutter = undefined;
      source = undefined;
    }

    function followScroll(now: number) {
      frame = undefined;
      const target = source?.getComputedTiming().progress;
      if (!easedShutter || target == null) return;

      const distance = target - progress;
      // Give the shutter a short catch-up without changing the page's scroll position.
      if (Math.abs(distance) < .001) {
        progress = target;
      } else {
        const elapsed = Math.max(0, now - previousTime);
        progress += distance * (1 - Math.exp(-elapsed / 44));
        frame = requestAnimationFrame(followScroll);
      }
      previousTime = now;
      easedShutter.currentTime = progress * duration;
    }

    function schedule() {
      if (!easedShutter || frame !== undefined) return;
      previousTime = performance.now();
      frame = requestAnimationFrame(followScroll);
    }

    function syncMotion() {
      if (!inView || !motion.matches || root.dataset.motion === 'off') {
        stop();
        return;
      }
      if (easedShutter) return;

      const effect = imageLayer.getAnimations()[0]?.effect;
      const current = effect?.getComputedTiming().progress;
      if (!(effect instanceof KeyframeEffect) || current == null) return;

      // Reuse the original CSS shutters and use their timeline as the scroll target.
      source = effect;
      progress = current;
      easedShutter = imageLayer.animate(effect.getKeyframes(), { duration, fill: 'both' });
      easedShutter.pause();
      easedShutter.currentTime = progress * duration;
    }

    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncMotion();
    });
    visibility.observe(chapter);
    const settings = new MutationObserver(syncMotion);
    settings.observe(root, { attributeFilter: ['data-motion'] });
    motion.addEventListener('change', syncMotion);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      visibility.disconnect();
      settings.disconnect();
      motion.removeEventListener('change', syncMotion);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      stop();
    };
  }, []);

  return (
    <section className="field-notes" ref={section} aria-labelledby="field-title">
      <div className="field-stage">
        <div className="field-media" aria-hidden="true">
          <div className="field-shot field-day">
            <img src="/art/kigali-day.webp" width={1440} height={811} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="field-shot field-night" ref={night}>
            <img src="/art/kigali-night.webp" width={1440} height={811} alt="" loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="field-content wrap">
          <div className="field-index">
            <p className="eyebrow"><Mark /> Field notes from Kigali</p>
          </div>
          <div className="field-copy">
            <h2 id="field-title">good ideas<br />don’t sit still<span>.</span></h2>
            <p>From the first campaign people notice to the page where they decide to get in touch.</p>
          </div>
          <div className="field-timing" aria-hidden="true">
            <span className="eyebrow">Daylight</span>
            <div className="field-meter"><span /></div>
            <span className="eyebrow">After dark</span>
          </div>
        </div>
      </div>
    </section>
  );
}
