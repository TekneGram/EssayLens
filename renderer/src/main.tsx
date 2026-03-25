import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';
import 'react-toastify/dist/ReactToastify.css';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

if (!document.documentElement.dataset.theme) {
  document.documentElement.dataset.theme = 'system';
}

const queryClient = createAppQueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders queryClient={queryClient}>
      <App />
    </AppProviders>
  </React.StrictMode>
);
