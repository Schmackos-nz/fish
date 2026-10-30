// Stages the web game into app/game for the desktop build, with everything it pulls off the internet
// (Three.js, the Google Fonts) saved locally so the packaged game runs fully offline.
// Downloads are cached in vendor/ (committed) and only fetched when missing.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const root = path.resolve(here, '..');
const vendor = path.join(here, 'vendor');
const out = path.join(here, 'app', 'game');

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function get(url, binary) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}

async function vendorThree() {
  const f = path.join(vendor, 'three.min.js');
  if (!fs.existsSync(f)) { fs.writeFileSync(f, await get(THREE_URL, true)); console.log('vendored three.js r128'); }
}

// Pulls the stylesheet the page links to, downloads every font file it names, and rewrites it to local paths.
async function vendorFonts(href) {
  const css = path.join(vendor, 'fonts', 'fonts.css');
  if (fs.existsSync(css)) return;
  fs.mkdirSync(path.dirname(css), { recursive: true });
  let text = await get(href);
  const urls = [...new Set([...text.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
  let n = 0;
  for (const u of urls) {
    const name = 'f' + (n++) + path.extname(new URL(u).pathname);
    fs.writeFileSync(path.join(vendor, 'fonts', name), await get(u, true));
    text = text.split(u).join(name);
  }
  fs.writeFileSync(css, text);
  console.log('vendored ' + urls.length + ' font files');
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

fs.mkdirSync(vendor, { recursive: true });
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fontHref = (html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/) || [])[1];
if (!fontHref) throw new Error('font stylesheet link not found in index.html');
await vendorThree();
await vendorFonts(fontHref.replace(/&amp;/g, '&'));

fs.rmSync(out, { recursive: true, force: true });
copyDir(path.join(root, 'js'), path.join(out, 'js'));
copyDir(vendor, path.join(out, 'vendor'));
fs.copyFileSync(path.join(here, 'src', 'desktop-shim.js'), path.join(out, 'js', 'desktop-shim.js'));

html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">/, '<link href="vendor/fonts/fonts.css" rel="stylesheet">')
  .replace(THREE_URL, 'vendor/three.min.js')
  .replace(/\?v=\d+"/g, '"')
  // The desktop bridge runs before any game script, so saves are restored before the game reads them.
  .replace('<script src="vendor/three.min.js"></script>', '<script src="js/desktop-shim.js"></script>\n<script src="vendor/three.min.js"></script>');
if (/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/<!--[\s\S]*?-->/g, ''))) console.warn('warning: index.html still references the internet');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('staged game → ' + path.relative(here, out));
