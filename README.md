# ORHS Orchestra

Website for the Oak Ridge High School Orchestra program.

## Stack

- **[Astro](https://astro.build)** — static site generator with SSR support
- **[@astrojs/netlify](https://docs.astro.build/en/guides/deploy/netlify/)** — Netlify adapter
- **Google Fonts** — Inter, Playfair Display

## Getting Started

```bash
npm install
npm run dev       # dev server → http://localhost:4321
npm run build     # production build → ./dist
npm run preview   # preview locally
```

## Project Structure

```
src/
├── layouts/
│   └── Layout.astro       # HTML shell, fonts, global styles
├── pages/
│   ├── index.astro        # Homepage
│   └── contact.astro      # Contact form (Netlify Forms)
└── components/            # Nav, Hero, sections, Footer
```

## External Services

| Service | Purpose | Config Location |
|---------|---------|-----------------|
| **Netlify** | Hosting + form handling | `.netlify/netlify.toml` · `@astrojs/netlify` adapter |
| **Netlify Forms** | Contact form submissions | `src/pages/contact.astro` · `data-netlify="true"` |
| **PayPal** | Donations + uniform purchases | `src/components/` · Hosted button ID: `T32ANDBDFNPHA` |
| **Google Fonts** | Typography | `src/layouts/Layout.astro` · Inter, Playfair Display |

No analytics or email services configured.

## Deployment

Push to `main` — Netlify auto-builds and deploys.
