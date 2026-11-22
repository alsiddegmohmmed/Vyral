# Verification and preview

Use `npm run build` followed by `npm run typecheck` for changes to the application. `git diff --check` catches whitespace errors. `npm run dev` is useful during development. `npm run preview` serves the built `out/` directory at `http://127.0.0.1:4173/` through Python. The local preview changes after a rebuild when the server is already serving `out/`. Check the port and served version before starting another process.

Match browser checks to the risk of the change. At least one desktop width near 1440 px and one phone width near 390 px give useful coverage for shared UI. Add 320 px when adjusting narrow layouts and a tablet width when changing breakpoints. Test pointer and keyboard flows when relevant.

| Change | Evidence to collect |
| --- | --- |
| Hero or responsive design | Readable headline, visible actions, no page-wide horizontal overflow, images load, gallery can be swiped on phones. |
| Intro or scrolling | Load, reload, skip, deep link, reverse direction, and interrupt scroll with a link. Check Motion off and OS reduced motion when those paths change. |
| Project viewer | Open from the hero and work section, compare the views, navigate between projects, and close with touch and Escape. Check the inquiry text and the return of focus. |
| Growth Check | Use the hero link, tap both choices, finish all five questions, go Back, and Start over. Confirm the score and gaps in both WhatsApp drafts without sending a message. |

Capture what you observed. A successful build establishes compilation, while browser checks establish behavior in that browser. Chrome at an iPhone viewport does not verify native Safari chrome, touch edge cases, or a real notch. Report that boundary when relevant.

## Cloudflare preview

When requested, serve the static export on loopback and point a Quick Tunnel at it. Reuse a working tunnel that serves the current checkout. When it has expired, start a fresh one and use the URL printed by `cloudflared`.

```sh
npm run preview
```

In a separate process:

```sh
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4173
```

Verify the public page and the matching build's styles, scripts, fonts, and important images over HTTPS. Check an affected visitor flow through the public URL when appropriate. Cloudflare can rewrite the HTML in transit, so compare build resources and page content if raw HTML hashes differ. Keep the preview server and tunnel running for review. A Quick Tunnel is temporary and should be described as a preview.
