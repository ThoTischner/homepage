# tischner-itsystems.de

Website of **Thomas Tischner IT Systems**, platform architecture for Kubernetes and AI/data platforms.

Static site built with [Astro](https://astro.build), deployed to GitHub Pages.
No cookies, no tracking, no third-party requests.

## Development

Everything runs in Docker. Imprint contact data is injected at build time: copy `.env.example` to `.env`
(CI uses repository secrets with the same names).

```bash
docker compose up                                     # dev server on http://localhost:4321
docker compose --profile preview up --build preview   # production build on http://localhost:8080
```

Pushes to `main` are deployed via GitHub Actions.

---

© Thomas Tischner. All rights reserved. ↑ ↑ ↓ ↓ ← → ← → B A
