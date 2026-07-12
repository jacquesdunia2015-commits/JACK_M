// js/conceptmap.js — Éditeur de cartes conceptuelles SVG
// Nœuds déplaçables, flèches, modes sélection / ajout / lien, export SVG.

import { uid } from "./state.js";
import { t } from "./i18n.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_COLORS = ["#4e79a7","#f28e2b","#e15759","#59a14f","#b07aa1","#76b7b2","#edc948"];
let _colorIdx = 0;
function nextColor() { return NODE_COLORS[(_colorIdx++) % NODE_COLORS.length]; }

export function openConceptMapEditor(project, onSave) {
  if (!project.conceptMaps) project.conceptMaps = [];

  // ── State
  let mapIdx = 0;
  let mode = "select"; // select | add | link
  let selectedNodeId = null;
  let selectedEdgeId = null;
  let linkSourceId = null;

  function getMap() { return project.conceptMaps[mapIdx] ?? null; }
  function save() { onSave(); }

  // ── Build modal DOM ──────────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal wide";
  modal.style.cssText = "max-width:920px;width:96vw;display:flex;flex-direction:column";
  overlay.appendChild(modal);

  // Header
  const hdr = document.createElement("div");
  hdr.className = "modal-header";
  const hdrTitle = document.createElement("span");
  hdrTitle.textContent = t("concept_maps_title");
  const hdrClose = document.createElement("button");
  hdrClose.className = "modal-close";
  hdrClose.textContent = "×";
  hdr.appendChild(hdrTitle);
  hdr.appendChild(hdrClose);
  modal.appendChild(hdr);

  // Body (no padding, flex column)
  const body = document.createElement("div");
  body.className = "modal-body";
  body.style.cssText = "padding:0;overflow:hidden;display:flex;flex-direction:column;flex:1";
  modal.appendChild(body);

  // Toolbar
  const tb = document.createElement("div");
  tb.style.cssText =
    "display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;" +
    "border-bottom:1px solid var(--border);align-items:center;background:var(--bg-ribbon)";
  body.appendChild(tb);

  function sep() {
    const d = document.createElement("div");
    d.style.cssText = "width:1px;background:var(--border);height:22px;margin:0 2px";
    tb.appendChild(d);
  }
  function tbBtn(label, primary) {
    const b = document.createElement("button");
    b.className = "btn" + (primary ? " primary" : "");
    b.textContent = label;
    tb.appendChild(b);
    return b;
  }

  const mapSel = document.createElement("select");
  mapSel.style.cssText =
    "padding:4px 8px;border:1px solid var(--border);border-radius:6px;" +
    "background:var(--bg);color:var(--text);font-size:13px;max-width:180px";
  tb.appendChild(mapSel);
  const btnNewMap = tbBtn("+ " + t("new_concept_map"));
  sep();
  const btnSelect = tbBtn("✋ " + t("select_mode"));
  const btnAdd    = tbBtn("＋ " + t("add_node"));
  const btnLink   = tbBtn("→ " + t("link_mode"));
  sep();
  const btnDelete    = tbBtn("🗑️ " + t("delete_sel"));
  const btnExportSVG = tbBtn("📥 " + t("export_svg"));

  // SVG canvas
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 800 500");
  svg.style.cssText =
    "width:100%;height:500px;background:var(--bg);display:block;cursor:default;touch-action:none;flex-shrink:0";
  body.appendChild(svg);

  // Defs – arrowhead marker
  const defs = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", "qc-arrow");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "3.5");
  marker.setAttribute("orient", "auto");
  const arrowPoly = document.createElementNS(SVG_NS, "polygon");
  arrowPoly.setAttribute("points", "0 0,10 3.5,0 7");
  arrowPoly.setAttribute("fill", "#777");
  marker.appendChild(arrowPoly);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Layer groups
  const edgeG = document.createElementNS(SVG_NS, "g");
  const nodeG = document.createElementNS(SVG_NS, "g");
  svg.appendChild(edgeG);
  svg.appendChild(nodeG);

  // Footer
  const ftr = document.createElement("div");
  ftr.className = "modal-footer";
  const btnClose = document.createElement("button");
  btnClose.className = "btn primary";
  btnClose.textContent = t("close");
  ftr.appendChild(btnClose);
  modal.appendChild(ftr);

  document.getElementById("modalRoot").appendChild(overlay);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function toSVG(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function setMode(m) {
    mode = m;
    if (m !== "link") linkSourceId = null;
    [btnSelect, btnAdd, btnLink].forEach(b => b.classList.remove("primary"));
    (m === "select" ? btnSelect : m === "add" ? btnAdd : btnLink).classList.add("primary");
    svg.style.cursor = m === "add" ? "crosshair" : "default";
    render();
  }

  function refreshMapSel() {
    mapSel.innerHTML = "";
    if (!project.conceptMaps.length) {
      const opt = document.createElement("option");
      opt.value = "-1";
      opt.textContent = t("no_concept_maps");
      mapSel.appendChild(opt);
    } else {
      project.conceptMaps.forEach((m, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.selected = (i === mapIdx);
        opt.textContent = m.name;
        mapSel.appendChild(opt);
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    edgeG.innerHTML = "";
    nodeG.innerHTML = "";
    const map = getMap();
    if (!map) return;

    // ── Edges
    for (const edge of map.edges) {
      const fn = map.nodes.find(n => n.id === edge.from);
      const tn = map.nodes.find(n => n.id === edge.to);
      if (!fn || !tn) continue;

      const isSel = edge.id === selectedEdgeId;
      const stroke = isSel ? "#2660a4" : "#999";
      const sw = isSel ? "2.5" : "1.8";

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", fn.x); line.setAttribute("y1", fn.y);
      line.setAttribute("x2", tn.x); line.setAttribute("y2", tn.y);
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", sw);
      line.setAttribute("marker-end", "url(#qc-arrow)");
      edgeG.appendChild(line);

      // Wider invisible hit area
      const hit = document.createElementNS(SVG_NS, "line");
      hit.setAttribute("x1", fn.x); hit.setAttribute("y1", fn.y);
      hit.setAttribute("x2", tn.x); hit.setAttribute("y2", tn.y);
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "14");
      hit.style.cursor = "pointer";
      edgeG.appendChild(hit);

      // Edge label
      if (edge.label) {
        const tx = document.createElementNS(SVG_NS, "text");
        tx.setAttribute("x", (fn.x + tn.x) / 2);
        tx.setAttribute("y", (fn.y + tn.y) / 2 - 6);
        tx.setAttribute("text-anchor", "middle");
        tx.setAttribute("font-size", "11");
        tx.setAttribute("fill", "#777");
        tx.style.pointerEvents = "none";
        tx.textContent = edge.label;
        edgeG.appendChild(tx);
      }

      // Edge click handler
      const edgeClick = ev => {
        if (mode !== "select") return;
        ev.stopPropagation();
        selectedEdgeId = edge.id;
        selectedNodeId = null;
        render();
      };
      line.addEventListener("click", edgeClick);
      hit.addEventListener("click", edgeClick);
    }

    // ── Nodes
    for (const node of map.nodes) {
      const w = node.width || 120;
      const h = node.height || 36;
      const isSel = node.id === selectedNodeId;
      const isLinkSrc = node.id === linkSourceId;

      const g = document.createElementNS(SVG_NS, "g");
      g.style.cursor = "move";

      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", node.x - w / 2);
      rect.setAttribute("y", node.y - h / 2);
      rect.setAttribute("width", w);
      rect.setAttribute("height", h);
      rect.setAttribute("rx", "6");
      rect.setAttribute("fill", node.color || "#4e79a7");
      rect.setAttribute("stroke", isLinkSrc ? "#ffcc00" : (isSel ? "#fff" : "rgba(0,0,0,0.15)"));
      rect.setAttribute("stroke-width", isLinkSrc || isSel ? "2.5" : "1");
      g.appendChild(rect);

      const tx = document.createElementNS(SVG_NS, "text");
      tx.setAttribute("x", node.x);
      tx.setAttribute("y", node.y + 5);
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("font-size", "13");
      tx.setAttribute("fill", "#fff");
      tx.style.pointerEvents = "none";
      tx.style.userSelect = "none";
      tx.textContent = node.label || "";
      g.appendChild(tx);

      nodeG.appendChild(g);

      // Double-click → rename
      g.addEventListener("dblclick", ev => {
        if (mode !== "select") return;
        ev.stopPropagation();
        const lbl = prompt(t("node_label_q"), node.label || "");
        if (lbl !== null) {
          node.label = lbl;
          node.width = Math.max(70, Math.min(260, lbl.length * 8 + 24));
          save(); render();
        }
      });

      // Click → select or link
      g.addEventListener("click", ev => {
        ev.stopPropagation();
        if (mode === "select") {
          selectedNodeId = node.id;
          selectedEdgeId = null;
          render();
        } else if (mode === "link") {
          if (!linkSourceId) {
            linkSourceId = node.id;
            render();
          } else if (linkSourceId !== node.id) {
            const map2 = getMap();
            if (map2) {
              map2.edges.push({ id: uid(), from: linkSourceId, to: node.id, label: "" });
              save();
            }
            linkSourceId = null;
            render();
          }
        }
      });

      // Mousedown → drag (select mode only)
      g.addEventListener("mousedown", ev => {
        if (mode !== "select" || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        selectedNodeId = node.id;
        selectedEdgeId = null;
        render();

        const svgStart = toSVG(ev);
        const origX = node.x, origY = node.y;

        const onMove = e2 => {
          const c = toSVG(e2);
          node.x = Math.max(10, Math.min(790, origX + c.x - svgStart.x));
          node.y = Math.max(10, Math.min(490, origY + c.y - svgStart.y));
          render();
        };
        const onUp = () => {
          save();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }
  }

  // ── SVG background click → add node or deselect
  svg.addEventListener("click", ev => {
    if (ev.target !== svg && ev.target !== edgeG && ev.target !== nodeG) return;
    if (mode === "add") {
      const coords = toSVG(ev);
      const lbl = prompt(t("node_label_q"), "");
      if (lbl === null) return;
      const map = getMap();
      if (!map) return;
      const w = Math.max(70, Math.min(260, (lbl.length || 4) * 8 + 24));
      map.nodes.push({
        id: uid(), label: lbl,
        x: Math.round(coords.x), y: Math.round(coords.y),
        color: nextColor(), width: w, height: 36,
      });
      save(); render();
    } else if (mode === "select") {
      selectedNodeId = null;
      selectedEdgeId = null;
      linkSourceId = null;
      render();
    }
  });

  // ── Toolbar button handlers
  btnSelect.onclick = () => setMode("select");
  btnAdd.onclick    = () => setMode("add");
  btnLink.onclick   = () => setMode("link");

  btnNewMap.onclick = () => {
    const name = prompt(t("map_name_q"), "");
    if (!name) return;
    project.conceptMaps.push({ id: uid(), name, nodes: [], edges: [] });
    mapIdx = project.conceptMaps.length - 1;
    save();
    refreshMapSel();
    render();
  };

  mapSel.onchange = () => {
    const v = Number(mapSel.value);
    if (v >= 0 && v < project.conceptMaps.length) {
      mapIdx = v;
      selectedNodeId = null;
      selectedEdgeId = null;
      linkSourceId = null;
      render();
    }
  };

  btnDelete.onclick = () => {
    const map = getMap();
    if (!map) return;
    if (selectedNodeId) {
      map.nodes = map.nodes.filter(n => n.id !== selectedNodeId);
      map.edges = map.edges.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId);
      selectedNodeId = null;
      save(); render();
    } else if (selectedEdgeId) {
      map.edges = map.edges.filter(e => e.id !== selectedEdgeId);
      selectedEdgeId = null;
      save(); render();
    }
  };

  btnExportSVG.onclick = () => {
    const map = getMap();
    if (!map) return;
    const serializer = new XMLSerializer();
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", "800");
    clone.setAttribute("height", "500");
    // Replace CSS custom properties for standalone SVG
    clone.querySelectorAll("polygon[fill='#777']").forEach(p => p.setAttribute("fill", "#777"));
    // White background rect
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
    bg.setAttribute("width", "800"); bg.setAttribute("height", "500");
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (map.name || "carte") + ".svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Close
  const close = () => overlay.remove();
  hdrClose.onclick = close;
  btnClose.onclick = close;
  overlay.addEventListener("mousedown", ev => { if (ev.target === overlay) close(); });

  // ── Initial render
  refreshMapSel();
  setMode("select");
}
