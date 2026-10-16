import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { preloadRoute, prefetchLikelyPages } from './lazyPages'
import './index.css'

// Load the current page's code first so prerendered HTML stays on screen until React can
// replace it with the real page (no loading-state flash on a hard load).
preloadRoute(window.location.pathname).finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
  // Not during the build-time prerender (webdriver): the snapshot would bake the prefetch
  // links into every static page and make visitors download them up front.
  if (!navigator.webdriver) prefetchLikelyPages();
});
