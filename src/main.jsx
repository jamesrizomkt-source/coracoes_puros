import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckoutWidget from './pages/Landing'; // O arquivo ainda se chama index.jsx mas agora é o Widget
import { initLogger } from './utils/logger';

// Initialize Sentry logging
initLogger();

// Procura a âncora que criamos no index.html
const rootElement = document.getElementById('react-checkout-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <CheckoutWidget />
    </React.StrictMode>
  );
}
