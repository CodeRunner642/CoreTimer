# Core Timer

Mobile-first wellness-style habit tracker and guided timer for Kegel and reverse Kegel routines.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to static hosting

### Netlify / Cloudflare Pages / Vercel
- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages
- Build with `npm run build`
- Publish the `dist` directory using GitHub Pages (via Actions or `gh-pages`).

## CI note

GitHub Actions deployment uses `npm ci`, so `package-lock.json` must be committed and kept up to date for builds to pass.

## Notes and limitations
- Data is stored locally in browser `localStorage` only.
- No backend or account support.
- iPhone notification/reminder behaviour in Safari/PWA varies by iOS version and permissions.
- The app stores preferred reminder time, but does not guarantee scheduled local notifications.
