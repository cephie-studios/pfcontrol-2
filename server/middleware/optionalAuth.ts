import jwt from 'jsonwebtoken';
import { getUserById } from '../db/users.js';
import { isAdmin } from './admin.js';
import { Request, Response, NextFunction } from 'express';
import type { JwtPayloadClient } from '../types/JwtPayload.js';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.auth_token;
  try {
    if (!JWT_SECRET) {
      console.warn('JWT_SECRET is not defined');
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadClient;
    const user = await getUserById(decoded.userId);

    if (user) {
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        discriminator: decoded.discriminator,
        avatar: decoded.avatar,
        isAdmin: isAdmin(decoded.userId),
        rolePermissions: user.rolePermissions,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    }
  } catch {
    console.log(
      'Optional auth: Invalid token, continuing without authentication'
    );
  }

  next();
}
