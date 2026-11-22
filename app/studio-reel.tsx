'use client';

import { useRef, useState, type PointerEvent, type UIEvent } from 'react';
import { Mark } from './mark';

const studies = [
  {
    title: 'the strain',
    type: 'Vyral Labs print exploration',
    image: './art/strain-identity.webp',
    alt: 'Vyral Labs prints in hot pink, ink black and acid lime on textured ivory paper.',
    description: 'An organic mark that holds its own on screen, on paper and at the scale of a poster.',
  },
  {
    title: 'kigali in motion',
    type: 'Campaign concept',
    image: './art/kigali-campaign.webp',
    alt: 'A woman in a vivid jacket looks over the hills of Kigali.',
    description: 'A fashion campaign concept rooted in the city, designed to move from street posters to social.',
  },
  {
    title: 'after hours',
    type: 'Music launch concept',
    image: './art/after-hours.webp',
    alt: 'Layered magenta and acid-lime gig posters on a black concrete venue wall.',
    description: 'A night-time poster system for an imagined Kigali music launch, built for walls, sleeves and phone screens.',
  },
];

function snapPoints(track: HTMLDivElement) {
  const first = track.firstElementChild as HTMLElement;
  const end = track.scrollWidth - track.clientWidth;
  return Array.from(track.children, slide => Math.min((slide as HTMLElement).offsetLeft - first.offsetLeft, end));
}

function nearestStudy(track: HTMLDivElement) {
  const points = snapPoints(track);
  return points.reduce((nearest, offset, index) => (
    Math.abs(offset - track.scrollLeft) < Math.abs(points[nearest] - track.scrollLeft) ? index : nearest
  ), 0);
}

export default function StudioReel() {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [current, setCurrent] = useState(0);

  function select(index: number) {
    const track = rail.current;
    if (track) track.scrollTo({ left: snapPoints(track)[index] });
  }

  function updateSelection(event: UIEvent<HTMLDivElement>) {
    setCurrent(nearestStudy(event.currentTarget));
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !(event.target instanceof HTMLImageElement)) return;
    const track = event.currentTarget;
    drag.current = { x: event.clientX, left: track.scrollLeft };
    track.dataset.dragging = 'true';
    track.setPointerCapture(event.pointerId);
  }

  function dragProject(event: PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
    }
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const track = event.currentTarget;
    drag.current = null;
    delete track.dataset.dragging;
    select(nearestStudy(track));
  }

  return (
    <div className="studio-reel">
      <div className="reel-controls wrap" aria-label="Select a studio project">
        {studies.map((study, index) => (
          <button
            type="button"
            key={study.title}
            aria-controls="studio-reel"
            aria-pressed={current === index}
            onClick={() => select(index)}
          >
            <span aria-hidden="true">0{index + 1}</span> {study.title}
          </button>
        ))}
      </div>
      <div
        className="studio-studies"
        id="studio-reel"
        ref={rail}
        onScroll={updateSelection}
        onPointerDown={startDrag}
        onPointerMove={dragProject}
        onLostPointerCapture={finishDrag}
        tabIndex={0}
        role="region"
        aria-label="Studio projects, scroll horizontally"
      >
        {studies.map((study, index) => (
          <figure className="study" key={study.title} data-current={current === index}>
            <div className="study-image">
              <img src={study.image} alt={study.alt} width={1050} height={788} loading="lazy" draggable={false} />
            </div>
            <figcaption>
              <p className="eyebrow">{study.type}</p>
              <h3>{study.title}</h3>
              <p>{study.description}</p>
              <Mark />
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
