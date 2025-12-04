import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force cache bust on every load in development
if (import.meta.env.DEV) {
  const timestamp = new Date().toISOString();
  console.log('🔄 App loaded at:', timestamp);
  console.log('🔄 Cache bust timestamp:', Date.now());
  
  // Clear any service worker caches
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
        console.log('🗑️ Unregistered service worker');
      });
    });
  }
  
  // Force reload if cache detected
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log('🗑️ Deleted cache:', name);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
