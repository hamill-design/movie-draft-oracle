import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force cache bust on every load in development
if (import.meta.env.DEV) {
  console.log('🔄 App loaded at:', new Date().toISOString());
  // Clear any service worker caches
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
