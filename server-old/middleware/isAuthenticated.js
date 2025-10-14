import jwt from "jsonwebtoken";
import { getUserById } from "../db/users.js";
import { isAdmin } from "./isAdmin.js";

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
            userId: decoded.userId,
            username: decoded.username,
            discriminator: decoded.discriminator,
            avatar: decoded.avatar,
            isAdmin: isAdmin(decoded.userId),
            rolePermissions: user.rolePermissions,
            id: user.id
        };

        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ error: "Invalid token" });
    }
}