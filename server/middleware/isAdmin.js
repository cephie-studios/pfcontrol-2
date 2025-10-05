import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;

function getAdminIds() {
    try {
        const adminsPath = path.join(__dirname, '..', 'data', 'admins.json');
        const adminIds = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
        return adminIds;
    } catch (error) {
        console.error('Error reading admin IDs:', error);
        return [];
    }
}

function isAdmin(userId) {
    const adminIds = getAdminIds();
    return adminIds.includes(userId);
}

function requireAdmin(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const adminIds = getAdminIds();

        if (!adminIds.includes(decoded.userId)) {
            return res.status(403).json({ error: "Admin access required" });
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.error('Admin auth error:', err);
        return res.status(401).json({ error: "Invalid token" });
    }
}

export { requireAdmin, isAdmin, getAdminIds };