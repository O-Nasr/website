type RouteCallback = (docId: string) => void;

let onRoute: RouteCallback = () => {};

export function initRouter(callback: RouteCallback) {
  onRoute = callback;

  window.addEventListener('hashchange', handleHash);
  // Handle initial load
  if (window.location.hash) {
    handleHash();
  }
}

function handleHash() {
  const hash = window.location.hash.slice(1); // remove #
  if (hash) {
    onRoute(hash);
  }
}

export function navigateTo(docId: string) {
  window.location.hash = docId;
}

export function getCurrentDocId(): string | null {
  const hash = window.location.hash.slice(1);
  return hash || null;
}
