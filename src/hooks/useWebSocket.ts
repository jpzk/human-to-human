import { useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@/types/messages";

function getWsUrl(roomId: string): string {
  // ?screen opens a projector view that watches without playing
  const screen = new URLSearchParams(location.search).has("screen") ? "?screen=1" : "";
  const path = `/parties/main/${roomId}${screen}`;
  if (import.meta.env.DEV) {
    return `ws://127.0.0.1:1999${path}`;
  }
  // the frontend can live on another host than the PartyKit server (Vercel + partykit.dev)
  const host = import.meta.env.VITE_PARTYKIT_HOST || location.host;
  const protocol = location.protocol === "https:" || host.endsWith(".partykit.dev") ? "wss:" : "ws:";
  return `${protocol}//${host}${path}`;
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
    // Don't connect if roomId is empty
    if (!roomId) {
      setStatus("disconnected");
      return;
    }

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
