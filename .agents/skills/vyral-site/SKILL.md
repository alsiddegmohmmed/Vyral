---
name: vyral-site
description: Build, revise, and verify the Vyral Labs website in this repository. Use for changes to its home page, portfolio, branding, copy, animations, Growth Check, mobile experience, or local and Cloudflare previews.
---

# Vyral Site

Vyral Labs is a Kigali branding and digital growth agency. Visitors should quickly understand what the studio offers, explore its work, and find a next step through the Growth Check or contact.

## Work in the current project

Start with the current checkout, `README.md`, and the files that own the requested behavior. The site is a Next.js App Router static export. `app/page.tsx` assembles the homepage, `app/brand-data.ts` owns service and quiz content, and `public/` holds the images and locally hosted fonts. Read the working-tree diff before editing. Prior work may be present outside the last commit.

Make focused edits and use the current implementation as the source of truth. Preserve the shared Strain mark, Syne display type, and Schibsted Grotesk body type unless the owner requests a change. For design decisions, favor a centered, editorial composition with expressive project imagery and a clear path into the work.

## Read the relevant reference

- [Design and content](references/design-and-content.md) for the hero, portfolio, service positioning, brand direction, or new imagery.
- [Motion and interaction](references/motion-and-interaction.md) for the intro, scrolling, project viewer, Growth Check, or mobile fixes.
- [Verification and preview](references/verification-and-preview.md) for browser acceptance, static export, or a requested public tunnel.

## Finish with evidence

For application changes, run the checks needed for the affected paths. Test interactive changes through the normal visitor entry point at desktop and phone widths, including the relevant motion settings. Report the actual device or emulation used and the limits of the evidence. Share a verified preview when requested.

Keep changes local for review unless the owner authorizes a push or deployment. A request for a temporary Cloudflare preview authorizes serving the static build through that tunnel.
