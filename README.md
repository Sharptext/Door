# Sharptext website

A single-page static site. No build step, no dependencies — just `index.html` plus a small logo component. Hosted free on GitHub Pages at **sharptext.org**.

## Files

- `index.html` — the whole site (copy + styling live here).
- `assets/brand/` — the logo. `st-logo.js` + `st-logo.css` are the one logo component used everywhere; `sharptext-symbol.svg` is the approved symbol artwork.
- `og-image.png` — the preview image shown when the link is shared (LinkedIn, Slack, etc.). 1200×630.
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — browser and app icons.
- `intro-lab.html` — a private page that plays the intro variants side by side.
- `assets/brand/st-loom.js` — the woven background and the red thread drawn as the page scrolls.
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

**Intro animation.** On the first visit in a browser session, the home page opens on the loom with only the heading's two words, "knowing" and "doing". On scroll, click, key press or after 2.5 seconds, the red thread runs from "knowing" through three right points to "doing". Each line it picks up thickens; those three lines fly up and become the logo in the header, and the rest of the page fades in. The thread stays between the two words. A click or key press skips it. It does not play for people who have reduced motion turned on, or for links to a section of the page.

Variants: `loom` (horizontal lines, the default), `warp` (vertical lines), `net-h` and `net-v` (a wavy net; the horizontal or the vertical threads become the logo). See one with `?intro=warp` and so on, or all four side by side at `/intro-lab.html` (not linked from the site, hidden from search engines). To change what visitors get, edit `DEFAULT_VARIANT` in the "Intro animation" block in the `<head>` of `index.html`; set it to `'random'` to split visitors across the four. Each play is sent to Google Analytics as an `intro_play` event (and `intro_skip` when skipped) with the variant name. The code is in `assets/brand/st-intro.js` and `st-intro.css`.

**Woven background and the red thread.** The loom stays as a faint background behind the page (matching the variant), and from "doing" the red thread is drawn on as you scroll. It runs underneath a few key words in each section, which turn red as it reaches them, and ends where "Let's talk" begins. To change the words, move the `<span class="thread-mark">…</span>` wrappers in `index.html`; the thread follows them in reading order. It lives in `assets/brand/st-loom.js`.

**Scroll reveals.** The hero's last line ("That's the red thread we design for.") appears on the first scroll, and the "Book a conversation" button beside the logo appears on a later, separate scroll. Keyboard users get both as soon as they press Tab.

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

## 4. Add the partner logos

The "Partnered with these people" strip currently lists the partner names as text (the `<ul class="partners">` list in `index.html`), because only placeholder logo files existed. When you have the real logos, put them in `assets/logos/` and replace each `<li>Name</li>` with `<li><img src="assets/logos/name.svg" alt="Name" height="40"></li>`.

SVG or transparent PNG both work. Plain dark or single-colour logos look best on this page.

---

## Editing copy later

All text is in `index.html` between the obvious section comments (`<!-- HERO -->`, `<!-- TRANSFER PROBLEM -->`, and so on). Change the words, save, commit, push. That's the whole workflow.
