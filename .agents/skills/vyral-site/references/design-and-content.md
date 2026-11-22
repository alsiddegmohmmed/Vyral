# Design and content

## Brand and homepage

- The Strain is a magenta organic silhouette with a circular cutout. Use the shared paths in `app/strain.ts` and `app/mark.tsx` so the small wordmark, opening animation, and decorative treatments retain one identity.
- Syne and Schibsted Grotesk are brand requirements. Preserve the local files and licenses in `public/fonts/`. Use the existing dark plum, paper, magenta, and lime tokens in `app/site.css`. Pair the loud colors with quiet areas so highlights retain meaning.
- The owner rejected the conventional hero split with text on one side and one oversized sculpture on the other. The current direction uses a centered promise and clickable project images around it, with a horizontal gallery on narrow screens. Keep the main line and actions legible as the imagery moves.
- The human-led images, including the Afterlight dancer and the woman in red above Kigali, give the site personality. Reuse them where they fit. If a task needs new media, commission imagery for a specific project or story. A generic brand asset is rarely enough reason to create a portfolio entry.
- Vary the rhythm across the homepage. A clear hero, tactile project previews, legible services, and the daylight-to-night Field Notes scene have different jobs. Give each major section one dominant motion idea.

## The portfolio and offer

- Write about **Selected work** using the project's name, category, goal, and observable design choices. Current projects are Afterlight, Kigali in Motion, Today’s Special, House Roast, and Hibiscus Over Ice. The pieces are studio work. Make claims about real clients, launches, ad results, or integrations only when supported.
- Each project click should deliver something specific. Show the final design and explain the choices. Keep the project brief or starting image available where it helps visitors compare. Carry the project name into its relevant inquiry. Use the same vocabulary in cards, buttons, accessible labels, and WhatsApp drafts.
- Menus and catalogs are a capability within the agency. Balance them with brand identity and launches, social content and reels, Meta ads, Google Search and Maps, visibility in AI answers, Google Ads, landing pages, WhatsApp Business flows, and email. Use `app/brand-data.ts` for the current offering.
- Use concrete verbs and outcomes. The homepage serves local businesses and should make it easy to recognize the right service or take the next step. Avoid filler, duplicate labels, and unsupported growth claims.

## What transferred from the design research

- The [MotionSites Studio study](https://studio.motionsites.ai/) observed a restrained shell around expressive work, a clear path from choosing a design into the next action, and substantial mobile layouts. For Vyral, that means using a stable reading and navigation layer, selecting media with a purpose, and carrying the selected project into its details and inquiry. The inspected full-size MotionSites previews were videos. Observing them did not verify the depicted interactions or conversion outcomes.
- [Kenji Lambert](https://www.kenjilambert.com/) was an owner-supplied reference for an expressive, motion-led portfolio. Bring that ambition to Vyral's own choreography, with strong section handoffs and a readable resting frame. Keep the site visually distinct.
- The owner’s original concept established the logo direction and brand tone. Use it as background on intent. Use the current repository for the accepted layout and interactions.
