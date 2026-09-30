# Music Bar 2.0 — Mozilla source submission

## Reproduce the release

Release environment: Windows, Node.js **22.20.0**, npm **10.9.3**.
Node.js installer: https://nodejs.org/en/download/archive/v22.20.0
The build uses Node.js scripts and no platform-specific shell commands.

Extract this source ZIP into an empty directory. Open a terminal in the extracted
directory containing package.json and run:

```sh
npm ci
npm run build
```

Use npm ci to install the exact dependency versions in package-lock.json.
Internet access to the npm registry is required. No credentials, API keys,
environment variables, or private dependencies are needed for the build.

The output is dist/. Its contents correspond to music-bar-2.0-firefox.zip.
The extension ZIP contains manifest.json at its root, not inside a dist folder.
Compare extracted file contents rather than ZIP timestamps/compression metadata.

The build runs Vite and then scripts/finalize-firefox.mjs. The latter removes
CRXJS's Chromium-only use_dynamic_url property from the generated manifest,
checks the required host permission and script files, and writes the Firefox
manifest. This step must be included when reproducing the release.

The extension version is 2.0 in manifest.json. The private npm package's 0.0.0
version is build-project metadata, not the extension version.

## Reviewer notes

The two Unsafe assignment to innerHTML warnings in the bundled content script
refer to React DOM's implementation of dangerouslySetInnerHTML. The extension's
own src/ code does not use innerHTML or dangerouslySetInnerHTML. Track titles and
artist names are rendered as React text children. React DOM was not modified to
suppress the warnings.

Third-party sources (exact dependency versions are recorded in package-lock.json):

- React / React DOM: https://github.com/facebook/react
- Vite: https://github.com/vitejs/vite
- CRXJS: https://github.com/crxjs/chrome-extension-tools
- Tailwind CSS: https://github.com/tailwindlabs/tailwindcss

## Functional testing

Load dist/manifest.json through Firefox's about:debugging temporary add-on loader
and grant site access. Refresh existing music/test tabs. Play music on Spotify,
YouTube Music, or Apple Music, then open an ordinary website to check artwork,
track information, play/pause, previous/next, volume, and the collapsed player.
Firefox internal pages and restricted domains cannot host the bar. The bar is
intentionally absent on the music service pages. Service playback may require
the reviewer's own account/subscription; none is needed to build the extension.

Apple Music's previous button follows its native behavior: after four seconds
of playback it returns to the beginning before skipping to a previous track.
