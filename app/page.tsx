import GrowthCheck, { AuditLink, GrowthCheckProvider } from './growth-check';
import { Mark } from './mark';
import { email, instagram, whatsappDisplay, chatLink } from './brand-data';
import HeroExhibit, { DemoGallery, WorkExamples } from './hero-exhibit';
import MotionToggle from './motion-toggle';
import BrandIntro from './brand-intro';
import Services from './services';
import FieldNotes from './field-notes';
import './hero.css';
import './scroll-scenes.css';

const steps = [
  ['Tell us what needs to change.', 'Share what you sell, who you want to reach, and whether the priority is a launch, visibility or more inquiries.'],
  ['Review the direction.', 'We agree on the channels and deliverables, then show you the first creative or campaign plan for feedback.'],
  ['Launch and learn.', 'You approve the work before it goes live. For ongoing campaigns, we review what people respond to and adjust the next round.'],
];

const faqs = [
  ['Can you work with an existing brand?', 'Yes. We can build a campaign using your current identity or help refresh it before a launch.'],
  ['Can I start with one project?', 'Yes. Start with a brand kit, launch campaign, landing page, menu or catalog. We can also help with ongoing content and advertising.'],
  ['Do I need to book a photoshoot?', 'We can work with phone photos and clips you already have. For product, menu and catalog edits, the dish, product and quantity should match what customers receive.'],
  ['What’s in the free audit?', 'We review how your business shows up online and send a short list of what we’d change first through WhatsApp.'],
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
      <DemoGallery>
      <BrandIntro />
      <a href="#main" className="skip">Skip to content</a>
      <header className="landing-header" id="top">
        <div className="site-header wrap">
          <Wordmark />
          <nav aria-label="Main navigation">
            <a href="#work">work</a>
            <a href="#services">services</a>
            <a href="#process">process</a>
          </nav>
          <div className="header-actions">
            <MotionToggle />
            <a className="header-cta" href="#contact">let’s talk <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </header>
      <main id="main">
        <div className="scroll-track" aria-hidden="true" />
        <section className="hero" aria-labelledby="headline">
          <div className="hero-copy wrap">
            <p className="hero-location"><span className="status-dot" /> Branding and digital growth in Kigali</p>
            <h1 id="headline" tabIndex={-1}>build your brand.<br />get seen<span className="hero-period">.</span></h1>
            <p className="hero-description">We build brands, launch campaigns and help businesses get found, get chosen and turn interest into inquiries.</p>
            <div className="hero-actions">
              <a className="button hero-primary" href="#work">
                see our work <span className="button-icon" aria-hidden="true">↘</span>
              </a>
              <a className="hero-secondary" href="#growth-check">take the free growth check <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <HeroExhibit />
        </section>

        <a className="signal-band" href="#services" aria-label="Explore branding and digital growth services">
          <div className="signal-track" aria-hidden="true">
            <div className="signal-marquee" data-loop>
              {[0, 1, 2, 3].map(index => (
                <div className="signal-words" key={index}>
                  <span>get seen</span><Mark /><span>get found</span><Mark /><span>get chosen</span><Mark />
                </div>
              ))}
            </div>
          </div>
          <span className="signal-arrow" aria-hidden="true">↘</span>
        </a>

        <section className="work" id="work" aria-labelledby="work-title">
          <div className="work-contours" aria-hidden="true"><Mark /><Mark /><Mark /></div>
          <div className="section-intro wrap">
            <div>
              <h2 id="work-title"><span>selected</span><br /><span>work.</span></h2>
            </div>
            <p>Brand launches, websites and campaigns. Open a project to see the final design alongside the brief or starting image.</p>
          </div>
          <WorkExamples />
        </section>

        <Services />

        <section id="growth-check" className="growth" aria-labelledby="growth-title">
          <div className="growth-sweep" aria-hidden="true" />
          <div className="growth-scan" aria-hidden="true">
            <Mark /><Mark /><Mark />
          </div>
          <div className="wrap growth-layout">
            <div className="growth-intro">
              <p className="eyebrow section-label">Free growth check</p>
              <h2 id="growth-title">find your<br />first move<span>.</span></h2>
              <p>Five questions about how customers see, find and buy from you. Get a list of what to fix first.</p>
              <Mark className="growth-mark" />
            </div>
            <GrowthCheck />
          </div>
        </section>

        <section className="process wrap" id="process" aria-labelledby="process-title">
          <div className="section-intro">
            <div>
              <h2 id="process-title">from brief<br />to launch.</h2>
            </div>
            <p>Start with a business goal. We’ll help turn it into a clear plan, then build the work and get it out into the world.</p>
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
          <h2 id="faq-title">good questions.</h2>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span className="disclosure" aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <FieldNotes />

        <section className="closing" id="contact" aria-labelledby="contact-title">
          <div className="closing-rings" aria-hidden="true"><span /><span /><span /></div>
          <div className="wrap closing-layout">
            <div>
              <p className="eyebrow section-label">Let’s talk</p>
              <h2 id="contact-title">your brand,<br />next.</h2>
              <p>Tell us what you’re launching or where growth is stuck. We’ll help you choose a place to start.</p>
            </div>
            <div className="closing-contact">
              <AuditLink />
              <p className="contact-alt">Prefer email? <a href={`mailto:${email}`}>{email}</a></p>
              <p className="contact-alt">Follow us on Instagram <a href={instagram.url} target="_blank" rel="noopener noreferrer">{instagram.handle}</a></p>
            </div>
            <div className="closing-art" aria-hidden="true">
              <Mark className="closing-mark" />
              <Mark className="closing-contour closing-contour-one" />
              <Mark className="closing-contour closing-contour-two" />
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="site-footer wrap">
          <Wordmark />
          <div className="footer-contact">
            <span>Kigali, Rwanda</span>
            <a href={chatLink('Hi Vyral, I’d like to talk about my business.')} target="_blank" rel="noopener noreferrer">WhatsApp {whatsappDisplay}</a>
            <a href={`mailto:${email}`}>{email}</a>
            <a href={instagram.url} target="_blank" rel="noopener noreferrer">Instagram {instagram.handle}</a>
          </div>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
      </DemoGallery>
    </GrowthCheckProvider>
  );
}
