# syntax=docker/dockerfile:1.7
# The SSR key is intentionally accepted only through BuildKit's secret mount.
# It is required by next.config.mjs while building, but never becomes an ARG,
# ENV instruction, layer file, or part of the final image configuration.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Values prefixed NEXT_PUBLIC_ and the legal release copy are public build
# inputs. API_BASE_URL is server-only but must be present for static rendering.
ARG NEXT_PUBLIC_API_BASE_URL
ARG API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_MEDIA_ORIGINS
ARG NEXT_PUBLIC_RELEASE_VERSION
ARG NEXT_PUBLIC_SENTRY_DSN
ARG DARI_LEGAL_ENTITY_NAME
ARG DARI_LEGAL_ADDRESS
ARG DARI_LEGAL_REGISTRATION
ARG DARI_LEGAL_CONTACT
ARG DARI_LEGAL_JURISDICTION
ARG DARI_LEGAL_COMPLAINT_AUTHORITY
ARG DARI_LEGAL_RETENTION
ARG DARI_LEGAL_PROCESSORS
ARG DARI_LEGAL_LAWFUL_BASES
ARG DARI_LEGAL_EFFECTIVE_DATE
ARG DARI_LEGAL_VERSION
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    API_BASE_URL=$API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_MEDIA_ORIGINS=$NEXT_PUBLIC_MEDIA_ORIGINS \
    NEXT_PUBLIC_RELEASE_VERSION=$NEXT_PUBLIC_RELEASE_VERSION \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    DARI_LEGAL_ENTITY_NAME=$DARI_LEGAL_ENTITY_NAME \
    DARI_LEGAL_ADDRESS=$DARI_LEGAL_ADDRESS \
    DARI_LEGAL_REGISTRATION=$DARI_LEGAL_REGISTRATION \
    DARI_LEGAL_CONTACT=$DARI_LEGAL_CONTACT \
    DARI_LEGAL_JURISDICTION=$DARI_LEGAL_JURISDICTION \
    DARI_LEGAL_COMPLAINT_AUTHORITY=$DARI_LEGAL_COMPLAINT_AUTHORITY \
    DARI_LEGAL_RETENTION=$DARI_LEGAL_RETENTION \
    DARI_LEGAL_PROCESSORS=$DARI_LEGAL_PROCESSORS \
    DARI_LEGAL_LAWFUL_BASES=$DARI_LEGAL_LAWFUL_BASES \
    DARI_LEGAL_EFFECTIVE_DATE=$DARI_LEGAL_EFFECTIVE_DATE \
    DARI_LEGAL_VERSION=$DARI_LEGAL_VERSION
RUN --mount=type=secret,id=dari_ssr_shared_secret \
    export DARI_SSR_SHARED_SECRET="$(cat /run/secrets/dari_ssr_shared_secret)" \
    && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 10001 dari \
    && useradd --system --uid 10001 --gid dari --no-create-home --shell /usr/sbin/nologin dari

# Standalone intentionally excludes public and static files; copy only those
# production runtime assets, never source, dependencies, or the build cache.
COPY --from=build --chown=dari:dari /app/.next/standalone ./
COPY --from=build --chown=dari:dari /app/.next/static ./.next/static
COPY --from=build --chown=dari:dari /app/public ./public

USER dari:dari
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/manifest.webmanifest').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
