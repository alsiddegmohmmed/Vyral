import GrowthCheck, { AuditLink, GrowthCheckProvider } from './growth-check';
import { Mark } from './mark';
import StrainSpecimen from './strain-specimen';
import StudioReel from './studio-reel';
import MotionToggle from './motion-toggle';
import Services from './services';

const steps = [
  ['Tell us what you’re building.', 'Share your growth check on WhatsApp, or tell us about your business directly.'],
  ['We look at where you show up.', 'We review your identity, search, social and the channels your customers use.'],
  ['Get a short list of first moves.', 'Within 24 hours, we’ll send the changes we’d make first and why.'],
];

const faqs = [
  ['What’s in the free audit?', 'We look at your brand, social media, Google and Maps presence, AI visibility, and any ads you run. You get a short list of what we’d change first, sent through WhatsApp.'],
  ['Who do you work with?', 'We work with businesses in Kigali, from restaurants and shops to hotels, real estate and service businesses. Tell us what you do and what you want to grow.'],
  ['How much does ongoing work cost?', 'The audit is free. If you want help implementing it, we’ll quote based on your goal and the channels that matter.'],
  ['Do I need to be on Instagram?', 'It depends on how your customers find you. Google, Maps, WhatsApp and your website can all play a role. The audit helps you choose where to focus.'],
];

function Wordmark() {
  return (
    <a href="#top" className="wordmark" aria-label="Vyral Labs home">
      <Mark />
      <span>vyral<span className="wordmark-labs">labs</span></span>
    </a>
  );
}

export default function Home() {
  return (
    <GrowthCheckProvider>
      <a href="#main" className="skip">Skip to content</a>
      <header className="site-header wrap" id="top">
        <Wordmark />
        <nav aria-label="Main navigation">
          <a href="#work">Studio</a>
          <a href="#services">Services</a>
          <a href="#process">Process</a>
        </nav>
        <div className="header-actions">
          <MotionToggle />
          <a className="header-cta" href="#contact">Let’s talk <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      <main id="main">
        <section className="hero wrap" aria-labelledby="headline">
          <div className="hero-copy">
            <p className="eyebrow hero-location"><span className="status-dot" /> Kigali, Rwanda</p>
            <h1 id="headline"><span><b>Make your</b></span> <span><b>brand</b></span> <span><b>spread<span className="hero-period">.</span></b></span></h1>
            <p className="hero-description">We build brands, launch campaigns and help businesses get seen, found and chosen.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#growth-check">
                Take the growth check <span className="button-icon" aria-hidden="true">↘</span>
              </a>
              <span className="eyebrow hero-duration">Free<br />30 seconds</span>
            </div>
          </div>

          <StrainSpecimen />
        </section>

        <a className="signal-band" href="#services" aria-label="Explore branding and digital growth services">
          <div className="signal-track" aria-hidden="true">
            <div className="signal-marquee" data-loop>
              {[0, 1, 2, 3].map(index => (
                <div className="signal-words" key={index}>
                  <span>Get seen</span><Mark /><span>Get found</span><Mark /><span>Get chosen</span><Mark />
                </div>
              ))}
            </div>
          </div>
          <span className="signal-arrow" aria-hidden="true">↘</span>
        </a>

        <section className="work" id="work" aria-labelledby="work-title">
          <div className="section-intro wrap">
            <div>
              <p className="eyebrow section-label">Inside the studio</p>
              <h2 id="work-title"><span>From mark</span><br /><span>to market.</span></h2>
            </div>
            <p>Our own identity and a campaign concept show how an idea can take shape across different formats.</p>
          </div>
          <StudioReel />
        </section>

        <Services />

        <section id="growth-check" className="growth" aria-labelledby="growth-title">
          <div className="growth-scan" aria-hidden="true">
            <Mark /><Mark /><Mark />
          </div>
          <div className="wrap growth-layout">
            <div className="growth-intro">
              <p className="eyebrow section-label">Free growth check</p>
              <h2 id="growth-title">Find your<br />first move<span>.</span></h2>
              <p>Five questions about how customers see, find and buy from you. Get a list of what to fix first.</p>
              <Mark className="growth-mark" />
            </div>
            <GrowthCheck />
          </div>
        </section>

        <section className="process wrap" id="process" aria-labelledby="process-title">
          <div className="section-intro">
            <div>
              <p className="eyebrow section-label">The free audit</p>
              <h2 id="process-title">From check<br />to action.</h2>
            </div>
            <p>The growth check gives you a starting point. The free WhatsApp audit gives you a closer look from our team.</p>
          </div>
          <ol className="steps">
            {steps.map(([title, description], index) => (
              <li key={title}>
                <Mark className="step-mark" />
                <span className="eyebrow step-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="faq wrap" aria-labelledby="faq-title">
          <h2 id="faq-title">Good questions.</h2>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span className="disclosure" aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing" id="contact" aria-labelledby="contact-title">
          <div className="wrap closing-layout">
            <div>
              <p className="eyebrow section-label">Let’s talk</p>
              <h2 id="contact-title">Your brand,<br />next.</h2>
              <p>Tell us what you’re building. We’ll find a place to start.</p>
            </div>
            <AuditLink />
            <div className="closing-art" aria-hidden="true">
              <Mark className="closing-mark" />
              <Mark className="closing-contour closing-contour-one" />
              <Mark className="closing-contour closing-contour-two" />
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer wrap">
        <Wordmark />
        <p>Branding &amp; digital growth in Kigali</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </GrowthCheckProvider>
  );
}
