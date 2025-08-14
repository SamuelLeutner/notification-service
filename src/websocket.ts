import { Elysia } from "elysia";

export function setupWebSocket(app: Elysia) {
  app.ws("/ws", {
    open(ws) {
      console.log("Client connected via WebSocket");
    },
    message(ws, message) {
      console.log("Message from client:", message);
    },
  });
}

export function broadcastWS(app: Elysia, event: any) {
  for (const ws of app.server?.clients ?? []) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
