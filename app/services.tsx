'use client';

import { useState } from 'react';
import { services } from './brand-data';
import { ServiceArt } from './service-art';

export default function Services() {
  const [mode, setMode] = useState(services[0].id);

  return (
    <section className="services wrap" id="services" aria-labelledby="services-title" data-mode={mode}>
      <div className="services-intro">
        <p className="eyebrow section-label">What we do</p>
        <h2 id="services-title">what we<br />do.</h2>
        <p>Start with a brand launch, reach more people, or make it easier for customers to inquire and book. We can help with one project or support you across channels.</p>
        <ServiceArt />
      </div>
      <div className="service-list">
        {services.map((group, index) => (
          <details
            className="service"
            id={group.id}
            key={group.title}
            open={index === 0}
            onToggle={event => {
              if (event.currentTarget.open) setMode(group.id);
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
