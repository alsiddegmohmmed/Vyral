# Vyral Labs website

The Vyral Labs homepage: **online presence that spreads.**

Vyral Labs is a marketing and digital growth agency in Kigali, Rwanda. The homepage is built around a 30-second growth check. Visitors answer five yes / not yet questions, see their gaps with what Vyral would do first, and open WhatsApp with their answers already typed in.

## What's here

- `index.html` is the whole site: one static page with inline CSS and JavaScript. No build step.
- Fonts load from Google Fonts: Syne (headlines), Schibsted Grotesk (body) and DM Mono (labels).

## Run it locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Publish with GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.

## Things to change in one place

- WhatsApp number: `WA_NUMBER` near the top of the script in `index.html`.
- Growth check questions, reasons and first moves: the `Q` array in the script.
