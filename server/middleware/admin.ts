import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../types/JwtPayload.js';

const JWT_SECRET = process.env.JWT_SECRET;

function getAdminIds() {
  const envAdmins = process.env.ADMIN_IDS;
  if (!envAdmins) {
    console.warn('ADMIN_IDS not set in environment variables.');
    return [];
  }
  return envAdmins.split(',').map((id) => id.trim());
}

function isAdmin(userId: string) {
  const adminIds = getAdminIds();
  return adminIds.includes(userId);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const adminIds = getAdminIds();

    if (!adminIds.includes(decoded.userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export { requireAdmin, isAdmin, getAdminIds };
