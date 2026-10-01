import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './state/auth';
import { DataProvider } from './state/data';
import { UiProvider } from './state/ui';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <UiProvider>
            <App />
          </UiProvider>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
