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

## Using Your Own Documents (Sourcing Folder)

To replace the content with your own documents, you need to create a **`Sourcing`** folder **beside** (not inside) the `website/` folder.

### Folder Structure

```
(parent directory)/
├── Sourcing/               # ← Your source documents go here
│   ├── Category One/
│   │   ├── topic.docx
│   │   └── notes.html
│   ├── Category Two/
│   │   └── guide.docx
│   └── ...
└── website/                # ← This project
    ├── index.html
    ├── package.json
    └── ...
```

The conversion script (`scripts/convert-docx.mjs`) looks one level up (`../Sourcing/`) for source files. Subfolders become sidebar categories, and files within them become documents.

> **Omar's original sourcing folder** (the documents that ship with this project) is available on Google Drive:
> [https://drive.google.com/drive/folders/1zdTsLbu8-SBtK_zOLOu8Uek6cFX3pFeq?usp=sharing](https://drive.google.com/drive/folders/1zdTsLbu8-SBtK_zOLOu8Uek6cFX3pFeq?usp=sharing)

### Steps to Add Your Own Documents

1. Create the `Sourcing` folder beside `website/` as shown above
2. Place your `.docx` or `.html` files inside (organized into subfolders)
3. Run `npm run dev:convert` or `npm run convert`
4. The conversion script will:
   - Convert DOCX files to styled HTML → `public/docs/`
   - Copy HTML files → `public/html/`
   - Regenerate `public/doc-manifest.json`
5. New documents appear in the sidebar automatically

## Project Structure

```
website/
├── index.html              # App shell (header, sidebar, content area)
├── package.json
├── vite.config.ts
├── scripts/
│   ├── convert-docx.mjs    # DOCX conversion + HTML copy + manifest generation
│   └── patch-theme.mjs     # One-time migration for theme support on existing docs
├── src/
│   ├── main.ts             # Entry point, content loading, keyboard shortcuts
│   ├── sidebar.ts          # Collapsible tree navigation with bookmark support
│   ├── router.ts           # Hash-based SPA routing
│   ├── documents.ts        # Loads manifest, document lookup helpers
│   └── styles/
│       ├── main.css         # Layout, header, welcome screen, light/dark theme
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
