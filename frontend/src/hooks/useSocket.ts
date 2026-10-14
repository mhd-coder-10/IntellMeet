// Manages Socket.io connection lifecycle
// Uses withCredentials to send HttpOnly auth cookies with memory-token fallback

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5100";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token: accessToken || "" },
      withCredentials: true, // Send HttpOnly cookie with WebSocket handshake
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    newSocket.on("reconnect", (attempt) => {
      console.log("Socket reconnected after", attempt, "attempts");
      setIsConnected(true);
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, accessToken]);

  return { socket, isConnected };
}