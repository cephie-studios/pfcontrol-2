import { JwtPayloadClient } from './JwtPayload.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayloadClient;
    }
  }
}
