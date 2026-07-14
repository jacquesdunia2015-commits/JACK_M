// js/audio.js — Lecteur audio/vidéo horodaté pour la transcription et la relecture
// Aucun serveur : le média est lu localement (URL blob, jamais téléversé).
// Les horodatages [hh:mm:ss] ou [mm:ss] du texte deviennent cliquables.
// La barre de lecture fonctionne avec tout HTMLMediaElement (audio OU vidéo).

import { t } from "./i18n.js";

const VIDEO_EXT = /\.(mp4|webm|mkv|mov|m4v|avi|3gp|ogv)$/i;

export function isVideoFile(file) {
  return (file.type || "").startsWith("video/") || VIDEO_EXT.test(file.name || "");
}

// Crée l'élément média adapté au fichier : <video> (image visible) ou Audio.
// Retourne { el, isVideo, url } — penser à révoquer l'URL quand on abandonne.
export function createMediaElement(file) {
  const url = URL.createObjectURL(file);
  const isVideo = isVideoFile(file);
  let el;
  if (isVideo) {
    el = document.createElement("video");
    el.className = "media-video";
    el.playsInline = true;
    el.preload = "metadata";
    el.src = url;
    // Clic sur l'image = lecture/pause (en plus de la barre)
    el.addEventListener("click", () => { el.paused ? el.play() : el.pause(); });
  } else {
    el = new Audio(url);
    el.preload = "metadata";
  }
  return { el, isVideo, url };
}

// [12:34] ou [1:02:34] — capturés avec leurs crochets
export const TS_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

export function parseTs(h, m, s) {
  return s !== undefined && s !== null && s !== ""
    ? Number(h) * 3600 + Number(m) * 60 + Number(s)
    : Number(h) * 60 + Number(m);
}

export function fmtTs(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h > 0 ? `[${h}:${mm}:${ss}]` : `[${mm}:${ss}]`;
}

// Rend cliquables les horodatages d'un conteneur, sans modifier le texte
// (les nœuds texte sont découpés, textContent reste identique : les offsets
// de codage par caractères ne sont pas affectés).
export function wrapTimestamps(rootEl, onClick) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      TS_RE.lastIndex = 0; // le drapeau /g conserve lastIndex entre les appels
      return TS_RE.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) {
    if (node.parentElement?.closest(".ts")) continue;
    const frag = document.createDocumentFragment();
    let last = 0, m2;
    TS_RE.lastIndex = 0;
    const txt = node.textContent;
    while ((m2 = TS_RE.exec(txt)) !== null) {
      if (m2.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m2.index)));
      const span = document.createElement("span");
      span.className = "ts";
      span.textContent = m2[0];
      span.title = t("ts_click_hint");
      const sec = m2[3] !== undefined ? parseTs(m2[1], m2[2], m2[3]) : parseTs(m2[1], m2[2]);
      span.addEventListener("click", e => { e.stopPropagation(); onClick(sec); });
      frag.appendChild(span);
      last = m2.index + m2[0].length;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
}

// Barre de lecture réutilisable branchée sur un élément <audio>.
// onCopyTs (optionnel) reçoit l'horodatage formaté du moment courant.
export function buildPlayerBar(audio, { onCopyTs } = {}) {
  const bar = document.createElement("div");
  bar.className = "audio-bar";

  const btn = (label, title) => {
    const b = document.createElement("button");
    b.className = "mini-btn audio-btn";
    b.textContent = label;
    b.title = title;
    bar.appendChild(b);
    return b;
  };

  const bBack = btn("⏪ 5s", t("back5"));
  const bPlay = btn("▶️", t("play_pause"));
  const bFwd = btn("5s ⏩", t("fwd5"));

  const time = document.createElement("span");
  time.className = "audio-time";
  time.textContent = "00:00 / 00:00";
  bar.appendChild(time);

  const seek = document.createElement("input");
  seek.type = "range";
  seek.min = "0"; seek.max = "100"; seek.value = "0"; seek.step = "0.1";
  seek.className = "audio-seek";
  bar.appendChild(seek);

  const speed = document.createElement("select");
  speed.className = "audio-speed";
  speed.title = t("speed");
  for (const v of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    const o = document.createElement("option");
    o.value = String(v);
    o.textContent = v + "×";
    if (v === 1) o.selected = true;
    speed.appendChild(o);
  }
  bar.appendChild(speed);

  const bCopy = btn("⏱ " + t("ts_copy"), t("ts_copy_hint"));

  const fmtClock = s => {
    const sec = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), r = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(r).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };
  const refresh = () => {
    bPlay.textContent = audio.paused ? "▶️" : "⏸";
    time.textContent = fmtClock(audio.currentTime) + " / " + fmtClock(audio.duration);
    if (audio.duration && !seek.matches(":active"))
      seek.value = String((audio.currentTime / audio.duration) * 100);
  };

  bPlay.onclick = () => { audio.paused ? audio.play() : audio.pause(); };
  bBack.onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); };
  bFwd.onclick = () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 5); };
  speed.onchange = () => { audio.playbackRate = Number(speed.value); };
  seek.oninput = () => { if (audio.duration) audio.currentTime = (Number(seek.value) / 100) * audio.duration; };
  bCopy.onclick = () => { if (onCopyTs) onCopyTs(fmtTs(audio.currentTime)); };

  audio.addEventListener("timeupdate", refresh);
  audio.addEventListener("play", refresh);
  audio.addEventListener("pause", refresh);
  audio.addEventListener("loadedmetadata", refresh);
  refresh();

  return bar;
}
