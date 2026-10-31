import './index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AuthContext } from './hooks/auth/useAuth';
import AdminExternalAcars from './pages/admin/AdminExternalAcars';

window.fetch = async () =>
  new Response(
    JSON.stringify({
      legacyRedirect: true,
      providers: [
        {
          id: 'veyra',
          displayName: 'Veyra',
          apiBaseUrl: 'https://x',
          tokenHeader: 'X-Flight-Token',
          handoffUrl: 'https://x/h',
          enabled: true,
          isDefault: true,
          hasHandoffApiKey: true,
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider
    value={{
      user: { userId: '1', username: 'dev', isAdmin: true } as never,
      isLoading: false,
      login: () => {},
      logout: async () => {},
      refreshUser: async () => {},
    }}
  >
    <MemoryRouter initialEntries={['/admin/external-acars']}>
      <AdminExternalAcars />
    </MemoryRouter>
  </AuthContext.Provider>
);
