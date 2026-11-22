'use client';

import { createContext, useContext, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { chatLink } from './brand-data';
import { capabilityDemos } from './capability-demos';
import { DemoArtwork } from './demo-artwork';
import { Mark } from './mark';
import './demos.css';

const OpenDemo = createContext<(index: number, button: HTMLButtonElement) => void>(() => {});

function allowsMotion() {
  return document.documentElement.dataset.motion !== 'off'
    && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

function artworkPose(origin: DOMRect, stage: HTMLElement) {
  const target = stage.getBoundingClientRect();
  if (!target.width || !target.height || !origin.width || !origin.height ||
      origin.bottom <= 0 || origin.top >= window.innerHeight) return null;

  return `translate(${origin.left - target.left}px, ${origin.top - target.top}px) scale(${origin.width / target.width}, ${origin.height / target.height})`;
}

function appearance(element: HTMLElement) {
  const { opacity, transform } = getComputedStyle(element);
  return { opacity, transform };
}

const enterEase = 'cubic-bezier(.19,.76,.24,1)';
const exitEase = 'cubic-bezier(.4,0,.2,1)';

export function DemoGallery({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const [source, setSource] = useState(false);
  const demo = active === null ? null : capabilityDemos[active];
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const opener = useRef<{
    button: HTMLButtonElement;
    artwork: HTMLElement;
    bounds: DOMRect;
    index: number;
    photo?: { src: string; position: string };
  }>(null);
  const animations = useRef<Animation[]>([]);
  const closing = useRef(false);
  const swap = useRef<'next' | 'previous' | 'compare' | undefined>(undefined);

  function cancelMotion() {
    for (const animation of animations.current) animation.cancel();
    animations.current = [];
  }

  useLayoutEffect(() => {
    const modal = dialog.current;
    if (active === null || !modal || modal.open) return;
    modal.scrollTop = 0;
    modal.showModal();
    if (!allowsMotion() || !stage.current || !frame.current || !scrim.current || !opener.current) return;

    const from = artworkPose(opener.current.bounds, stage.current);
    const parts = modal.querySelectorAll<HTMLElement>('[data-viewer-part]');
    animations.current = [
      scrim.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: enterEase }),
      frame.current.animate([
        { transform: from ?? 'translateY(24px) scale(.96)', opacity: from && photo.current ? 1 : .35 },
        { transform: 'none', opacity: 1 },
      ], { duration: 540, easing: enterEase }),
      ...Array.from(parts, (part, index) => part.animate([
        { opacity: 0, transform: 'translateY(15px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 340, delay: 85 + 38 * index, easing: enterEase, fill: 'backwards' })),
    ];
    if (photo.current && from) animations.current.push(photo.current.animate([
      { opacity: 1 }, { opacity: 1, offset: .18 }, { opacity: 0 },
    ], { duration: 450, easing: 'ease-in-out' }));
  }, [active]);

  function openDemo(index: number, button: HTMLButtonElement) {
    const artwork = button.closest('.demo-example')?.querySelector<HTMLElement>('.demo-example-art') ?? button;
    const thumbnail = button.querySelector('img');
    opener.current = {
      button, artwork, bounds: artwork.getBoundingClientRect(), index,
      photo: thumbnail ? { src: thumbnail.currentSrc || thumbnail.src, position: getComputedStyle(thumbnail).objectPosition } : undefined,
    };
    swap.current = undefined;
    setSource(false);
    setActive(index);
  }

  function closeDemo() {
    const modal = dialog.current;
    if (!modal?.open || closing.current) return;
    if (!allowsMotion() || !stage.current || !frame.current || !scrim.current) {
      modal.close();
      return;
    }

    closing.current = true;
    const launch = opener.current;
    const to = launch?.index === active ? artworkPose(launch.artwork.getBoundingClientRect(), stage.current) : null;
    const liveFrame = appearance(frame.current);
    const livePhoto = photo.current ? getComputedStyle(photo.current).opacity : '0';
    const liveScrim = getComputedStyle(scrim.current).opacity;
    const parts = Array.from(modal.querySelectorAll<HTMLElement>('[data-viewer-part]'), part => ({
      part, current: appearance(part),
    }));
    cancelMotion();
    const timing = { duration: 320, easing: exitEase, fill: 'forwards' } as const;
    const returnFlight = frame.current.animate([
      liveFrame,
      { transform: to ?? 'translateY(15px) scale(.96)', opacity: to && photo.current ? 1 : 0 },
    ], timing);
    animations.current = [
      returnFlight,
      scrim.current.animate([{ opacity: liveScrim }, { opacity: 0 }], timing),
      ...parts.map(({ part, current }) => part.animate([
        current, { opacity: 0, transform: 'translateY(9px)' },
      ], { ...timing, duration: 180 })),
    ];
    if (photo.current && to) animations.current.push(photo.current.animate([
      { opacity: livePhoto }, { opacity: 1 },
    ], timing));
    void returnFlight.finished.then(() => modal.close(), () => {});
  }

  function step(offset: number) {
    if (active === null || closing.current) return;
    swap.current = offset > 0 ? 'next' : 'previous';
    setActive((active + offset + capabilityDemos.length) % capabilityDemos.length);
    setSource(false);
  }

  function compare(next: boolean) {
    if (source === next || closing.current) return;
    swap.current = 'compare';
    setSource(next);
  }

  return (
    <OpenDemo.Provider value={openDemo}>
      {children}
      <dialog
        className="hero-study demo-viewer"
        ref={dialog}
        aria-labelledby="hero-study-heading"
        onClick={event => { if (event.target === event.currentTarget) closeDemo(); }}
        onCancel={event => {
          event.preventDefault();
          closeDemo();
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
        onClose={() => {
          cancelMotion();
          closing.current = false;
          opener.current?.button.focus({ preventScroll: true });
          opener.current = null;
          setActive(null);
        }}
      >
        <div className="demo-viewer-scrim" ref={scrim} aria-hidden="true" />
        {demo && active !== null && (
          <div className="hero-study-shell">
            <div className="hero-study-toolbar" data-viewer-part>
              <span aria-live="polite">Project {active + 1} of {capabilityDemos.length}</span>
              <div className="hero-study-nav" role="group" aria-label="Browse projects">
                <button type="button" onClick={() => step(-1)} aria-label="Previous project">←</button>
                <button type="button" onClick={() => step(1)} aria-label="Next project">→</button>
                <button type="button" className="demo-viewer-close" onClick={closeDemo} aria-label="Close project" autoFocus>×</button>
              </div>
            </div>
            <div className="demo-viewer-layout">
              <div className="demo-viewer-visual">
                <div className="demo-viewer-mat" data-viewer-part aria-hidden="true" />
                <div className="demo-switch" data-viewer-part role="group" aria-label="Project views">
                  <button type="button" aria-pressed={!source} onClick={() => compare(false)}>Final design</button>
                  <button type="button" aria-pressed={source} onClick={() => compare(true)}>{'brief' in demo ? 'Project brief' : 'Starting image'}</button>
                </div>
                <div className="demo-viewer-media" ref={stage}>
                  <div className="demo-viewer-frame" ref={frame}>
                    {opener.current?.photo && (
                      <img className="demo-flight-photo" ref={photo} src={opener.current.photo.src} alt=""
                        style={{ objectPosition: opener.current.photo.position }} aria-hidden="true" />
                    )}
                    <div className="demo-viewer-content" data-swap={swap.current} key={`${demo.id}-${source}`}>
                      {source && 'brief' in demo ? (
                        <div className="demo-brief">
                          <span>Project brief</span>
                          <strong>{demo.title}</strong>
                          <p>{demo.brief}</p>
                        </div>
                      ) : source ? (
                        <img className="demo-source" src={demo.image} width={800} height={800} alt={demo.alt} />
                      ) : <DemoArtwork demo={demo} />}
                    </div>
                  </div>
                </div>
              </div>
              <div className="demo-viewer-info" data-viewer-part>
                <p className="demo-disclosure">{demo.category}</p>
                <h2 id="hero-study-heading">{demo.title}</h2>
                <p>{demo.output}</p>
                <div className="demo-viewer-details">
                  <h3>Project goal</h3>
                  <p>{demo.goal}</p>
                  <h3>Design details</h3>
                  <ul>{demo.deliverables.map(item => <li key={item}>{item}</li>)}</ul>
                </div>
                <a className="button demo-contact" href={chatLink(demo.message)} target="_blank" rel="noopener noreferrer">
                  {demo.contact} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </OpenDemo.Provider>
  );
}

export default function HeroExhibit() {
  const openDemo = useContext(OpenDemo);
  const board = useRef<HTMLDivElement>(null);

  function moveBoard(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !allowsMotion() || !window.matchMedia('(min-width: 761px)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    board.current?.style.setProperty('--atlas-x', `${x * 34}px`);
    board.current?.style.setProperty('--atlas-y', `${y * 24}px`);
  }

  return (
    <div className="hero-atlas" onPointerMove={moveBoard} onPointerLeave={() => board.current?.removeAttribute('style')}>
      <div className="hero-atlas-board" ref={board} role="group" aria-label="Featured projects">
        {capabilityDemos.map((demo, index) => 'heroSlot' in demo && (
          <button
            type="button"
            className={`hero-tile hero-tile-${demo.heroSlot}`}
            key={demo.id}
            aria-label={`Open ${demo.title} project`}
            aria-haspopup="dialog"
            onClick={event => openDemo(index, event.currentTarget)}
          >
            <img src={demo.image} alt="" width={'imageSize' in demo ? demo.imageSize[0] : 800} height={'imageSize' in demo ? demo.imageSize[1] : 800} decoding="async" draggable={false} />
            <span className="hero-tile-label">{demo.title}</span>
            <span className="hero-tile-open" aria-hidden="true">↗</span>
          </button>
        ))}
        <div className="hero-atlas-stamp" aria-hidden="true"><Mark /></div>
      </div>
      <p className="hero-atlas-caption">Open a featured project</p>
    </div>
  );
}

export function WorkExamples() {
  const openDemo = useContext(OpenDemo);

  return (
    <div className="demo-grid wrap">
      {capabilityDemos.map((demo, index) => (
        <article className="demo-example" key={demo.id}>
          <div className="demo-example-art">
            <div className="demo-reveal-art"><DemoArtwork demo={demo} loading="lazy" /></div>
            <span className="demo-shutters" aria-hidden="true"><i /><i /><i /></span>
          </div>
          <p className="demo-audience">{demo.category}</p>
          <h3>{demo.title}</h3>
          <p>{demo.output}</p>
          <button className="demo-open-link" type="button" aria-label={`View project ${demo.title}`} aria-haspopup="dialog" onClick={event => openDemo(index, event.currentTarget)}>
            View project <span aria-hidden="true">↗</span>
          </button>
        </article>
      ))}
    </div>
  );
}
