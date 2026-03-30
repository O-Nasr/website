# Study Docs Portal

A personal CS knowledge base website that auto-discovers and displays study documents. Built with Vite + TypeScript, no framework.

## Features

- Dark-themed UI with collapsible sidebar navigation
- Auto-discovers `.docx` and `.html` files from source folders
- Converts DOCX files to styled HTML at build time (via mammoth)
- Loads standalone HTML files in iframes for style isolation
- Search filtering, hash-based routing, responsive mobile layout
- Auto-generated manifest — add files, rebuild, they appear in the sidebar

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. That's it — the site runs with the pre-built documents already in `public/`.

## Scripts

| Command | Needs source files? | Description |
|---------|---------------------|-------------|
| `npm run dev` | No | Start dev server using existing `public/` files |
| `npm run dev:convert` | Yes | Convert source docs, then start dev server |
| `npm run build` | No | Build for production using existing `public/` files |
| `npm run build:convert` | Yes | Convert source docs, then build for production |
| `npm run convert` | Yes | Only run the conversion script |
| `npm run preview` | No | Preview the production build locally |

## Adding New Documents

1. Place `.docx` or `.html` files in the source folders (parent directory)
2. Run `npm run dev:convert` or `npm run convert`
3. The conversion script will:
   - Convert DOCX files to styled HTML → `public/docs/`
   - Copy HTML files → `public/html/`
   - Regenerate `public/doc-manifest.json`
4. New documents appear in the sidebar automatically

## Project Structure

```
website/
├── index.html              # App shell (header, sidebar, content area)
├── package.json
├── vite.config.ts
├── scripts/
│   └── convert-docx.mjs    # DOCX conversion + HTML copy + manifest generation
├── src/
│   ├── main.ts             # Entry point, content loading, keyboard shortcuts
│   ├── sidebar.ts          # Collapsible tree navigation
│   ├── router.ts           # Hash-based SPA routing
│   ├── documents.ts        # Loads manifest, document lookup helpers
│   └── styles/
│       ├── main.css         # Layout, header, welcome screen, dark theme
│       └── sidebar.css      # Tree navigation styling
└── public/
    ├── doc-manifest.json    # Auto-generated document tree
    ├── docs/                # Converted DOCX → HTML files
    └── html/                # Copied standalone HTML files
```

## Tech Stack

- **Vite** — dev server + production bundler
- **TypeScript** — sidebar, router, content loading
- **CSS** — custom properties, CSS Grid, no framework
- **mammoth.js** — DOCX to HTML conversion at build time
- **Google Fonts** — Outfit + JetBrains Mono

## Deployment

Run `npm run build` and deploy the `dist/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel).

## Created by

**Omar Saad**
