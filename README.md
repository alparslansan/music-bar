# Music Bar

A Firefox extension that lets you control Spotify, YouTube Music, and Apple Music while browsing other websites.

Music Bar shows the current track, artist, and album cover in a small player. Pause or resume playback, skip tracks, adjust the volume, and mute the music without returning to the music tab. Collapse the bar into a compact player when you want more room on the page.

Version 2.0 requires Firefox 142 or later.

## Try the extension

Build the project using the instructions below. In Firefox, open `about:debugging`, choose **This Firefox**, click **Load Temporary Add-on**, and select `dist/manifest.json`.

Grant Music Bar access to all websites in the extension's permissions, then refresh any tabs that were already open. Start a song in a supported music service and switch to another website to use the bar.

Temporary add-ons are removed when Firefox restarts. The bar does not appear on Firefox internal pages, restricted websites, or the music service pages themselves.

## Permissions

Website access lets Music Bar read playback information on the supported services and display its controls on other pages. Tab access is used to send commands to the music tab and clear the player when that tab closes. Local storage keeps the bar's visibility setting and active music tab reference.

If the bar stops appearing, check **Access your data for all websites** in Firefox's extension permissions and refresh the affected tabs.

## Source Code Build Instructions

For the Music Bar 2.0 submission, follow **BUILDING.md** for the exact release
environment, reproducible build commands, and reviewer notes.

This extension is built using React, Tailwind CSS, and Vite. The background scripts and content scripts are bundled into a standard browser extension format using Vite.

## 1. Operating System and Environment Requirements
- **OS:** Cross-platform (Windows, macOS, or Linux).
- **Node.js:** Version 22.20.0 (release build environment).
- **npm:** Version 10.9.3 (release build environment).

## 2. Installing Prerequisites (Node.js and npm)
If you do not have Node.js and npm installed, please download and install the LTS version from the official website:
- https://nodejs.org/en/download/

To verify your installation, open your terminal/command prompt and run:
`node -v`
`npm -v`

## 3. Step-by-Step Build Instructions

Please follow these exact steps to recreate the extension package from this source code:

**Step 1:** Extract the provided source code `.zip` file into a new directory.

**Step 2:** Open your terminal or command prompt and navigate to the root directory of the extracted folder (the directory containing the `package.json` file).
```bash
cd path/to/extracted/folder
```

Step 3: Install the required dependencies by running the following command:
```sh
npm ci
```

Step 4: Build the extension using the Vite build script defined in package.json:
```sh
npm run build
```

4. Build Output

Once the build process is complete, a new folder named dist will be generated in the root directory.

The contents of this dist directory represent the exact, compiled extension files that are submitted for review (manifest.json, HTML, CSS, JavaScript chunks, and assets). You can pack the contents of the dist folder into a ZIP file to compare it with the submitted add-on file.
