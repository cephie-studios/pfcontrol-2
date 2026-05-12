import { Server as SocketServer } from "socket.io";
import type { Server } from "http";
import { createHandshakeRateLimiter } from "./handshakeRateLimit.js";
import { SOCKET_IO_ALLOWED_ORIGINS } from "../utils/deployedFrontendOrigins.js";

let notificationsIO: SocketServer | null = null;

export function setupNotificationsWebsocket(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    path: "/sockets/notifications",
    allowRequest: createHandshakeRateLimiter({ scope: "notifications" }),
    cors: {
      origin: [...SOCKET_IO_ALLOWED_ORIGINS],
      credentials: true,
    },
    perMessageDeflate: {
      threshold: 512,
    },
  });

  notificationsIO = io;

  io.on("connection", (socket) => {
    socket.join("notifications");

    socket.on("disconnect", () => {
      // socket.io handles cleanup
    });
  });

  process.on("SIGTERM", () => {
    io.close();
  });

  return io;
}

export function broadcastNotificationsUpdate() {
  if (notificationsIO) {
    notificationsIO.to("notifications").emit("notificationsUpdated");
  }
}