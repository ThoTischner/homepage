# tischner-itsystems.de

Website of **Thomas Tischner IT Systems**, platform architecture for Kubernetes and AI/data platforms.

Static site built with [Astro](https://astro.build), deployed to GitHub Pages.
No cookies, no tracking, no third-party requests.

## Development

Everything runs in Docker.

```bash
docker compose up                                              # dev server on http://localhost:4321
docker build --target export --output type=local,dest=dist .   # production build to ./dist
```

Pushes to `main` are deployed via GitHub Actions.

---

© Thomas Tischner. All rights reserved. ↑ ↑ ↓ ↓ ← → ← → B A
