import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import { GOOGLE_CLIENT_ID } from './constants/googleAuth.ts';
import './index.css';

// iOS Safari ignores `user-scalable=no`/`maximum-scale` in the viewport meta,
// so block its pinch-zoom gestures directly. touch-action:manipulation (in CSS)
// already covers double-tap zoom.
for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);
