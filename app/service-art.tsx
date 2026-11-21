import { strainMark } from './strain';

export function ServiceArt() {
  return (
    <div className="service-art" aria-hidden="true">
      <svg viewBox="0 0 480 245">
        <defs><path id="service-strain" d={strainMark} fillRule="evenodd" /></defs>
        <g className="service-art-grid">
          <path d="M0 122.5H480M240 0V245" />
          <ellipse cx="240" cy="122.5" rx="154" ry="89" />
          <ellipse cx="240" cy="122.5" rx="108" ry="71" />
          <ellipse cx="240" cy="122.5" rx="67" ry="52" />
        </g>
        <g className="service-art-mode service-art-brand">
          <use href="#service-strain" x="20" y="-36" transform="scale(.62) translate(241 101)" />
          <use href="#service-strain" x="37" y="-22" transform="scale(.62) translate(241 101)" className="service-art-outline" />
          <use href="#service-strain" x="54" y="-8" transform="scale(.62) translate(241 101)" className="service-art-outline" />
        </g>
        <g className="service-art-mode service-art-social">
          <use href="#service-strain" className="service-art-outline" transform="translate(109 42) scale(.62)" />
          <use href="#service-strain" className="service-art-outline" transform="translate(212 85) scale(.43)" />
          <use href="#service-strain" transform="translate(271 36) scale(.50)" />
          <use href="#service-strain" transform="translate(65 123) scale(.22)" />
        </g>
        <g className="service-art-mode service-art-search">
          <use href="#service-strain" transform="translate(202 84) scale(.30)" />
          <circle cx="240" cy="122.5" r="45" className="service-art-outline" />
          <circle cx="240" cy="122.5" r="79" className="service-art-outline" />
          <path d="M240 122.5L363 40M240 122.5L123 177M240 122.5V18" className="service-art-outline" />
          <circle cx="363" cy="40" r="6" /><circle cx="123" cy="177" r="6" /><circle cx="240" cy="18" r="6" />
        </g>
        <g className="service-art-mode service-art-convert">
          <use href="#service-strain" className="service-art-outline" transform="translate(73 119) scale(.16)" />
          <use href="#service-strain" className="service-art-outline" transform="translate(138 100) scale(.26)" />
          <use href="#service-strain" className="service-art-outline" transform="translate(218 66) scale(.45)" />
          <use href="#service-strain" transform="translate(320 28) scale(.67)" />
        </g>
      </svg>
    </div>
  );
}
