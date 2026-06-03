import io from "socket.io-client";
import { getClientApiBase } from "../utils/clientApiBase";

export function createNotificationsSocket(onUpdate: () => void) {
  const base = getClientApiBase();
  const socket = io(base, {
    withCredentials: true,
    path: "/sockets/notifications",
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });

  socket.on("notificationsUpdated", onUpdate);

  return socket;
}
