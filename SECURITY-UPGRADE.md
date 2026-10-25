# October 2026 security upgrade

Verified on October 25, 2026 against the official Node release index, downloadable
release artifacts, npm registry package metadata, upstream release notes, and
Docker Hub image manifests.

## Runtime and deployment

- Local Node before: 24.18.0; project previously had no engine or version-file constraints.
- Tested Node after: **24.22.1 LTS**, selected in .nvmrc and .node-version.
- Enforced Node range: >=24.22.1 <25; npm range: >=12.2.1 <13.
- npm: **11.16.0 → 12.2.1**, declared in packageManager and installed in the Docker build stage.
- Build base: node:24-alpine → node:24.22.1-alpine, pinned to multi-platform digest
  sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53.
- Runtime base: nginx:alpine → nginx:1.30.6-alpine (current stable), pinned to digest
  sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951.
- Dockerfile frontend: 1.7 → current stable 1 channel.
- The final runtime serves static assets with Nginx and contains no Node build stage.
- No GitHub Actions, CircleCI, Logto, or Umami definitions/references exist in this repository.
  Shared services and machine-wide tooling are outside this change.

Node 24.22.1 is the current patched Node 24 LTS release. The security release also
lists patched 22.23.4 and 26.12.1; 26.12.1 is Current rather than LTS in the release
index. Node 24 preserves the existing supported major while applying the October
security fixes, including high-severity DNS, TLS verification, and Brotli issues.
The downloaded darwin-arm64 Node archive matched its official SHA-256 checksum.
The npm 12.2.1 archive matched its registry SHA-512 integrity value.

## Direct dependency versions

Versions below are the actual lockfile resolutions, including unchanged packages.
Every package is at its stable npm latest tag except @types/node, which uses the
latest Node 24 typings to match the tested runtime (24.19.2; latest overall is 26.6.5).

| Package | Before | After |
| --- | --- | --- |
| `@khmyznikov/pwa-install` | 0.6.4 | 0.7.0 |
| `@radix-ui/react-slider` | 1.4.7 | 1.6.1 |
| `class-variance-authority` | 0.7.1 | 0.7.1 |
| `clsx` | 2.1.1 | 2.1.1 |
| `lucide-react` | 1.27.0 | 1.61.0 |
| `react` | 19.2.8 | 19.3.1 |
| `react-dom` | 19.2.8 | 19.3.1 |
| `tailwind-merge` | 3.6.0 | 3.7.0 |
| `wavesurfer.js` | 7.12.11 | 8.0.3 |
| `@tailwindcss/vite` | 4.3.3 | 4.3.3 |
| `@testing-library/jest-dom` | 7.0.0 | 7.0.1 |
| `@testing-library/react` | 16.3.2 | 16.3.3 |
| `@testing-library/user-event` | 14.6.1 | 14.6.8 |
| `@types/node` | 24.13.3 | 24.19.2 |
| `@types/react` | 19.2.17 | 19.3.0 |
| `@types/react-dom` | 19.2.3 | 19.3.0 |
| `@vitejs/plugin-react` | 6.0.4 | 6.1.2 |
| `jsdom` | 30.0.0 | 30.1.3 |
| `oxlint` | 1.76.0 | 1.89.0 |
| `tailwindcss` | 4.3.3 | 4.3.3 |
| `typescript` | 6.0.3 | 7.0.2 |
| `vite` | 8.1.5 | 8.3.5 |
| `vite-plugin-pwa` | 1.3.0 | 2.0.0 |
| `vitest` | 4.1.10 | 5.0.5 |
| `workbox-core` | 7.4.1 | 7.4.1 |
| `workbox-precaching` | 7.4.1 | 7.4.1 |
| `workbox-routing` | 7.4.1 | 7.4.1 |
| `workbox-window` | 7.4.1 | 7.4.1 |

## Security findings

Before: **9 vulnerable packages: 6 high, 2 moderate, 1 low**.
The affected packages were @vitest/mocker, brace-expansion, fast-uri, nanoid,
serialize-javascript, source-map-js, undici, vite, and vitest. The audit included
Vite development-server/editor execution issues, Vitest mock injection/path
traversal, and denial-of-service issues in transitive packages.

After the direct upgrades and compatible transitive fixes: **0 audit findings**.
Key transitive resolutions include brace-expansion 5.0.12 and 2.1.7,
fast-uri 3.1.9, serialize-javascript 7.1.4, nanoid 3.3.20,
source-map-js 1.2.2, and undici 8.12.3. No dependency overrides were needed.

## Migration and validation

WaveSurfer 8 returns a nullable media element and rejects cancelled loads. The
player now checks for a media element before keep-alive playback, ignores
AbortError, and prevents a destroyed player's pending load from reporting stale
errors. Four regression tests cover these changes and real audio-load failures.

Validation used the checksum-verified Node 24.22.1 binary and npm 12.2.1:

- Clean npm ci with development and optional dependencies: passed.
- npm test: **7 files, 23 tests passed**.
- npm run build: TypeScript and both app/service-worker builds passed; PWA precache generated.
- npm run lint: passed, with one existing App.tsx share-error effect warning surfaced by the new linter.
- npm audit: **0 vulnerabilities**.
- npm ls --depth=0: valid dependency tree.
- npm outdated: only the intentionally retained Node 24 typings are below the latest overall major.
- Old Node 24.18.0 was rejected with EBADENGINE by the enforced engine constraint.
- git diff --check: passed.

Container validation completed after the local Docker/OrbStack API recovered:

- Full Docker build using the pinned images: passed on Linux arm64, including
  clean npm installation, zero audit findings, TypeScript, and app/service-worker builds.
- Nginx 1.30.6 configuration validation: passed; Node is absent from the runtime image.
- Running container: /health, /, /manifest.webmanifest, and /sw.js returned HTTP 200.
  The health JSON and app/PWA contents matched expectations. Health responses use
  no-store; the manifest and service worker use no-cache.
- Docker HEALTHCHECK reached healthy. The temporary test container was removed.
- Coolify deployment 8md7lpg1trshtnmfrsxg3fed for commit
  f57e1b6b1fa87936891999bc9d114d2d41eb9ff5 finished successfully. Its deployment
  log confirms the remote image build, successful health check, and completed rolling update.
- Public https://dance.inima.ir/health, /, /manifest.webmanifest, and /sw.js returned
  HTTP 200 with the expected health JSON, app document, manifest, and service worker.

Non-blocking upstream notices: the app bundle is over Vite's 500 kB warning
threshold; vite-plugin-pwa emits an inlineDynamicImports deprecation; a transitive
glob release is deprecated; npm 12 blocks the optional macOS fsevents install
script by default. Clean installation, tests, and builds passed with that policy.

## Official sources

- [Node October 2026 security advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Node downloadable release index](https://nodejs.org/dist/index.json)
- [Node 24.22.1 checksums](https://nodejs.org/dist/v24.22.1/SHASUMS256.txt)
- [npm registry](https://registry.npmjs.org/)
- [WaveSurfer 8 migration notes](https://github.com/katspaugh/wavesurfer.js/releases/tag/8.0.0)
- [Vitest 5.0.5](https://github.com/vitest-dev/vitest/releases/tag/v5.0.5)
- [Vite PWA 2.0.0](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v2.0.0)
- [Official Node images](https://hub.docker.com/_/node)
- [Official Nginx images](https://hub.docker.com/_/nginx)
