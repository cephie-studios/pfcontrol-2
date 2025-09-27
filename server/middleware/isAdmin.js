// middlewares/isAdmin.js
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

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

function requireAdmin(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const adminIds = getAdminIds();
        if (!adminIds.includes(decoded.id)) {
            return res.status(403).json({ error: "Not an admin" });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

export default requireAdmin;