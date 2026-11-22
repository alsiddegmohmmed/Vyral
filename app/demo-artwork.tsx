import type { CapabilityDemo } from './capability-demos';

export function DemoArtwork({ demo, loading }: { demo: CapabilityDemo; loading?: 'lazy' }) {
  if (demo.id === 'launch') {
    return (
      <div className="demo-canvas demo-launch">
        <div className="demo-launch-identity">
          <p>Campaign identity</p>
          <strong>after<br />light<span>.</span></strong>
          <div className="demo-launch-colors" aria-label="Campaign colors"><span /><span /><span /></div>
        </div>
        <div className="demo-launch-poster">
          <img src={demo.image} width={demo.imageSize[0]} height={demo.imageSize[1]} alt={demo.alt} loading={loading} />
          <strong>Kigali<br />after dark.</strong>
          <p>Afterlight launch poster</p>
        </div>
      </div>
    );
  }

  if (demo.id === 'website') {
    return (
      <div className="demo-canvas demo-website">
        <div className="demo-website-browser">
          <div className="demo-website-toolbar">
            <span aria-hidden="true">•••</span>
            <b>Kigali in Motion</b>
            <span>Collection</span>
          </div>
          <div className="demo-website-feature">
            <img src={demo.image} width={demo.imageSize[0]} height={demo.imageSize[1]} alt={demo.alt} loading={loading} />
            <div>
              <p>The Kigali collection</p>
              <strong>made for<br />the city.</strong>
              <span>Ask about availability ↗</span>
            </div>
          </div>
          <div className="demo-website-note"><b>Pick your piece.</b><span>Check availability on WhatsApp for pickup in Kigali.</span></div>
        </div>
      </div>
    );
  }

  if (demo.id === 'menu') {
    return (
      <div className="demo-canvas demo-menu">
        <div className="demo-menu-heading">
          <p>Lunch menu</p>
          <strong>Today’s<br />special</strong>
        </div>
        <img src={demo.image} width={800} height={800} alt={demo.alt} loading={loading} />
        <div className="demo-menu-item">
          <div><b>Grilled chicken bowl</b><p>Seasoned rice and cucumber slaw</p></div>
          <strong>8,500 RWF</strong>
        </div>
        <p className="demo-menu-order">Orders on WhatsApp</p>
      </div>
    );
  }

  if (demo.id === 'catalog') {
    return (
      <div className="demo-canvas demo-catalog">
        <div className="demo-catalog-heading"><p>Product catalog</p><strong>House roast</strong></div>
        <img src={demo.image} width={800} height={800} alt={demo.alt} loading={loading} />
        <div className="demo-catalog-item">
          <div><b>Ground coffee</b><p>250 g</p></div>
          <strong>9,000 RWF</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-canvas demo-ads">
      <figure>
        <div className="demo-ad-creative demo-ad-feed">
          <img src={demo.image} width={800} height={800} alt={demo.alt} loading={loading} />
          <strong>Hibiscus<br />over ice.</strong>
          <span>See the drinks menu →</span>
        </div>
        <figcaption>Square feed ad</figcaption>
      </figure>
      <figure>
        <div className="demo-ad-creative demo-ad-story">
          <strong>Cool<br />off.</strong>
          <img src={demo.image} width={800} height={800} alt="" loading={loading} />
          <span>See drinks menu →</span>
        </div>
        <figcaption>Vertical Story ad</figcaption>
      </figure>
    </div>
  );
}
