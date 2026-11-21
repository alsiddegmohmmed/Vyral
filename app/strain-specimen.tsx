'use client';

import { useEffect, useId, useRef, type PointerEvent } from 'react';
import { strainMark, strainPulse } from './strain';

const layers = ['#3b1032', '#5d154a', '#831960', '#ae267d', '#dd309f', '#fb57c4'];
const motionQuery = '(prefers-reduced-motion: no-preference)';

function motionEnabled() {
  return document.documentElement.dataset.motion !== 'off' && window.matchMedia(motionQuery).matches;
}

export default function StrainSpecimen() {
  const id = useId();
  const shapeId = `${id}-shape`;
  const maskId = `${id}-mask`;
  const model = useRef<SVGSVGElement>(null);
  const body = useRef<SVGGElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const morph = useRef<SVGAnimateElement>(null);
  const tiltFrame = useRef<number | null>(null);
  const pulse = useRef<Animation[]>([]);

  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    function stopMotion() {
      if (motionEnabled()) return;
      resetTilt();
      pulse.current.forEach(animation => animation.cancel());
      morph.current?.endElement();
    }
    const observer = new MutationObserver(stopMotion);
    observer.observe(document.documentElement, { attributeFilter: ['data-motion'] });
    preference.addEventListener('change', stopMotion);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', stopMotion);
      if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
      pulse.current.forEach(animation => animation.cancel());
    };
  }, []);

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' || !motionEnabled()) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - left) / width - 0.5;
    const y = (event.clientY - top) / height - 0.5;
    if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = requestAnimationFrame(() => {
      model.current?.style.setProperty('--tilt-x', `${-y * 22}deg`);
      model.current?.style.setProperty('--tilt-y', `${x * 27}deg`);
      model.current?.style.setProperty('--shift-x', `${x * 26}px`);
      tiltFrame.current = null;
    });
  }

  function resetTilt() {
    if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = null;
    model.current?.removeAttribute('style');
  }

  function sendPulse() {
    if (!motionEnabled()) return;

    morph.current?.beginElement();
    pulse.current.forEach(animation => animation.cancel());
    const rings = Array.from(wave.current?.children ?? [], (ring, index) =>
      ring.animate([
        { transform: 'scale(.42)', opacity: 0 },
        { opacity: .86, offset: .14 },
        { transform: 'scale(1.55)', opacity: 0 },
      ], { duration: 980, delay: index * 100, easing: 'cubic-bezier(.18,.7,.29,1)' }),
    );
    const recoil = body.current?.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.075) rotate(3deg)', offset: .27, easing: 'ease-in-out' },
      { transform: 'scale(.975) rotate(-1deg)', offset: .57, easing: 'ease-out' },
      { transform: 'scale(1)' },
    ], { duration: 1080 });
    pulse.current = recoil ? [recoil, ...rings] : rings;
  }

  return (
    <figure className="specimen">
      <div className="specimen-art" onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className="specimen-grid" aria-hidden="true" />
        <div className="specimen-orbits" aria-hidden="true"><span /><span /><span /></div>
        <div className="specimen-waves" aria-hidden="true" ref={wave}><i /><i /><i /></div>
        <svg className="strain-model" viewBox="-24 -27 304 317" role="img" aria-label="The Vyral Strain, a sculpted magenta logo with a circular cutout" ref={model}>
          <defs>
            <path id={shapeId} d={strainMark} fillRule="evenodd">
              <animate
                ref={morph}
                attributeName="d"
                values={strainPulse}
                keyTimes="0;.27;.57;1"
                keySplines=".16 .77 .28 1;.4 0 .24 1;.19 1 .22 1"
                calcMode="spline"
                dur="1.08s"
                begin="indefinite"
              />
            </path>
            <mask id={maskId}><use href={`#${shapeId}`} fill="white" /></mask>
          </defs>
          <g className="strain-volume" ref={body}>
            {layers.map((fill, index) => (
              <use key={fill} href={`#${shapeId}`} fill={fill} transform={`translate(${(layers.length - index) * 1.5} ${(layers.length - index) * 2.8})`} />
            ))}
            <use href={`#${shapeId}`} fill="#f936bf" />
            <g mask={`url(#${maskId})`}>
              <image href="./art/strain-640.webp" x="-27" y="-37" width="310" height="317" preserveAspectRatio="xMidYMid slice" className="strain-texture" />
              <use href={`#${shapeId}`} fill="none" stroke="#ffb0e6" strokeWidth="2.6" transform="translate(1 1)" />
            </g>
          </g>
        </svg>
        <span className="specimen-registration" aria-hidden="true" />
        <button type="button" className="specimen-pulse" onClick={sendPulse}>
          <span aria-hidden="true">◉</span> Pulse
        </button>
      </div>
      <figcaption className="eyebrow"><span>Fig. 01</span> The Strain <a href="#work" aria-label="Explore the Strain identity">↘</a></figcaption>
    </figure>
  );
}
