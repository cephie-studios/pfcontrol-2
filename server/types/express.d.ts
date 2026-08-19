import { JwtPayloadClient } from './JwtPayload.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadClient;
      platformIdentity?: {
        userId: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        isAdmin: boolean;
      };
      developerExt?: {
        keyId: string;
        userId: string;
        scopes: string[];
        matchedScopeId: string | null;
        matchedPath: string;
        keyPrefix: string;
        keyName: string;
        rateLimitPerMinute: number | null;
        apiVersion?: 1 | 2;
      };
      developerExtStartedAt?: number;
    }
  }
}

export {};
