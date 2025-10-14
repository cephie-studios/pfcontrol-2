import jwt from "jsonwebtoken";
import { isTester as checkIsTester, getTesterSettings } from '../db/testers.js';

const JWT_SECRET = process.env.JWT_SECRET;

export async function requireTester(req, res, next) {
    try {
        const settings = await getTesterSettings();
        if (!settings.tester_gate_enabled) {
            return next();
        }

        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
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

export async function isTester(userId) {
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