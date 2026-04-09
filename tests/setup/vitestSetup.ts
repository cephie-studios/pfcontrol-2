import { vi } from 'vitest';

// Tests do not require a .env file or GitHub Actions secrets.
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  'vitest-jwt-secret-must-be-at-least-32-characters-long';
process.env.DB_ENCRYPTION_KEY =
  process.env.DB_ENCRYPTION_KEY || '0'.repeat(128);
process.env.ADMIN_IDS = process.env.ADMIN_IDS ?? '';

vi.mock('../../server/websockets/sessionUsersWebsocket.js', () => ({
  getActiveUsersForSession: vi.fn().mockResolvedValue([]),
}));
