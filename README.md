# Sharptext website

A single-page static site. No build step, no dependencies — just `index.html` plus a small logo component. Hosted free on GitHub Pages at **sharptext.org**.

## Files

- `index.html` — the whole site (copy + styling live here).
- `assets/logos/` — partner logos shown in the "Partnered with these people" strip.
- `assets/brand/` — the logo. `st-logo.js` + `st-logo.css` are the one logo component used everywhere; `sharptext-symbol.svg` is the approved symbol artwork.
- `og-image.png` — the preview image shown when the link is shared (LinkedIn, Slack, etc.). 1200×630.
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — browser and app icons.
- `tools/render-brand-assets.mjs` — regenerates the PNG/ICO icons and `og-image.png` from the logo component.
- `404.html` — the page shown for a broken or missing link.
- `robots.txt`, `sitemap.xml` — help search engines crawl and index the site.
- `site.webmanifest` — basic app metadata (name, colors, icon).
- `CNAME` — tells GitHub Pages to serve the site at sharptext.org. Don't delete it.
- `.nojekyll` — stops GitHub from doing anything clever to the files.

## The logo and brand colours

Use the component, never an image of the wordmark:

```html
<!-- horizontal lockup (symbol + "sharptext" in live text) -->
<st-logo class="st-logo"><span class="st-logo__word">sharptext</span></st-logo>

<!-- symbol alone -->
<st-logo class="st-logo" variant="symbol"></st-logo>
```

Add `st-logo--dark` (on dark backgrounds), `st-logo--black` or `st-logo--white` for the other colour versions, and set the size with `font-size` (the wordmark size; minimum 16px). The page needs `assets/brand/st-logo.css` and `assets/brand/st-logo.js`, both already linked in `index.html` and `404.html`.

Colours are defined once as `--st-*` variables at the top of the `<style>` block in `index.html`. The red (`--st-thread`) is the only accent: use it sparingly. The company name is written "Sharptext" in running text; only the logo wordmark is lowercase.

If the logo or colours change, regenerate the icons and share image with `node tools/render-brand-assets.mjs` (needs Playwright and Python with Pillow).

---

## 1. Put it live (one time)

From this folder:

```bash
git add .
git commit -m "Launch Sharptext site"
git push origin main
```

Then on GitHub: go to the **Door** repo → **Settings → Pages** → under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main / (root)**, and Save.

Within a minute or two the site is live at the temporary URL GitHub shows you (something like `sharptext.github.io/Door`).

## 2. Point sharptext.org at it

At your domain registrar (wherever you bought sharptext.org), add these DNS records:

**Four A records** for the root domain (`@`), pointing at GitHub's servers:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**One CNAME record** for `www`, pointing to `sharptext.github.io` (note the trailing dot if your registrar requires it).

Back in **Settings → Pages**, the "Custom domain" box should already read `sharptext.org` (the CNAME file sets this). Tick **Enforce HTTPS** once it becomes available — that can take an hour or so after DNS resolves.

DNS changes can take anywhere from a few minutes to a few hours to take effect. The github.io URL works the whole time.

## 3. Turn on the contact form (5 minutes)

The form uses [Formspree](https://formspree.io) (free tier). Right now it points at a placeholder.

1. Make a free Formspree account and create a new form.
2. Copy your form's endpoint — it looks like `https://formspree.io/f/abcdwxyz`.
3. In `index.html`, find `YOUR_FORM_ID` and replace the whole URL with yours.
4. Commit and push. The first real submission asks you to confirm your email; after that, entries land in your inbox.

If you'd rather not bother, the page also shows your email address as a fallback, so nothing breaks in the meantime.

## 4. Swap in the real logos

`assets/logos/` currently holds dashed-box placeholders so the strip renders. Replace each file with the real logo, keeping the **same filename**:

- `zayed-university.svg`, `minerva-project.svg`, `edu.svg`, `mindcet.svg`, `minds-studio.svg`, `dohe.svg`, `ocx.svg`

SVG or transparent PNG both work. Plain dark/mono logos look best — the page renders them in grayscale and brings them to full color on hover. If you use PNGs, just change the file extensions in `index.html` to match.

---

## Editing copy later

All text is in `index.html` between the obvious section comments (`<!-- HERO -->`, `<!-- TRANSFER PROBLEM -->`, and so on). Change the words, save, commit, push. That's the whole workflow.
