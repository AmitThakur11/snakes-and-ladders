import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import next from "next";
import { Server } from "socket.io";
import { registerRoomHandlers } from "./src/server/rooms";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address)
    .filter((ip) => !ip.startsWith("169.254.")) // link-local, unreachable from other devices
    .sort((a, b) => Number(isHomeNetwork(b)) - Number(isHomeNetwork(a)));
}

function isHomeNetwork(ip: string): boolean {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

// Next.js gets the http server too, so it can handle its own dev websocket (HMR) upgrades.
const httpServer = createServer((req, res) => handle(req, res));
const app = next({ dev, hostname, port, httpServer });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const io = new Server(httpServer);
  registerRoomHandlers(io, { lanAddresses: lanAddresses(), port });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`> On your network: http://${ip}:${port}`);
  });
});
