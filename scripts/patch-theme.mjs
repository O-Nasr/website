/**
 * One-time migration: adds light-theme CSS variables and postMessage theme sync
 * to all already-generated HTML files in public/docs/.
 * Run with:  node scripts/patch-theme.mjs
 */
import fs from 'fs/promises';
import path from 'path';

const DOCS_DIR = path.resolve(import.meta.dirname, '..', 'public', 'docs');

const OLD_ROOT = `    :root {
      --bg: #0a0c10;
      --surface: #111318;
      --surface2: #181c24;
      --surface3: #1f2530;
      --border: rgba(255,255,255,0.06);
      --border2: rgba(255,255,255,0.11);
      --accent: #6ea1ff;
      --accent2: #8b6cf6;
      --green: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --teal: #2dd4bf;
      --text: #dfe5ef;
      --muted: #7e8a9e;
      --code-bg: #080a0e;
    }`;

const NEW_ROOT = `    :root {
      --bg: #0a0c10;
      --surface: #111318;
      --surface2: #181c24;
      --surface3: #1f2530;
      --border: rgba(255,255,255,0.06);
      --border2: rgba(255,255,255,0.11);
      --accent: #6ea1ff;
      --accent2: #8b6cf6;
      --green: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --teal: #2dd4bf;
      --text: #dfe5ef;
      --muted: #7e8a9e;
      --code-bg: #080a0e;
      --text-strong: #ffffff;
      --pre-text: #c4cdd9;
      --table-row-even: rgba(255,255,255,0.012);
    }
    [data-theme="light"] {
      --bg: #f6f8fa;
      --surface: #ffffff;
      --surface2: #eaeef2;
      --surface3: #dde3ea;
      --border: rgba(0,0,0,0.08);
      --border2: rgba(0,0,0,0.14);
      --accent: #2563eb;
      --accent2: #7c3aed;
      --green: #059669;
      --amber: #b45309;
      --red: #dc2626;
      --teal: #0891b2;
      --text: #1e2432;
      --muted: #4a5568;
      --code-bg: #edf0f5;
      --text-strong: #0d1117;
      --pre-text: #24292f;
      --table-row-even: rgba(0,0,0,0.025);
    }`;

const THEME_SCRIPT = `  <script>
    (function(){
      if(localStorage.getItem('theme')==='light')document.documentElement.setAttribute('data-theme','light');
      window.addEventListener('message',function(e){if(e.data&&e.data.type==='theme-change'){if(e.data.theme==='light')document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');}});
    })();
  </script>`;

function patchContent(src) {
  if (src.includes('[data-theme="light"]')) return null; // already patched

  let out = src;

  // 1. Replace :root block with versioned dark + new light block
  out = out.replace(OLD_ROOT, NEW_ROOT);

  // 2. Hero h1: replace hardcoded gradient start color so it works on light bg
  out = out.replace(
    'background: linear-gradient(135deg, #dfe5ef 0%, #6ea1ff 50%, #34d399 100%);',
    'background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 50%, var(--green) 100%);'
  );

  // 3. .doc-content h1: remove hardcoded white fill
  out = out.replace('      color: #fff;\n      margin: 30px 0 0;', '      color: var(--text-strong);\n      margin: 30px 0 0;');
  out = out.replace('      -webkit-text-fill-color: #fff;\n      background-clip: padding-box;\n', '');

  // 4. strong / b / li strong
  out = out.replace('strong, b { color: #fff; }', 'strong, b { color: var(--text-strong); }');
  out = out.replace('li strong { color: #fff; }', 'li strong { color: var(--text-strong); }');

  // 5. Table even row background
  out = out.replace('background: rgba(255,255,255,0.012);', 'background: var(--table-row-even);');

  // 6. Pre text color
  out = out.replace('      color: #c4cdd9;', '      color: var(--pre-text);');

  // 7. Inject theme sync script right after <meta charset="UTF-8">
  out = out.replace(
    '  <meta charset="UTF-8">',
    `  <meta charset="UTF-8">\n${THEME_SCRIPT}`
  );

  return out;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (e.name.endsWith('.html')) files.push(full);
  }
  return files;
}

async function main() {
  const files = await walk(DOCS_DIR);
  let patched = 0, skipped = 0;

  for (const file of files) {
    const src = await fs.readFile(file, 'utf-8');
    const result = patchContent(src);
    if (result === null) { skipped++; continue; }
    await fs.writeFile(file, result, 'utf-8');
    patched++;
    console.log(`  ✓ ${path.relative(DOCS_DIR, file)}`);
  }

  console.log(`\nDone: ${patched} patched, ${skipped} already up-to-date.`);
}

main().catch(err => { console.error(err); process.exit(1); });
