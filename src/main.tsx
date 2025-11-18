import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

import { AuthProvider } from './hooks/auth/AuthProvider.tsx';
import { DataProvider } from './hooks/data/DataProvider.tsx';
import { SettingsProvider } from './hooks/settings/SettingsProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DataProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </DataProvider>
  </AuthProvider>
);
