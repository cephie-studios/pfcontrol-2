import jwt from "jsonwebtoken";
import { getUserById } from "../db/users.js";
import { isAdmin } from "./admin.js";
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "../types/JwtPayload.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    try {
        if (!JWT_SECRET) {
            return res.status(500).json({ error: "JWT secret not configured" });
        }
        const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
        const user = await getUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = {
            userId: decoded.userId,
            username: decoded.username,
            discriminator: decoded.discriminator,
            avatar: decoded.avatar,
            isAdmin: isAdmin(decoded.userId),
            iat: decoded.iat,
            exp: decoded.exp,
        };

        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ error: "Invalid token" });
    }
}