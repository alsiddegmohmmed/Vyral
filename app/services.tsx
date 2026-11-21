'use client';

import { useState } from 'react';
import { services } from './brand-data';
import { ServiceArt } from './service-art';

export default function Services() {
  const [mode, setMode] = useState(0);

  return (
    <section className="services wrap" id="services" aria-labelledby="services-title" data-mode={mode}>
      <div className="services-intro">
        <p className="eyebrow section-label">What we do</p>
        <h2 id="services-title">Where do you<br />want to grow?</h2>
        <p>Start with the outcome you need. We’ll connect the channels your customers already use.</p>
        <ServiceArt />
      </div>
      <div className="service-list">
        {services.map((group, index) => (
          <details
            className="service"
            key={group.title}
            open={index === 0}
            onToggle={event => {
              if (event.currentTarget.open) setMode(index);
            }}
          >
            <summary>
              <span className="eyebrow service-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{group.title}</span>
              <span className="disclosure" aria-hidden="true" />
            </summary>
            <ul>
              {group.items.map(item => (
                <li key={item.name}><strong>{item.name}</strong><p>{item.description}</p></li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
