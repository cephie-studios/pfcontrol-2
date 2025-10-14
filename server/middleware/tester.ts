import jwt from "jsonwebtoken";
import { isTester as checkIsTester, getTesterSettings } from '../db/testers.js';
import { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../types/JwtPayload.js";

const JWT_SECRET = process.env.JWT_SECRET;

export async function requireTester(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await getTesterSettings();
        if (!settings.tester_gate_enabled) {
            return next();
        }

        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: "Authentication required" });
        }

        if (!JWT_SECRET) {
            console.error('JWT_SECRET is not defined');
            return res.status(500).json({ error: "Server configuration error" });
        }

        const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
        const userIsTester = await checkIsTester(decoded.userId);

        if (!userIsTester) {
            return res.status(403).json({ error: "Tester access required" });
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.error('Tester auth error:', err);
        return res.status(401).json({ error: "Invalid token" });
    }
}

export async function isTester(userId: string) {
    try {
        return await checkIsTester(userId);
    } catch (error) {
        console.error('Error checking tester status:', error);
        return false;
    }
}

export async function checkTesterGateStatus() {
    try {
        const settings = await getTesterSettings();
        return settings.tester_gate_enabled || false;
    } catch (error) {
        console.error('Error checking tester gate status:', error);
        return true;
    }
}