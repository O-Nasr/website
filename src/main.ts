import { initSidebar, setActiveById, filterSidebar, getBookmark } from './sidebar';
import { initRouter, navigateTo, getCurrentDocId } from './router';
import { loadManifest, findDocById, getAllDocuments, DocNode } from './documents';

async function init() {
  // Load auto-generated manifest
  const tree = await loadManifest();

  // DOM elements
  const sidebarNav = document.getElementById('sidebar-nav')!;
  const sidebar = document.getElementById('sidebar')!;
  const sidebarOverlay = document.getElementById('sidebar-overlay')!;
  const menuToggle = document.getElementById('menu-toggle')!;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const docxContainer = document.getElementById('docx-container')!;
  const htmlIframe = document.getElementById('html-iframe') as HTMLIFrameElement;
  const welcomeScreen = document.getElementById('welcome-screen')!;
  const docCountBadge = document.getElementById('doc-count')!;
  const homeLink = document.getElementById('home-link')!;
  const bookmarkCard = document.getElementById('bookmark-card')!;
  const bookmarkTitle = document.getElementById('bookmark-title')!;
  const themeToggle = document.getElementById('theme-toggle')!;

  // Theme
  function applyTheme(theme: 'dark' | 'light') {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggle.classList.add('is-light');
      themeToggle.setAttribute('aria-label', 'Switch to dark mode');
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeToggle.classList.remove('is-light');
      themeToggle.setAttribute('aria-label', 'Switch to light mode');
    }
  }

  const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const isLight = document.documentElement.hasAttribute('data-theme');
    const next = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
    sendThemeToIframe();
  });

  // Update stats dynamically from manifest
  const totalDocs = getAllDocuments(tree).length;
  const totalCategories = tree.filter(n => n.type === 'folder').length;
  docCountBadge.textContent = `${totalDocs} docs`;
  const statNumbers = welcomeScreen.querySelectorAll('.welcome__stat-number');
  if (statNumbers[0]) statNumbers[0].textContent = String(totalDocs);
  if (statNumbers[1]) statNumbers[1].textContent = String(totalCategories);

  // Content loading
  function showWelcome() {
    docxContainer.style.display = 'none';
    htmlIframe.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    updateBookmarkCard();
  }

  function sendThemeToIframe() {
    const theme = document.documentElement.hasAttribute('data-theme') ? 'light' : 'dark';
    htmlIframe.contentWindow?.postMessage({ type: 'theme-change', theme }, '*');
  }

  htmlIframe.addEventListener('load', sendThemeToIframe);

  function loadDocument(doc: DocNode) {
    welcomeScreen.style.display = 'none';
    docxContainer.style.display = 'none';
    htmlIframe.style.display = 'block';
    htmlIframe.src = '/' + doc.path;
    localStorage.setItem('last-doc', doc.id);
  }

  function handleNavigate(doc: DocNode) {
    navigateTo(doc.id);
    loadDocument(doc);
    closeMobileSidebar();
  }

  function handleRoute(docId: string) {
    const doc = findDocById(docId);
    if (doc) {
      setActiveById(docId);
      loadDocument(doc);
    }
  }

  // Bookmark card
  function updateBookmarkCard() {
    const bookmarkedId = getBookmark();
    if (bookmarkedId) {
      const doc = findDocById(bookmarkedId);
      if (doc) {
        bookmarkTitle.textContent = doc.label;
        bookmarkCard.classList.remove('bookmark-card--hidden');
        return;
      }
    }
    bookmarkCard.classList.add('bookmark-card--hidden');
  }

  bookmarkCard.addEventListener('click', () => {
    const bookmarkedId = getBookmark();
    if (bookmarkedId) {
      const doc = findDocById(bookmarkedId);
      if (doc) handleNavigate(doc);
    }
  });

  window.addEventListener('bookmark-changed', () => {
    updateBookmarkCard();
  });

  // Mobile sidebar
  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });

  sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Home link — click logo to go back to welcome screen
  homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '';
    htmlIframe.style.display = 'none';
    htmlIframe.src = 'about:blank';
    docxContainer.style.display = 'none';
    showWelcome();
    // Deactivate sidebar selection
    const active = document.querySelector('.tree-doc.active');
    if (active) active.classList.remove('active');
    localStorage.removeItem('last-doc');
  });

  // Search
  searchInput.addEventListener('input', () => {
    filterSidebar(searchInput.value);
  });

  // Keyboard shortcut: Ctrl+K or / to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput)) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      searchInput.blur();
      searchInput.value = '';
      filterSidebar('');
      closeMobileSidebar();
    }
  });

  // Initialize sidebar and router
  initSidebar(sidebarNav, handleNavigate);
  initRouter(handleRoute);

  // Restore last viewed or show welcome
  const currentId = getCurrentDocId();
  if (currentId) {
    handleRoute(currentId);
  } else {
    const lastDoc = localStorage.getItem('last-doc');
    if (lastDoc && findDocById(lastDoc)) {
      navigateTo(lastDoc);
    } else {
      showWelcome();
    }
  }
}

init();
