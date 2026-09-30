import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import tailwindStyles from './index.css?inline';

// 1. ADIM: Hangi sitede olduğumuzu öğreniyoruz
const hostname = window.location.hostname;

// 2. ADIM: Bu site bir medya oynatıcı ana sitesi mi?
const isPlayerSite = hostname.includes('spotify.com') || hostname.includes('music.youtube.com') || hostname.includes('music.apple.com');

// 3. ADIM: Eğer medya oynatıcı sitesinde DEĞİLSEK barı inşa et
if (!isPlayerSite) {
  const root = document.createElement('div');
  root.id = "touch-bar-extension-root";

  // Nükleer kalkanımız aynen kalıyor
  root.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
  `;

  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });

  const styleElement = document.createElement('style');
  styleElement.textContent = tailwindStyles;
  shadow.appendChild(styleElement);

  const reactRoot = document.createElement('div');
  shadow.appendChild(reactRoot);

  ReactDOM.createRoot(reactRoot).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // Geliştirici konsolu için ufak bir bilgilendirme (İsteğe bağlı)
  console.log("Touch Bar: Medya oynatıcı sitesi algılandı, bar gizlendi.");
}
