// middlewares/isAuthenticated.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}

export default requireAuth;