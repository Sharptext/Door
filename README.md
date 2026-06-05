# SharpText website

A single-page static site. No build step, no dependencies — just `index.html`. Hosted free on GitHub Pages at **sharptext.org**.

## Files

- `index.html` — the whole site (copy + styling live here).
- `assets/logos/` — partner logos shown in the "Partnered with these people" strip.
- `og-image.png` — the preview image shown when the link is shared (LinkedIn, Slack, etc.). 1200×630.
- `favicon.svg` — the little icon in the browser tab.
- `404.html` — the page shown for a broken or missing link.
- `robots.txt`, `sitemap.xml` — help search engines crawl and index the site.
- `site.webmanifest` — basic app metadata (name, colors, icon).
- `CNAME` — tells GitHub Pages to serve the site at sharptext.org. Don't delete it.
- `.nojekyll` — stops GitHub from doing anything clever to the files.

If you change the headline or the green, regenerate `og-image.png` so the share preview matches (just ask, or replace it with any 1200×630 image).

---

## 1. Put it live (one time)

From this folder:

```bash
git add .
git commit -m "Launch SharpText site"
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
