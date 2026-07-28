# Dance Loop

A focused, offline-ready audio looper for dance practice. Choose a local track,
mark the part you want on the waveform, set a silent reset delay, and repeat.

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

- Build pack: **Nixpacks**
- Is it a static site?: **Enabled**
- Build command: `npm run build`
- Publish directory: `dist`
- Force HTTPS: **Enabled**

HTTPS is required for the service worker. After the first successful visit, the
app shell can be opened offline. Music is intentionally selected from the
device each session and is never uploaded or stored by the app.
