import { strainMark, strainPulse } from './strain';
import './brand-intro.css';

// Run from the initial HTML so the first frame can appear before React hydrates.
const playIntro = `
(() => {
  const intro = document.getElementById('brand-intro');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navigation = performance.getEntriesByType('navigation')[0]?.type;
  if (typeof intro?.showModal !== 'function' || reducedMotion.matches ||
      navigation === 'back_forward' || (location.hash && navigation !== 'reload')) return;

  try {
    if (localStorage.getItem('vyral-motion') === 'off') return;
  } catch {
    // The intro can still play if storage is unavailable.
  }

  intro.showModal();
  const finish = () => intro.close();
  const timeout = window.setTimeout(finish, 4000);
  const motionChanged = event => { if (event.matches) finish(); };

  intro.addEventListener('cancel', event => {
    event.preventDefault();
    intro.close('skip');
  }, { once: true });
  intro.addEventListener('close', () => {
    window.clearTimeout(timeout);
    window.removeEventListener('pagehide', finish);
    reducedMotion.removeEventListener('change', motionChanged);
    if (intro.returnValue === 'skip' && scrollY === 0) {
      document.getElementById('headline')?.focus({ preventScroll: true });
    }
  }, { once: true });
  window.addEventListener('pagehide', finish, { once: true });
  reducedMotion.addEventListener('change', motionChanged);

  intro.querySelector('animate')?.beginElement?.();
})();
`;

export default function BrandIntro() {
  return (
    <>
      <dialog id="brand-intro" className="brand-intro" aria-label="Vyral Labs opening animation" suppressHydrationWarning>
        <div className="brand-intro-panels" aria-hidden="true" />
        <svg className="brand-intro-mark" viewBox="0 0 256 256" aria-hidden="true">
          <defs>
            <linearGradient id="intro-pink" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
              <stop stopColor="#ff7ad9" />
              <stop offset=".42" stopColor="#ff3dcb" />
              <stop offset="1" stopColor="#d51893" />
            </linearGradient>
          </defs>
          <circle className="brand-intro-orbit" cx="128" cy="128" r="123" />
          <path className="brand-intro-echo brand-intro-echo-back" d={strainMark} />
          <path className="brand-intro-echo" d={strainMark} />
          <path className="brand-intro-fill" d={strainMark} fillRule="evenodd" fill="url(#intro-pink)">
            <animate attributeName="d" begin="indefinite" dur="2.55s" values={strainPulse}
              keyTimes="0;.29;.75;1" calcMode="spline" keySplines=".2 .72 .22 1;.4 0 .2 1;.2 .72 .22 1" />
          </path>
          <circle className="brand-intro-core" cx="160" cy="97" r="5" />
        </svg>
        <div className="brand-intro-type" aria-hidden="true">
          <span>vyral<span>labs</span></span>
          <i />
        </div>
        <form method="dialog" className="brand-intro-skip">
          <button type="submit" value="skip">Skip intro <span aria-hidden="true">↗</span></button>
        </form>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: playIntro }} />
    </>
  );
}
