import { Mark } from './mark';
import './field-notes.css';

export default function FieldNotes() {
  return (
    <section className="field-notes" aria-labelledby="field-title">
      <div className="field-stage">
        <div className="field-media" aria-hidden="true">
          <div className="field-shot field-day">
            <img src="/art/kigali-day.webp" width={1440} height={811} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="field-shot field-night">
            <img src="/art/kigali-night.webp" width={1440} height={811} alt="" loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="field-content wrap">
          <div className="field-index">
            <p className="eyebrow"><Mark /> Field notes from Kigali</p>
          </div>
          <div className="field-copy">
            <h2 id="field-title">good ideas<br />don’t sit still<span>.</span></h2>
            <p>From a street poster to the screen in your hand, we make work that moves with the city.</p>
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
