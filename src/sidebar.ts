import { DocNode, documentTree } from './documents';

const CHEVRON_SVG = `<svg class="tree-folder__chevron" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#6ea1ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FOLDER_SVG = `<svg class="tree-folder__icon" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3H6l1 1.5h5.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" stroke="#fbbf24" stroke-width="1.2" fill="rgba(251,191,36,0.1)"/></svg>`;

const DOC_SVG = `<svg class="tree-doc__icon" viewBox="0 0 16 16" fill="none"><path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#6ea1ff" stroke-width="1.2" fill="rgba(110,161,255,0.08)"/><path d="M9 2v4h4" stroke="#6ea1ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const HTML_SVG = `<svg class="tree-doc__icon" viewBox="0 0 16 16" fill="none"><path d="M2 3l1.5 10L8 15l4.5-2L14 3H2z" stroke="#34d399" stroke-width="1.2" stroke-linejoin="round" fill="rgba(52,211,153,0.08)"/><path d="M5 6h6M5.5 9h5M6.5 12h3" stroke="#34d399" stroke-width="1" stroke-linecap="round"/></svg>`;

type NavigateCallback = (doc: DocNode) => void;

let activeElement: HTMLElement | null = null;
let onNavigate: NavigateCallback = () => {};

// Persisted state
const STORAGE_KEY = 'sidebar-open-folders';
function getOpenFolders(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}
function saveOpenFolders(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

const openFolders = getOpenFolders();

function createFolderNode(node: DocNode, depth: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tree-folder';
  el.dataset.id = node.id;

  if (openFolders.has(node.id)) {
    el.classList.add('open');
  }

  const header = document.createElement('button');
  header.className = 'tree-folder__header';
  header.style.setProperty('--depth', String(depth));
  header.innerHTML = `${CHEVRON_SVG}${FOLDER_SVG}<span class="tree-folder__label">${node.label}</span>`;
  header.addEventListener('click', () => {
    el.classList.toggle('open');
    if (el.classList.contains('open')) {
      openFolders.add(node.id);
    } else {
      openFolders.delete(node.id);
    }
    saveOpenFolders(openFolders);
  });

  const children = document.createElement('div');
  children.className = 'tree-folder__children';
  children.style.setProperty('--depth', String(depth));

  for (const child of node.children || []) {
    if (child.type === 'folder') {
      children.appendChild(createFolderNode(child, depth + 1));
    } else {
      children.appendChild(createDocNode(child, depth + 1));
    }
  }

  el.appendChild(header);
  el.appendChild(children);
  return el;
}

function createDocNode(node: DocNode, depth: number): HTMLElement {
  const el = document.createElement('button');
  el.className = 'tree-doc';
  el.dataset.id = node.id;
  el.style.setProperty('--depth', String(depth));

  const icon = node.sourceType === 'html' ? HTML_SVG : DOC_SVG;
  el.innerHTML = `${icon}<span class="tree-doc__label">${node.label}</span>`;

  el.addEventListener('click', () => {
    setActive(el);
    onNavigate(node);
  });

  return el;
}

function setActive(el: HTMLElement) {
  if (activeElement) {
    activeElement.classList.remove('active');
  }
  el.classList.add('active');
  activeElement = el;
}

export function initSidebar(container: HTMLElement, navigateCb: NavigateCallback) {
  onNavigate = navigateCb;
  container.innerHTML = '';

  for (const node of documentTree) {
    if (node.type === 'folder') {
      container.appendChild(createFolderNode(node, 0));
    } else {
      container.appendChild(createDocNode(node, 0));
    }
  }
}

export function setActiveById(id: string) {
  const el = document.querySelector(`[data-id="${id}"].tree-doc`) as HTMLElement | null;
  if (el) {
    setActive(el);
    // Auto-expand parent folders
    let parent = el.parentElement;
    while (parent) {
      if (parent.classList.contains('tree-folder')) {
        parent.classList.add('open');
        openFolders.add(parent.dataset.id!);
      }
      parent = parent.parentElement;
    }
    saveOpenFolders(openFolders);
    // Scroll into view
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

export function filterSidebar(query: string) {
  const q = query.toLowerCase().trim();
  const allFolders = document.querySelectorAll('.tree-folder');
  const allDocs = document.querySelectorAll('.tree-doc');

  if (!q) {
    allFolders.forEach((f) => {
      f.classList.remove('filtered-out', 'filter-match');
    });
    allDocs.forEach((d) => d.classList.remove('filtered-out'));
    return;
  }

  // First: mark docs
  allDocs.forEach((d) => {
    const label = d.querySelector('.tree-doc__label')?.textContent?.toLowerCase() || '';
    if (label.includes(q)) {
      d.classList.remove('filtered-out');
    } else {
      d.classList.add('filtered-out');
    }
  });

  // Then: mark folders bottom-up
  const foldersArray = Array.from(allFolders).reverse();
  for (const f of foldersArray) {
    const children = f.querySelector('.tree-folder__children');
    if (!children) continue;
    const hasVisibleChild =
      children.querySelector('.tree-doc:not(.filtered-out)') !== null ||
      children.querySelector('.tree-folder:not(.filtered-out)') !== null;

    if (hasVisibleChild) {
      f.classList.remove('filtered-out');
      f.classList.add('filter-match');
    } else {
      f.classList.add('filtered-out');
      f.classList.remove('filter-match');
    }
  }
}
