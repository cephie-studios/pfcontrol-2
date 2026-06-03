import jwt, { type JwtPayload } from "jsonwebtoken";

const TOKEN_TYP = "dev_notify_unsub";

function apiOriginForEmailLinks(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const fe = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");
  const port = process.env.PORT?.trim() || "9901";

  if (fe) {
    try {
      const u = new URL(fe);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const vitePort = u.port === "5173" || u.port === "4173";
      if (local && vitePort) {
        return `${u.protocol}//${u.hostname}:${port}`;
      }
    } catch {
      // use fe below
    }
    return fe;
  }

  return `http://localhost:${port}`;
}

export function createDeveloperNotificationUnsubscribeToken(
  userId: string,
  email: string
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  const em = email.trim().toLowerCase();
  return jwt.sign({ typ: TOKEN_TYP, sub: userId, em }, secret, {
    expiresIn: "180d",
  });
}

export function verifyDeveloperNotificationUnsubscribeToken(token: string): {
  userId: string;
  email: string;
} | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload & {
      typ?: string;
      sub?: string;
      em?: string;
    };
    if (
      decoded.typ !== TOKEN_TYP ||
      typeof decoded.sub !== "string" ||
      typeof decoded.em !== "string"
    ) {
      return null;
    }
    return { userId: decoded.sub, email: decoded.em.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export function createDeveloperNotificationUnsubscribeUrl(
  userId: string,
  email: string
): string {
  const t = createDeveloperNotificationUnsubscribeToken(userId, email);
  const origin = apiOriginForEmailLinks();
  return `${origin}/api/developer/notification-unsubscribe?token=${encodeURIComponent(t)}`;
}
