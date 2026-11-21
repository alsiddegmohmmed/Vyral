# Vyral Labs

Vyral Labs is a branding and digital growth agency in Kigali, Rwanda. The homepage introduces the studio and includes a five-question growth check. Visitors see which fixes to prioritize and can open a WhatsApp draft with their results.

## Run locally

Use Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Build and preview

```bash
npm run typecheck
npm run build
npm run preview
```

Open [localhost:4173](http://localhost:4173). The preview command uses Python 3 to serve the static export. To publish, upload the generated `out/` directory to a static host at the domain root. The old GitHub Pages instructions for publishing the repository root applied to the original HTML prototype.

## Edit the site

- `app/page.tsx` contains the homepage content.
- `app/site.css` contains the base design. `app/motion.css` contains the animated chapters and their responsive layouts.
- `app/strain.ts` contains the shared logo and its morph poses. `app/strain-specimen.tsx` contains the interactive hero artwork.
- `app/brand-data.ts` contains services, quiz questions, priorities and the WhatsApp number.
- `public/art/` contains the generated Strain artwork and studio concept visuals.
- `public/fonts/` contains locally hosted fonts and their licenses.

The Strain identity and campaign concept are studio examples. The growth check saves completed answers in the visitor’s browser. Opening the WhatsApp link prepares a draft for the visitor to send.

The header motion control pauses the visual effects. The site also follows the visitor’s system reduced-motion preference.
