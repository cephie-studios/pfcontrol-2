import jwt from "jsonwebtoken";
import { getUserById } from "../db/users.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function requireAuth(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = {
            id: user.id,
            username: user.username,
            ...decoded
        };

        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ error: "Invalid token" });
    }
}