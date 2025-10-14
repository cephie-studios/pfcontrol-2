import { JwtPayload } from './JwtPayload.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}