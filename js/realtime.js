// js/realtime.js — Collaboration en temps réel via WebSocket.
// Modèle sans conflit : chaque codeur est PROPRIÉTAIRE de ses segments
// (étiquetés à son nom). À chaque sauvegarde, il diffuse ses codes et ses
// segments ; les autres remplacent la contribution de ce codeur et gardent
// la leur. Le serveur (server/sync-server.mjs, fourni) ne stocke rien :
// il relaie les messages d'une salle — les données restent dans l'équipe.

let ws = null;
let current = { url: "", room: "", coder: "", connected: false, peers: [] };
let handlers = { onRemoteUpdate: null, onStatus: null };
let reconnectTimer = null;
let shouldReconnect = false;

export function setRtHandlers(h) { handlers = { ...handlers, ...h }; }
export function rtStatus() { return { ...current }; }

export function rtConnect({ url, room, coder }) {
  rtDisconnect();
  shouldReconnect = true;
  current = { url, room, coder, connected: false, peers: [] };
  open();
}

function open() {
  try {
    ws = new WebSocket(current.url);
  } catch (e) {
    notify("error", String(e.message || e));
    return;
  }
  ws.onopen = () => {
    current.connected = true;
    ws.send(JSON.stringify({ type: "join", room: current.room, coder: current.coder }));
    notify("connected");
  };
  ws.onmessage = ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === "presence") {
      current.peers = (msg.coders || []).filter(c => c !== current.coder);
      notify("presence");
    } else if (msg.type === "update" && msg.coder && msg.coder !== current.coder) {
      if (handlers.onRemoteUpdate) handlers.onRemoteUpdate(msg);
    } else if (msg.type === "hello" && msg.coder !== current.coder) {
      // Un nouveau participant : on lui renvoie notre état courant
      notify("peer-joined", msg.coder);
    }
  };
  ws.onclose = () => {
    const wasConnected = current.connected;
    current.connected = false;
    current.peers = [];
    notify("disconnected");
    // Reconnexion automatique (réseau intermittent) tant que non arrêté
    if (shouldReconnect && wasConnected) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(open, 3000);
    }
  };
  ws.onerror = () => notify("error", "websocket");
}

export function rtDisconnect() {
  shouldReconnect = false;
  clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch { /* déjà fermé */ } ws = null; }
  current.connected = false;
  current.peers = [];
}

// Diffuse la contribution du codeur local (appelé après chaque sauvegarde)
export function rtBroadcast({ codes, segments, projectName, docNames }) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: "update", room: current.room, coder: current.coder,
    projectName, codes, segments, docNames, at: Date.now(),
  }));
}

function notify(status, detail) {
  if (handlers.onStatus) handlers.onStatus(status, detail);
}
