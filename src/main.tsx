import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

import { AuthProvider } from './hooks/auth/AuthProvider.tsx';
import { DataProvider } from './hooks/data/DataProvider.tsx';
import { SettingsProvider } from './hooks/settings/SettingsProvider.tsx';
console.log(
  `%c
██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██╗
██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██║
██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██║
██╔═══╝ ██╔══╝  ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║
██║     ██║     ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████╗
╚═╝     ╚═╝      ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
%c
				██╗   ██╗██████╗      ██████╗
				██║   ██║╚════██╗    ██╔═████╗
				██║   ██║ █████╔╝    ██║██╔██║
				╚██╗ ██╔╝██╔═══╝     ████╔╝██║
				 ╚████╔╝ ███████╗██╗ ╚██████╔╝
				  ╚═══╝  ╚══════╝╚═╝  ╚═════╝
%c%c`,
  'color: #4484eb; font: 400 1em monospace;',
  '',
  'background-color: #d2ff00; color: black; font: 400 1em monospace; padding: 0.5em 0; font-weight: bold;',
  ''
);

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DataProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </DataProvider>
  </AuthProvider>
);
