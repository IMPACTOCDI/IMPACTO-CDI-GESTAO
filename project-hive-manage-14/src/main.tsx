import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queryClient';

// Suprimir erro comum do Chrome relacionado a extensões
// Este erro não afeta a funcionalidade da aplicação
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function(...args: any[]) {
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      args[args.length - 1] = function(...callbackArgs: any[]) {
        if (chrome.runtime.lastError) {
          // Ignorar erro de porta fechada (comum com extensões)
          if (chrome.runtime.lastError.message?.includes('message port closed')) {
            return;
          }
        }
        callback(...callbackArgs);
      };
    }
    return originalSendMessage.apply(this, args);
  };
}

// Suprimir avisos de runtime.lastError no console
const originalError = console.error;
console.error = function(...args: any[]) {
  const message = args[0]?.toString() || '';
  if (message.includes('runtime.lastError') || message.includes('message port closed')) {
    return; // Suprimir este erro específico
  }
  originalError.apply(console, args);
};



ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider 
          checkInterval={30000}
          enableAutoReconnect={true}
          maxReconnectAttempts={5}
        >
          <AuthProvider>
            <App />
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
