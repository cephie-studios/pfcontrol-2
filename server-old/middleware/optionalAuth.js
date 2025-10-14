import jwt from "jsonwebtoken";
import { getUserById } from "../db/users.js";
import { isAdmin } from "./isAdmin.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function optionalAuth(req, res, next) {
    const token = req.cookies.auth_token;

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await getUserById(decoded.userId);

        if (user) {
            req.user = {
                userId: decoded.userId,
                username: decoded.username,
                discriminator: decoded.discriminator,
                avatar: decoded.avatar,
                isAdmin: isAdmin(decoded.userId),
                rolePermissions: user.rolePermissions,
                id: user.id
            };
        }
    } catch (err) {
        console.log('Optional auth: Invalid token, continuing without authentication');
    }

    next();
}
