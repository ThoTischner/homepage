# syntax=docker/dockerfile:1

# Base images pinned by digest for reproducible builds (kept up to date by Dependabot)
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
# Run as the image's unprivileged "node" user instead of root
RUN chown node:node /app
USER node

# --- Dependencies -------------------------------------------------------
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# --- Dev server with live reload (source mounted as a volume) -----------
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Production build ---------------------------------------------------
FROM deps AS build
COPY --chown=node:node . .
RUN npm run build

# --- Export dist/ only: docker build --target export --output type=local,dest=dist .
FROM scratch AS export
COPY --from=build /app/dist /

# --- Local preview of the production build -----------------------------
FROM nginx:1-alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2 AS preview
COPY --from=build /app/dist /usr/share/nginx/html
