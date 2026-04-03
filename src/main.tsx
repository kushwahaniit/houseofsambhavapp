import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';

// Polyfills for Node.js globals in the browser
(window as any).Buffer = Buffer;
(window as any).buffer = Buffer;

// Global error handler for debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error caught:', { message, source, lineno, colno, error });
  const rootElement = document.getElementById('root');
  if (rootElement && rootElement.innerHTML === '') {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h1>Application failed to load</h1>
        <p>${message}</p>
        <pre>${error?.stack || ''}</pre>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
  return false;
};

import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

console.log('Application starting with polyfills...');

const container = document.getElementById('root');
console.log('Root container found:', !!container);
if (container) {
  try {
    console.log('Initializing React root...');
    const root = createRoot(container);
    console.log('Rendering App...');
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    console.log('React root rendered successfully.');
  } catch (error) {
    console.error('Failed to render React root:', error);
    container.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h1>Failed to initialize application</h1>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
} else {
  console.error('Root element not found');
}
