#!/usr/bin/env node
// QualiCode — Serveur de synchronisation temps réel (zéro dépendance).
// Relaie les messages entre les membres d'une « salle » (un projet d'équipe).
// Il NE STOCKE AUCUNE DONNÉE : simple relais en mémoire, conforme à la
// philosophie de QualiCode (les données restent chez les chercheurs).
//
//   Lancement :  node server/sync-server.mjs [port]     (défaut : 8765)
//   Production : à placer derrière un proxy TLS (wss://) — nginx/Caddy.
//
// Implémentation WebSocket minimale (RFC 6455) sans bibliothèque externe.

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.argv[2]) || 8765;
const MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const rooms = new Map(); // room → Set<socket>

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("QualiCode sync server — connectez l'application via ws://…\n");
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  const accept = createHash("sha1").update(key + MAGIC).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.qcBuffer = Buffer.alloc(0);
  socket.qcRoom = null;
  socket.qcCoder = null;
  socket.on("data", chunk => {
    socket.qcBuffer = Buffer.concat([socket.qcBuffer, chunk]);
    let frame;
    while ((frame = readFrame(socket))) {
      if (frame.opcode === 8) { cleanup(socket); socket.end(); return; }
      if (frame.opcode === 9) { socket.write(encodeFrame(frame.payload, 10)); continue; } // ping→pong
      if (frame.opcode !== 1) continue; // texte uniquement
      handleMessage(socket, frame.payload.toString("utf8"));
    }
  });
  socket.on("close", () => cleanup(socket));
  socket.on("error", () => cleanup(socket));
});

function handleMessage(socket, text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (msg.type === "join" && typeof msg.room === "string" && msg.room) {
    cleanup(socket);
    socket.qcRoom = msg.room.slice(0, 80);
    socket.qcCoder = String(msg.coder || "codeur").slice(0, 60);
    if (!rooms.has(socket.qcRoom)) rooms.set(socket.qcRoom, new Set());
    rooms.get(socket.qcRoom).add(socket);
    broadcastPresence(socket.qcRoom);
    relay(socket, JSON.stringify({ type: "hello", coder: socket.qcCoder }));
    return;
  }
  // Tout autre message : relayé tel quel aux autres membres de la salle
  if (socket.qcRoom) relay(socket, text);
}

function relay(from, text) {
  const peers = rooms.get(from.qcRoom);
  if (!peers) return;
  const frame = encodeFrame(Buffer.from(text, "utf8"), 1);
  for (const s of peers) if (s !== from && !s.destroyed) s.write(frame);
}

function broadcastPresence(room) {
  const peers = rooms.get(room);
  if (!peers) return;
  const coders = [...peers].map(s => s.qcCoder);
  const frame = encodeFrame(Buffer.from(JSON.stringify({ type: "presence", coders }), "utf8"), 1);
  for (const s of peers) if (!s.destroyed) s.write(frame);
}

function cleanup(socket) {
  if (socket.qcRoom && rooms.has(socket.qcRoom)) {
    rooms.get(socket.qcRoom).delete(socket);
    if (rooms.get(socket.qcRoom).size === 0) rooms.delete(socket.qcRoom);
    else broadcastPresence(socket.qcRoom);
  }
  socket.qcRoom = null;
}

/* ---- Cadres WebSocket (client→serveur : masqués ; serveur→client : non) ---- */
function readFrame(socket) {
  const buf = socket.qcBuffer;
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f, off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const maskLen = masked ? 4 : 0;
  if (buf.length < off + maskLen + len) return null;
  let payload = buf.subarray(off + maskLen, off + maskLen + len);
  if (masked) {
    const mask = buf.subarray(off, off + 4);
    const out = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  socket.qcBuffer = buf.subarray(off + maskLen + len);
  if (!fin) return { opcode: 0, payload: Buffer.alloc(0) }; // fragments ignorés (messages courts)
  return { opcode, payload };
}

function encodeFrame(payload, opcode) {
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

server.listen(PORT, () => {
  console.log(`QualiCode sync server prêt sur le port ${PORT} (ws://localhost:${PORT})`);
});
