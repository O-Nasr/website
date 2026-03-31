import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';

const STUDY_DOCS_ROOT = path.resolve(import.meta.dirname, '..', '..', 'Sourcing');
const PUBLIC_DIR = path.resolve(import.meta.dirname, '..', 'public');
const DOCS_OUT = path.join(PUBLIC_DIR, 'docs');
const HTML_OUT = path.join(PUBLIC_DIR, 'html');

const SKIP_DIRS = new Set(['website', 'node_modules', '.git', 'public', 'src', 'scripts', 'dist']);

function slugify(name) {
  return name
    .replace(/\.docx$/i, '')
    .replace(/\.html$/i, '')
    .replace(/C#&dotNet/g, 'csharp-dotnet')
    .replace(/[#&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

function slugifyDir(name) {
  return name
    .replace(/C#&dotNet/g, 'csharp-dotnet')
    .replace(/[#&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .toLowerCase();
}

async function walkDir(dir, relPath = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = { docx: [], html: [] };

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const rel = path.join(relPath, entry.name);

    if (entry.isDirectory()) {
      const sub = await walkDir(fullPath, rel);
      results.docx.push(...sub.docx);
      results.html.push(...sub.html);
    } else if (entry.name.endsWith('.docx')) {
      results.docx.push({ fullPath, relPath: rel, dir: relPath });
    } else if (entry.name.endsWith('.html')) {
      results.html.push({ fullPath, relPath: rel, dir: relPath });
    }
  }

  return results;
}

// ── Post-process mammoth HTML: detect code-like <p> runs and wrap in <pre><code> ──

// Lines that are "spacers" between code (empty or whitespace-only)
const SPACER_RE = /^[\s\u00a0]*$/;

function looksLikeCode(text, innerHtml) {
  const trimmed = text.trim();
  if (!trimmed || SPACER_RE.test(trimmed)) return 'spacer';

  // If the paragraph contains <strong> or <em> wrapping most of the content, it's prose
  // (mammoth uses bold/italic from the Word doc — code doesn't have that)
  if (/<strong>/.test(innerHtml)) {
    const strongText = (innerHtml.match(/<strong>(.*?)<\/strong>/g) || [])
      .map(s => s.replace(/<\/?strong>/g, '')).join('');
    // If more than 40% of the text is bold, it's prose (explaining concepts)
    if (strongText.length > trimmed.length * 0.4) return 'prose';
  }

  // Strip inline comment for prose analysis — "dict.Remove("Ali"); // O(1) — remove"
  // The code part is before //, the comment part shouldn't count for prose detection
  const codePart = trimmed.replace(/\/\/.*$/, '').trim();
  const commentPart = trimmed.includes('//') ? trimmed.slice(trimmed.indexOf('//')) : '';

  // If the line has code syntax BEFORE a comment, it's code regardless of comment words
  const hasCodeBeforeComment = codePart.length > 0 && (
    /[{}();=<>\[\].]/.test(codePart) ||
    /;\s*$/.test(codePart) ||
    /^\s*(public|private|protected|internal|static|abstract|virtual|override|sealed|partial|readonly|const|class|interface|struct|enum|record|namespace|using|async|await|return|throw|new|var|if|else|switch|case|for|foreach|while|do|try|catch|finally|break|continue|yield|void|int|string|bool|double|float|long|byte|char|decimal|object)\b/.test(codePart)
  );
  if (hasCodeBeforeComment && codePart.length > 0 && /[;{})\].]/.test(codePart)) return 'code';

  // Use only the code part (before //) for prose word analysis
  const textForProseCheck = codePart || trimmed;
  const words = textForProseCheck.split(/\s+/);
  const hasManySentenceWords = words.length > 10;
  const proseWords = /\b(is|are|was|were|the|that|this|which|when|where|how|what|why|can|will|should|must|may|could|would|has|have|had|does|do|did|not|and|but|or|for|with|from|into|than|also|just|about|more|most|very|each|every|means|uses|need|like|between|because|instead|through|during)\b/gi;
  const proseWordCount = (textForProseCheck.match(proseWords) || []).length;

  // If lots of prose words and long sentence, definitely prose
  if (proseWordCount >= 4 && hasManySentenceWords) return 'prose';
  // Even with fewer prose words, very long line with 3+ prose words = prose
  if (proseWordCount >= 3 && words.length > 8) return 'prose';

  // Definite code patterns (high confidence)
  const STRONG_CODE = [
    /^\s*\/\/\s/,                          // // comment
    /^\s*\/\*/,                            // /* comment
    /^\s*\*/,                              // * continuation comment
    /^\s*\{$/,                             // lone {
    /^\s*\}[;,]?\s*$/,                     // } or }; or },
    /^\s*\);?\s*$/,                        // ) or );
    /^\s*\[[\w]+\]/,                       // [Attribute]
    /^\s*get\s*[{;]/,                      // get { or get;
    /^\s*set\s*[{;]/,                      // set { or set;
  ];
  for (const pat of STRONG_CODE) {
    if (pat.test(trimmed)) return 'code';
  }

  // Code keyword at START of line + code syntax
  const startsWithKeyword = /^\s*(public|private|protected|internal|static|abstract|virtual|override|sealed|partial|readonly|const|class|interface|struct|enum|record|namespace|using|async|await|return|throw|new|var|if|else|switch|case|for|foreach|while|do|try|catch|finally|break|continue|yield|void|int|string|bool|double|float|long|byte|char|decimal|object)\b/.test(trimmed);

  if (startsWithKeyword) {
    const hasCodeSyntax = /[{}();=<>\[\].]/.test(trimmed) || /;\s*$/.test(trimmed) || trimmed.length < 60;
    if (hasCodeSyntax && !hasManySentenceWords) return 'code';
  }

  // Method calls / dotted access (dict.Remove, Console.WriteLine etc.)
  if (/^\s*\w+\.\w+\(/.test(trimmed)) return 'code';

  // Variable assignment: x = something or x["key"] = something
  if (/^\s*\w+(\[.*\])?\s*=\s*/.test(trimmed) && /[;.]/.test(trimmed)) return 'code';

  // Lambda arrows with code context
  if (/=>/.test(trimmed) && words.length < 12) return 'code';

  // Ends with semicolon and not a long prose sentence
  if (/;\s*$/.test(trimmed) && words.length < 12) return 'code';

  // Short line with high special char ratio
  const specialRatio = (trimmed.match(/[{}();=<>[\].+\-*/&|!~^%]/g) || []).length / trimmed.length;
  if (specialRatio > 0.15 && trimmed.length < 80 && words.length < 10) return 'code';

  // Indented lines (4+ spaces) and short
  if (/^    /.test(text) && words.length < 12) return 'code';

  return 'prose';
}

function postProcessCodeBlocks(html) {
  // Split into tokens: <p>...</p> and everything else (h1, h2, table, etc.)
  const tokens = [];
  const tagRe = /<p>(.*?)<\/p>/gs;
  let lastIndex = 0;
  let match;

  while ((match = tagRe.exec(html)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'other', html: html.slice(lastIndex, match.index) });
    }
    // Strip inner HTML tags to get text for analysis
    const innerHtml = match[1];
    const text = innerHtml.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    tokens.push({ type: 'p', html: match[0], innerHtml, text });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    tokens.push({ type: 'other', html: html.slice(lastIndex) });
  }

  // Classify each <p> as code/spacer/prose
  for (const t of tokens) {
    if (t.type === 'p') {
      t.kind = looksLikeCode(t.text, t.innerHtml);
    }
  }

  // Group consecutive code/spacer runs (spacer between code counts as code)
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].type === 'p' && tokens[i].kind === 'code') {
      // Start a code run
      const codeLines = [];
      let j = i;
      while (j < tokens.length) {
        const t = tokens[j];
        if (t.type !== 'p') break;
        if (t.kind === 'code') {
          codeLines.push(t.text);
          j++;
        } else if (t.kind === 'spacer') {
          // Look ahead: if more code follows, include the spacer
          let k = j + 1;
          while (k < tokens.length && tokens[k].type === 'p' && tokens[k].kind === 'spacer') k++;
          if (k < tokens.length && tokens[k].type === 'p' && tokens[k].kind === 'code') {
            // Include spacers as blank lines
            for (let s = j; s < k; s++) codeLines.push('');
            j = k;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Only convert to code block if we have at least 2 code lines
      if (codeLines.length >= 2) {
        const escaped = codeLines.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        result.push(`<pre><code>${escaped}</code></pre>`);
      } else {
        // Not enough lines, keep as-is
        for (let k = i; k < j; k++) result.push(tokens[k].html);
      }
      i = j;
    } else {
      result.push(tokens[i].html);
      i++;
    }
  }

  return result.join('');
}

function formatTitle(rawTitle) {
  return rawTitle
    .replace(/^dotnet_/, '')
    .replace(/_guide$/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bVs\b/g, 'vs')
    .replace(/\bAnd\b/g, '&')
    .replace(/\bDotnet\b/g, '.NET')
    .replace(/\bCsharp\b/g, 'C#')
    .replace(/\bAcid\b/g, 'ACID')
    .replace(/\bLinq\b/g, 'LINQ')
    .replace(/\bSolid\b/g, 'SOLID')
    .replace(/\bSstable\b/g, 'SSTable')
    .replace(/\bGeodns\b/g, 'GeoDNS')
    .replace(/\bCqrs\b/g, 'CQRS')
    .replace(/\bDdd\b/g, 'DDD')
    .replace(/\bBff\b/g, 'BFF');
}

function getCategoryTag(dirPath) {
  if (!dirPath) return 'Study Guide';
  const lower = dirPath.toLowerCase();
  if (lower.includes('c#') || lower.includes('dotnet')) return 'C# & .NET';
  if (lower.includes('database')) return 'Database';
  if (lower.includes('design pattern')) return 'Design Patterns';
  if (lower.includes('system design')) return 'System Design';
  return 'Study Guide';
}

function makeDocxTemplate(title, htmlContent, dirPath) {
  const displayTitle = formatTitle(title);
  const categoryTag = getCategoryTag(dirPath);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    (function(){
      if(localStorage.getItem('theme')==='light')document.documentElement.setAttribute('data-theme','light');
      window.addEventListener('message',function(e){if(e.data&&e.data.type==='theme-change'){if(e.data.theme==='light')document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');}});
    })();
  </script>
  <style>
    :root {
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
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      line-height: 1.78;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Hero ── */
    .hero {
      padding: 56px 28px 44px;
      max-width: 900px;
      margin: 0 auto;
      border-bottom: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -80px;
      right: -40px;
      width: 360px;
      height: 360px;
      background: radial-gradient(circle, rgba(110,161,255,0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-tag {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 500;
      color: var(--accent);
      background: rgba(110,161,255,0.07);
      border: 1px solid rgba(110,161,255,0.18);
      padding: 4px 14px;
      border-radius: 20px;
      letter-spacing: 0.09em;
      margin-bottom: 14px;
      text-transform: uppercase;
    }
    .hero h1 {
      font-size: clamp(26px, 4.2vw, 42px);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 0;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 50%, var(--green) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ── Page layout ── */
    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 28px 100px;
    }

    /* ── Sections ── */
    .doc-content h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-strong);
      margin: 30px 0 0;
      padding: 24px 0 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .doc-content h1:first-child { margin-top: 10px; }

    .doc-content h2 {
      font-size: 15px;
      font-weight: 600;
      color: var(--accent);
      margin: 22px 0 10px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }

    .doc-content h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent2);
      margin: 18px 0 8px;
    }

    .doc-content h4, .doc-content h5, .doc-content h6 {
      font-size: 13px;
      font-weight: 600;
      color: var(--teal);
      margin: 14px 0 6px;
    }

    p {
      margin: 0;
      padding: 6px 0;
      font-size: 14.5px;
      line-height: 1.75;
    }
    strong, b { color: var(--text-strong); }
    em { color: var(--muted); }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Lists ── */
    ul, ol {
      padding-left: 20px;
      margin: 4px 0 10px;
    }
    li {
      margin: 3px 0;
      font-size: 14px;
      line-height: 1.7;
    }
    li strong { color: var(--text-strong); }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin: 12px 0;
    }
    th {
      background: var(--surface2);
      color: var(--accent);
      font-weight: 600;
      text-align: left;
      padding: 9px 13px;
      border: 1px solid var(--border);
    }
    td {
      padding: 8px 13px;
      border: 1px solid var(--border);
    }
    tr:nth-child(even) td {
      background: var(--table-row-even);
    }

    /* Single-cell tables = note/callout boxes */
    table:has(tr:only-child td:only-child) {
      background: rgba(110,161,255,0.05);
      border: 1px solid rgba(110,161,255,0.14);
      border-radius: 10px;
      overflow: hidden;
    }
    table:has(tr:only-child td:only-child) td {
      border: none;
      padding: 13px 16px;
      font-size: 13px;
      line-height: 1.7;
    }
    table:has(tr:only-child td:only-child) td strong {
      color: var(--accent);
    }

    /* ── Code ── */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      color: var(--accent);
      background: rgba(110,161,255,0.07);
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      overflow-x: auto;
      margin: 12px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      line-height: 1.7;
      color: var(--pre-text);
      scrollbar-width: thin;
      scrollbar-color: #333 transparent;
    }
    pre::-webkit-scrollbar { height: 4px; }
    pre::-webkit-scrollbar-track { background: transparent; }
    pre::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    pre::-webkit-scrollbar-thumb:hover { background: #555; }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    /* ── Blockquote ── */
    blockquote {
      background: rgba(110,161,255,0.05);
      border: 1px solid rgba(110,161,255,0.14);
      border-left: 3px solid var(--accent);
      border-radius: 0 10px 10px 0;
      padding: 13px 16px;
      margin: 10px 0;
      font-size: 13px;
      line-height: 1.7;
    }
    blockquote b, blockquote strong { color: var(--accent); }

    /* ── Images ── */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      margin: 12px 0;
      border: 1px solid var(--border);
    }

    /* ── HR ── */
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 36px 0 16px;
      font-size: 11px;
      color: var(--muted);
      border-top: 1px solid var(--border);
      margin-top: 40px;
    }

    @media (max-width: 640px) {
      .page { padding: 0 16px 60px; }
      .hero { padding: 36px 16px 30px; }
    }
  </style>
</head>
<body>

<div class="hero">
  <div class="hero-tag">${categoryTag}</div>
  <h1>${displayTitle}</h1>
</div>

<div class="page">
  <div class="doc-content">
${htmlContent}
  </div>
  <div class="footer">Study Docs Portal</div>
</div>

</body>
</html>`;
}

async function main() {
  console.log('🔍 Scanning Study Docs...');
  const files = await walkDir(STUDY_DOCS_ROOT);
  console.log(`   Found ${files.docx.length} .docx and ${files.html.length} .html files`);

  // Clean and recreate output dirs so removed source files don't linger
  try { await fs.rm(DOCS_OUT, { recursive: true, force: true }); } catch {}
  try { await fs.rm(HTML_OUT, { recursive: true, force: true }); } catch {}
  await fs.mkdir(DOCS_OUT, { recursive: true });
  await fs.mkdir(HTML_OUT, { recursive: true });

  // Convert DOCX files
  console.log('\n📄 Converting DOCX files...');
  for (const file of files.docx) {
    const slugDir = file.dir ? slugifyDir(file.dir) : 'root';
    const slugName = slugify(path.basename(file.fullPath)) + '.html';
    const outDir = path.join(DOCS_OUT, slugDir);
    const outPath = path.join(outDir, slugName);

    await fs.mkdir(outDir, { recursive: true });

    try {
      const result = await mammoth.convertToHtml({ path: file.fullPath });
      const title = path.basename(file.fullPath, '.docx');
      const processed = postProcessCodeBlocks(result.value);
      const html = makeDocxTemplate(title, processed, file.dir);
      await fs.writeFile(outPath, html, 'utf-8');

      if (result.messages.length > 0) {
        console.log(`   ⚠ ${file.relPath}: ${result.messages.length} warnings`);
      } else {
        console.log(`   ✓ ${file.relPath} → ${slugDir}/${slugName}`);
      }
    } catch (err) {
      console.error(`   ✗ ${file.relPath}: ${err.message}`);
    }
  }

  // Copy HTML files
  console.log('\n🌐 Copying HTML files...');
  for (const file of files.html) {
    const slugDir = slugifyDir(file.dir);
    const outDir = path.join(HTML_OUT, slugDir);
    const outPath = path.join(outDir, path.basename(file.fullPath));

    await fs.mkdir(outDir, { recursive: true });
    await fs.copyFile(file.fullPath, outPath);
    console.log(`   ✓ ${file.relPath}`);
  }

  // Generate manifest
  console.log('\n📋 Generating manifest...');
  const manifest = buildManifest(files);
  const manifestPath = path.join(PUBLIC_DIR, 'doc-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  const totalDocs = countDocs(manifest);
  console.log(`   ✓ doc-manifest.json (${totalDocs} documents)`);

  console.log('\n✅ Done!');
  console.log(`   ${files.docx.length} DOCX converted → public/docs/`);
  console.log(`   ${files.html.length} HTML copied → public/html/`);
  console.log(`   ${totalDocs} documents in manifest`);
}

function prettifyName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')              // remove extension
    .replace(/^dotnet_/, '')
    .replace(/_guide$/, '')
    .replace(/^\d+_/, (m) => m)           // keep number prefix
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bVs\b/g, 'vs')
    .replace(/\bAnd\b/g, '&')
    .replace(/\bDotnet\b/g, '.NET')
    .replace(/\bCsharp\b/g, 'C#')
    .replace(/\bAcid\b/g, 'ACID')
    .replace(/\bLinq\b/g, 'LINQ')
    .replace(/\bSolid\b/g, 'SOLID')
    .replace(/\bSstable\b/g, 'SSTable')
    .replace(/\bGeodns\b/g, 'GeoDNS')
    .replace(/\bCqrs\b/g, 'CQRS')
    .replace(/\bDdd\b/g, 'DDD')
    .replace(/\bBff\b/g, 'BFF')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bCh(\d+)\b/g, 'Ch$1')
    .trim();
}

function prettifyFolder(name) {
  const map = {
    'C#&dotNet': 'C# & .NET',
    'Database': 'Database',
    'Design Pattern': 'Design Patterns',
    'System Design': 'System Design',
    'Microservices': 'Microservices',
    'DDD': 'DDD',
    'System Design Interview (Book)': 'Interview Book',
  };
  return map[name] || prettifyName(name);
}

function buildManifest(files) {
  const tree = {};

  for (const file of files.docx) {
    const slugDir = file.dir ? slugifyDir(file.dir) : 'root';
    const slugName = slugify(path.basename(file.fullPath)) + '.html';
    const dirParts = file.dir ? file.dir.split(path.sep).filter(Boolean) : [];
    const docPath = `docs/${slugDir.replace(/\\/g, '/')}/${slugName}`;
    const label = prettifyName(path.basename(file.fullPath));
    const id = slugify(path.basename(file.fullPath));

    insertIntoTree(tree, dirParts, { id, label, type: 'document', path: docPath, sourceType: 'docx' });
  }

  for (const file of files.html) {
    const slugDir = slugifyDir(file.dir);
    const filename = path.basename(file.fullPath);
    const dirParts = file.dir ? file.dir.split(path.sep).filter(Boolean) : [];
    const docPath = `html/${slugDir.replace(/\\/g, '/')}/${filename}`;
    const label = prettifyName(filename);
    const id = slugify(filename);

    insertIntoTree(tree, dirParts, { id, label, type: 'document', path: docPath, sourceType: 'html' });
  }

  return convertTree(tree, true);
}

function insertIntoTree(tree, dirParts, doc) {
  if (dirParts.length === 0) {
    if (!tree.__docs__) tree.__docs__ = [];
    tree.__docs__.push(doc);
    return;
  }
  const folder = dirParts[0];
  if (!tree[folder]) tree[folder] = {};
  insertIntoTree(tree[folder], dirParts.slice(1), doc);
}

function convertTree(tree, isRoot = false) {
  const result = [];

  // Root-level docs get wrapped in "General" folder
  if (isRoot && tree.__docs__ && tree.__docs__.length > 0) {
    result.push({
      id: 'general',
      label: 'General',
      type: 'folder',
      children: tree.__docs__.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  // Process sub-folders
  for (const key of Object.keys(tree).sort()) {
    if (key === '__docs__') continue;
    const sub = tree[key];
    const children = [];

    // Direct docs in this folder
    if (sub.__docs__) {
      children.push(...sub.__docs__.sort((a, b) => a.label.localeCompare(b.label)));
    }

    // Nested sub-folders (recursive)
    for (const subKey of Object.keys(sub).sort()) {
      if (subKey === '__docs__') continue;
      const subNode = sub[subKey];
      const subChildren = [];
      if (subNode.__docs__) {
        subChildren.push(...subNode.__docs__.sort((a, b) => a.label.localeCompare(b.label)));
      }
      // Recurse deeper
      const deeper = convertTree(subNode);
      subChildren.push(...deeper);

      children.push({
        id: slugifyDir(subKey),
        label: prettifyFolder(subKey),
        type: 'folder',
        children: subChildren,
      });
    }

    result.push({
      id: slugifyDir(key),
      label: prettifyFolder(key),
      type: 'folder',
      children,
    });
  }

  return result;
}

function countDocs(nodes) {
  let count = 0;
  for (const n of nodes) {
    if (n.type === 'document') count++;
    if (n.children) count += countDocs(n.children);
  }
  return count;
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
