# Dance Loop

A focused, offline-ready audio looper for dance practice. Choose a local track,
mark the part you want on the waveform, set a silent reset delay, and repeat.

## Install and share

The app can be installed from its in-app **Install** action. Chromium uses the
browser's native install prompt; iPhone and iPad users see the steps for adding
the app from the browser's Share menu.

Once installed on a supporting Chromium device, Dance Loop appears as a target
when another app shares an audio file. The service worker holds the shared file
in a temporary browser cache only long enough for the player to open it, then
deletes that entry. Safari on iOS does not currently support registering a PWA
as a share target, so iOS users should save the audio and choose it in the app.

## Local development

```bash
npm install
npm run dev
```

Run the automated checks and create a production bundle with:

```bash
npm test
npm run build
```

The production site is written to `dist`.

## Deploy with Coolify

Create a new application from this repository and use:

- Build pack: **Dockerfile**
- Dockerfile location: `/Dockerfile`
- Exposed port: `80`
- Force HTTPS: **Enabled**

No install, build, start, or publish-directory overrides are needed. The
multi-stage image builds the app with Node 24 and serves the generated files
with Nginx.

HTTPS is required for the service worker. After the first successful visit, the
app shell can be opened offline. Music is intentionally selected from the
device each session and is never uploaded or persistently stored by the app.

## Health and uptime monitoring

The runtime serves an uncached static health response:

```text
GET /health
200 {"status":"ok","service":"dance-loop"}
```

The Docker image checks this URL internally every 30 seconds. In Coolify, enable
the application health check with path `/health`, method `GET`, and expected
status `200`.

For public monitoring, configure two checks with the provider of your choice:

1. `https://dance.inima.ir/health` must return `200` and contain
   `"status":"ok"`.
2. `https://dance.inima.ir/` must return `200` and contain `Dance Loop`.

Enable both outage and recovery notifications. The first check covers the
Cloudflare-to-origin path without cached HTML; the second confirms that the
public site is serving the expected application document.
