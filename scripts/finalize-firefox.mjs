import { readFile, writeFile, access } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const manifestPath = new URL('manifest.json', dist);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

// CRXJS emits a Chromium-only property that Firefox warns about.
for (const resource of manifest.web_accessible_resources ?? []) {
  delete resource.use_dynamic_url;
}

if (!manifest.host_permissions?.includes('<all_urls>')) {
  throw new Error('Music Bar requires its existing site permissions.');
}
const scripts = [
  ...(manifest.background?.scripts ?? []),
  ...manifest.content_scripts.flatMap(entry => entry.js ?? []),
];
for (const file of scripts) await access(new URL(file, dist));

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Firefox manifest verified: Music Bar ${manifest.version}`);
