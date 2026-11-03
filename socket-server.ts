// Standalone game server (Socket.IO only) for hosting the backend apart from the frontend,
// e.g. backend on Render and the Next.js frontend on Vercel.
import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerRoomHandlers } from "./src/server/rooms";

const port = Number(process.env.PORT) || 4000;
// Comma-separated frontend origins allowed to connect, e.g. "https://my-app.vercel.app".
const origins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  // Health check for the host (and a quick way to wake a sleeping free instance).
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Snakes & Ladders game server is running");
});

const io = new Server(httpServer, { cors: { origin: origins } });
registerRoomHandlers(io, { lanAddresses: [], port });

httpServer.listen(port, () => {
  console.log(`> Game server on port ${port}, allowing ${origins.join(", ")}`);
});
