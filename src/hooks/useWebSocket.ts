import { useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@/types/messages";

function getWsUrl(roomId: string): string {
  const path = `/parties/main/${roomId}`;
  if (import.meta.env.DEV) {
    return `ws://127.0.0.1:1999${path}`;
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${path}`;
}

type UseWebSocketOptions = {
  roomId: string;
  onMessage: (msg: ServerMessage) => void;
};

export function useWebSocket({ roomId, onMessage }: UseWebSocketOptions) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  const sendMessage = (message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    // Close existing connection if roomId changes
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus("connecting");
    }

    const ws = new WebSocket(getWsUrl(roomId));
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        onMessage(msg);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, onMessage]);

  return { status, sendMessage };
}
