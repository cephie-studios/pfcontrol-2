import { JwtPayloadClient } from "./JwtPayload.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadClient;
      developerExt?: {
        keyId: string;
        userId: string;
        scopes: string[];
        matchedScopeId: string | null;
        matchedPath: string;
        keyPrefix: string;
        keyName: string;
        rateLimitPerMinute: number | null;
      };
      developerExtStartedAt?: number;
    }
  }
}

export {};