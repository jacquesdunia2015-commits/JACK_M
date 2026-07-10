// QualiCode — application d'analyse qualitative de données (MVP du cahier des charges)
import { t, setLang, getLang, applyStaticTranslations } from "./i18n.js";
import {
  state, emptyProject, normalizeProject, uid, CODE_COLORS,
  scheduleSave, persistNow, loadPersisted, setOnSaved, savePrefs, loadPrefs,
  getDoc, getCode, getGroup, getSegment, childCodes, segmentsOfDoc,
  addDocument, addGroup, addCode, addSegment, deleteSegment,
  trashDocument, trashCode, restoreTrashedDoc, restoreTrashedCode,
  upsertMemo, getMemo,
} from "./state.js";
import {
  searchDocuments, wordFrequencies, kwic, codeMatrix, coocMatrix,
  groupComparison, variableStats, flatCodes,
} from "./analysis.js";
import { exportProject, exportSegmentsCsv, exportCodeSystem, exportMatrixCsv, exportReportDocx, openPrintableReport } from "./export.js";
import { buildSampleProject } from "./sample.js";
import { extractDocxText } from "./docx.js";
import { isEncryptedEnvelope, encryptProjectJson, decryptProjectEnvelope } from "./crypto.js";
import { mergeProjects, coderLabels, interCoderAgreement, kappaInterpretation } from "./merge.js";

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const expandedCodes = new Set();   // codes dépliés dans l'arbre
const expandedGroups = new Set();  // groupes dépliés
let panel4Mode = "segments";       // segments | search
let searchResults = [];
let searchQuery = "";
let pendingSelection = null;       // {start, end} sélection en attente de codage
let projectPassword = null;        // mot de passe du projet, gardé en mémoire de session uniquement

/* ================================================================
   Initialisation
================================================================ */
function init() {
  loadPrefs();
  setLang(state.ui.lang);
  document.body.classList.toggle("dark", state.ui.theme === "dark");
  $("#langLabel").textContent = getLang().toUpperCase();

  if (!loadPersisted()) {
    state.project = buildSampleProject();
    persistNow();
  }
  // Déplie les racines par défaut
  state.project.documentGroups.forEach(g => expandedGroups.add(g.id));
  childCodes(null).forEach(c => expandedCodes.add(c.id));

  setOnSaved(() => { $("#statusSaved").textContent = "✓ " + t("autosaved") + " · " + new Date().toLocaleTimeString(); });

  bindRibbon();
  bindPanels();
  bindSplitters();
  applyStaticTranslations();
  renderAll();
}

function renderAll() {
  applyStaticTranslations();
  renderDocTree();
  renderCodeTree();
  renderBrowser();
  renderPanel4();
  renderStatus();
  $("#projectName").textContent = state.project.name;
  $("#projectName").title = state.project.name;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ================================================================
   Modales génériques
================================================================ */
function openModal({ title, bodyHtml, wide = false, footer = [] }) {
  const root = $("#modalRoot");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${wide ? "wide" : ""}">
      <div class="modal-header"><span>${esc(title)}</span><button class="modal-close">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer"></div>
    </div>`;
  const close = () => overlay.remove();
  overlay.querySelector(".modal-close").onclick = close;
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });
  const footerEl = overlay.querySelector(".modal-footer");
  for (const b of footer) {
    const btn = document.createElement("button");
    btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
    btn.textContent = b.label;
    btn.onclick = () => b.onClick(overlay, close);
    footerEl.appendChild(btn);
  }
  if (!footer.length) footerEl.remove();
  root.appendChild(overlay);
  const firstInput = overlay.querySelector("input, textarea, select");
  if (firstInput) firstInput.focus();
  return { overlay, close, body: overlay.querySelector(".modal-body") };
}

function confirmModal(message, onYes) {
  openModal({
    title: t("confirm"),
    bodyHtml: `<p>${esc(message)}</p>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      { label: t("ok"), primary: true, onClick: (o, close) => { close(); onYes(); } },
    ],
  });
}

function promptModal(title, label, initial, onSubmit) {
  const m = openModal({
    title,
    bodyHtml: `<div class="form-row"><label>${esc(label)}</label><input type="text" id="pmInput" value="${esc(initial || "")}"></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      { label: t("ok"), primary: true, onClick: (o, close) => { const v = o.querySelector("#pmInput").value.trim(); if (v) { close(); onSubmit(v); } } },
    ],
  });
  m.body.querySelector("#pmInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { const v = e.target.value.trim(); if (v) { m.close(); onSubmit(v); } }
  });
}

/* ================================================================
   Ruban
================================================================ */
function bindRibbon() {
  $("#ribbonTabs").addEventListener("click", e => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll("#ribbonTabs button").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".ribbon-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === btn.dataset.tab));
  });

  $("#btnLang").onclick = () => {
    state.ui.lang = getLang() === "fr" ? "en" : "fr";
    setLang(state.ui.lang);
    $("#langLabel").textContent = getLang().toUpperCase();
    savePrefs();
    renderAll();
  };
  $("#btnTheme").onclick = () => {
    state.ui.theme = state.ui.theme === "dark" ? "light" : "dark";
    document.body.classList.toggle("dark", state.ui.theme === "dark");
    savePrefs();
  };

  // --- Accueil ---
  $("#btnNewProject").onclick = () => {
    promptModal(t("new_project_title"), t("project_name_q") + " — " + t("new_version_hint"), "", name => {
      state.project = emptyProject(name);
      state.ui.activatedDocs.clear(); state.ui.activatedCodes.clear();
      state.ui.currentDocId = null; state.ui.selectedCodeId = null;
      persistNow();
      renderAll();
    });
  };
  $("#btnSaveProject").onclick = async () => {
    persistNow();
    if (state.project.protected) {
      const pw = projectPassword || await askPassword();
      if (!pw) return;
      projectPassword = pw;
      exportProject(await encryptProjectJson(JSON.stringify(state.project), pw));
    } else {
      exportProject();
    }
    toast(t("project_saved_file"));
  };
  $("#btnOpenProject").onclick = () => $("#projInput").click();
  $("#projInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const p = await readProjectFile(file);
    if (!p) return;
    state.project = p;
    state.ui.activatedDocs.clear(); state.ui.activatedCodes.clear();
    state.ui.currentDocId = null; state.ui.selectedCodeId = null;
    state.project.documentGroups.forEach(g => expandedGroups.add(g.id));
    childCodes(null).forEach(c => expandedCodes.add(c.id));
    persistNow();
    renderAll();
    toast(t("project_loaded") + " : " + state.project.name);
  });
  $("#btnProtect").onclick = openProtectModal;
  $("#btnMergeProject").onclick = () => $("#mergeInput").click();
  $("#mergeInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const incoming = await readProjectFile(file);
    if (incoming) openMergeModal(incoming);
  });
  $("#btnSampleProject").onclick = () => {
    confirmModal(t("new_version_hint"), () => {
      state.project = buildSampleProject();
      state.ui.activatedDocs.clear(); state.ui.activatedCodes.clear();
      state.ui.currentDocId = state.project.documents[0]?.id ?? null;
      state.project.documentGroups.forEach(g => expandedGroups.add(g.id));
      state.project.codes.forEach(c => expandedCodes.add(c.id));
      persistNow();
      renderAll();
    });
  };
  $("#btnSearch").onclick = runSearch;
  $("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
  $("#btnTrash").onclick = openTrash;

  // --- Importer ---
  $("#btnImportFiles").onclick = () => $("#fileInput").click();
  $("#fileInput").addEventListener("change", async e => {
    const files = [...e.target.files];
    e.target.value = "";
    let imported = 0, failed = [];
    for (const f of files) {
      try {
        const text = /\.docx$/i.test(f.name)
          ? await extractDocxText(f)
          : (await f.text()).replace(/\r\n/g, "\n");
        addDocument(f.name.replace(/\.[^.]+$/, ""), text);
        imported++;
      } catch (err) {
        console.error("Import failed:", f.name, err);
        failed.push(f.name);
      }
    }
    if (imported) renderAll();
    if (failed.length) toast(t("import_failed") + " : " + failed.join(", "));
    else if (imported) toast(imported + " " + t("import_done"));
  });
  $("#btnImportCsv").onclick = () => $("#csvInput").click();
  $("#csvInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) importCsv(await file.text(), file.name.replace(/\.[^.]+$/, ""));
  });
  $("#btnPasteDoc").onclick = openPasteDoc;
  $("#btnStructuredText").onclick = openStructuredImport;
  $("#btnNewGroup").onclick = () => promptModal(t("new_group"), t("new_group_name"), "", name => {
    const g = addGroup(name); expandedGroups.add(g.id); renderDocTree();
  });

  // --- Codes ---
  $("#btnNewCode").onclick = () => openNewCodeModal(null);
  $("#btnAddRootCode").onclick = () => openNewCodeModal(null);
  $("#btnCodeSelection").onclick = () => {
    const sel = captureSelection();
    if (!sel) return toast(t("no_selection"));
    if (!state.ui.selectedCodeId) return toast(t("select_code_first"));
    applyCodeToSelection(state.ui.selectedCodeId, sel);
  };
  $("#btnInVivo").onclick = () => {
    const sel = captureSelection();
    if (!sel) return toast(t("no_selection"));
    inVivoCode(sel);
  };
  $("#btnAutoCode").onclick = openAutoCode;
  $("#chkHighlights").addEventListener("change", e => { state.ui.showHighlights = e.target.checked; renderBrowser(); });

  // --- Mémos ---
  $("#btnProjectMemo").onclick = () => openMemoEditor("project", null, state.project.name);
  $("#btnMemoManager").onclick = openMemoManager;

  // --- Variables ---
  $("#btnEditVariables").onclick = openVariablesList;
  $("#btnDataEditor").onclick = openDataEditor;

  // --- Analyse ---
  $("#btnCodeMatrix").onclick = openCodeMatrix;
  $("#btnCooc").onclick = openCooc;
  $("#btnGroupCompare").onclick = openGroupCompare;
  $("#btnWordFreq").onclick = openWordFreq;
  $("#btnKwic").onclick = openKwic;
  $("#btnStats").onclick = openStats;
  $("#btnKappa").onclick = openKappa;

  // --- Visualisation ---
  $("#btnPortrait").onclick = openPortrait;
  $("#btnWordCloud").onclick = openWordCloud;
  $("#btnBarChart").onclick = openBarChart;

  // --- Rapports ---
  $("#btnExportSegments").onclick = () => { exportSegmentsCsv(state.project.segments); toast(t("export_done")); };
  $("#btnExportDocx").onclick = () => { exportReportDocx(state.project.segments); toast(t("export_done")); };
  $("#btnExportReport").onclick = () => openPrintableReport(state.project.segments);
  $("#btnExportCodes").onclick = () => { exportCodeSystem(); toast(t("export_done")); };
  $("#btnExportMatrixCsv").onclick = () => { exportMatrixCsv(); toast(t("export_done")); };

  // Raccourci clavier : Alt+C = coder la sélection avec le code sélectionné (§2.4)
  document.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const sel = captureSelection();
      if (sel && state.ui.selectedCodeId) applyCodeToSelection(state.ui.selectedCodeId, sel);
    }
  });
}

/* ================================================================
   Volets et splitters
================================================================ */
function bindPanels() {
  $("#btnActivateAllDocs").onclick = () => {
    const all = state.project.documents.map(d => d.id);
    const allOn = all.length && all.every(id => state.ui.activatedDocs.has(id));
    state.ui.activatedDocs = allOn ? new Set() : new Set(all);
    renderDocTree(); renderPanel4();
  };
  $("#btnActivateAllCodes").onclick = () => {
    const all = state.project.codes.map(c => c.id);
    const allOn = all.length && all.every(id => state.ui.activatedCodes.has(id));
    state.ui.activatedCodes = allOn ? new Set() : new Set(all);
    renderCodeTree(); renderPanel4();
  };
  $("#retrievalMode").addEventListener("change", e => { state.ui.retrievalMode = e.target.value; renderPanel4(); });
  $("#btnDocMemo").onclick = () => {
    const doc = getDoc(state.ui.currentDocId);
    if (doc) openMemoEditor("document", doc.id, doc.name);
  };
  $("#btnDocProps").onclick = () => {
    const doc = getDoc(state.ui.currentDocId);
    if (doc) openDocProps(doc);
  };

  // Sélection de texte → menu de codage flottant
  $("#docBrowser").addEventListener("mouseup", e => {
    setTimeout(() => {
      const sel = getSelectionOffsets();
      if (sel) showCodingPopup(e.clientX, e.clientY, sel);
      else hideCodingPopup();
    }, 10);
  });
  document.addEventListener("mousedown", e => {
    if (!e.target.closest("#codingPopup")) hideCodingPopup();
  });
  $("#popupInVivo").onclick = () => { if (pendingSelection) { inVivoCode(pendingSelection); hideCodingPopup(); } };
  $("#popupNewCode").onclick = () => {
    const sel = pendingSelection;
    hideCodingPopup();
    if (sel) openNewCodeModal(null, code => applyCodeToSelection(code.id, sel));
  };
}

function bindSplitters() {
  const ws = $("#workspace");
  const drag = (el, onMove) => {
    el.addEventListener("mousedown", e => {
      e.preventDefault();
      const move = ev => onMove(ev);
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  };
  drag($("#splitV"), ev => {
    const w = Math.min(Math.max(ev.clientX - ws.getBoundingClientRect().left, 180), ws.clientWidth - 300);
    document.documentElement.style.setProperty("--left-w", w + "px");
  });
  const rowMove = ev => {
    const r = ws.getBoundingClientRect();
    const pct = Math.min(Math.max(((ev.clientY - r.top) / r.height) * 100, 15), 85);
    document.documentElement.style.setProperty("--top-h", pct + "%");
  };
  drag($("#splitH1"), rowMove);
  drag($("#splitH2"), rowMove);
}

/* ================================================================
   Volet 1 : arbre des documents
================================================================ */
function renderDocTree() {
  const root = $("#docTree");
  root.innerHTML = "";
  const ungrouped = state.project.documents.filter(d => !d.groupId || !getGroup(d.groupId));

  const docRow = doc => {
    const row = document.createElement("div");
    row.className = "tree-item" + (doc.id === state.ui.currentDocId ? " selected" : "");
    row.draggable = true;
    const n = segmentsOfDoc(doc.id).length;
    const memo = getMemo("document", doc.id);
    row.innerHTML = `
      <span class="caret"></span>
      <span class="activ ${state.ui.activatedDocs.has(doc.id) ? "on" : ""}" title="${esc(t("activate_all"))}">✅</span>
      <span class="label">📄 ${esc(doc.name)}</span>
      ${memo ? `<span class="memo-flag" title="${esc(memo.text.slice(0, 120))}">📝</span>` : ""}
      <span class="count">${n}</span>
      <span class="row-actions">
        <button data-act="memo" title="${esc(t("doc_memo"))}">📝</button>
        <button data-act="props" title="${esc(t("doc_props"))}">⚙️</button>
        <button data-act="del" title="${esc(t("delete"))}">🗑️</button>
      </span>`;
    row.querySelector(".activ").onclick = e => {
      e.stopPropagation();
      state.ui.activatedDocs.has(doc.id) ? state.ui.activatedDocs.delete(doc.id) : state.ui.activatedDocs.add(doc.id);
      renderDocTree(); renderPanel4();
    };
    row.onclick = () => { state.ui.currentDocId = doc.id; renderDocTree(); renderBrowser(); };
    row.querySelector("[data-act=memo]").onclick = e => { e.stopPropagation(); openMemoEditor("document", doc.id, doc.name); };
    row.querySelector("[data-act=props]").onclick = e => { e.stopPropagation(); openDocProps(doc); };
    row.querySelector("[data-act=del]").onclick = e => {
      e.stopPropagation();
      confirmModal(t("delete_doc_q"), () => { trashDocument(doc.id); renderAll(); });
    };
    row.addEventListener("dragstart", e => e.dataTransfer.setData("text/qualicode-doc", doc.id));
    return row;
  };

  for (const g of state.project.documentGroups) {
    const gr = document.createElement("div");
    gr.className = "tree-item group-row";
    const open = expandedGroups.has(g.id);
    gr.innerHTML = `<span class="caret">${open ? "▼" : "►"}</span><span class="label">📁 ${esc(g.name)}</span>
      <span class="count">${state.project.documents.filter(d => d.groupId === g.id).length}</span>
      <span class="row-actions"><button data-act="ren" title="${esc(t("rename"))}">✏️</button></span>`;
    gr.onclick = () => { open ? expandedGroups.delete(g.id) : expandedGroups.add(g.id); renderDocTree(); };
    gr.querySelector("[data-act=ren]").onclick = e => {
      e.stopPropagation();
      promptModal(t("rename"), t("new_group_name"), g.name, name => { g.name = name; scheduleSave(); renderDocTree(); });
    };
    gr.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/qualicode-doc")) e.preventDefault(); });
    gr.addEventListener("drop", e => {
      const id = e.dataTransfer.getData("text/qualicode-doc");
      const doc = getDoc(id);
      if (doc) { doc.groupId = g.id; scheduleSave(); renderDocTree(); }
    });
    root.appendChild(gr);
    if (open) {
      const kids = document.createElement("div");
      kids.className = "tree-children";
      state.project.documents.filter(d => d.groupId === g.id).forEach(d => kids.appendChild(docRow(d)));
      root.appendChild(kids);
    }
  }
  ungrouped.forEach(d => root.appendChild(docRow(d)));

  // Déposer hors groupe = retirer du groupe
  root.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/qualicode-doc")) e.preventDefault(); });
  root.addEventListener("drop", e => {
    if (e.target !== root) return;
    const id = e.dataTransfer.getData("text/qualicode-doc");
    const doc = getDoc(id);
    if (doc) { doc.groupId = null; scheduleSave(); renderDocTree(); }
  });
}

/* ================================================================
   Volet 2 : arbre des codes
================================================================ */
function renderCodeTree() {
  const root = $("#codeTree");
  root.innerHTML = "";
  const build = (parentId, container) => {
    for (const code of childCodes(parentId)) {
      const kids = childCodes(code.id);
      const open = expandedCodes.has(code.id);
      const n = state.project.segments.filter(s => s.codeId === code.id).length;
      const memo = getMemo("code", code.id);
      const row = document.createElement("div");
      row.className = "tree-item" + (code.id === state.ui.selectedCodeId ? " selected" : "");
      row.draggable = true;
      row.innerHTML = `
        <span class="caret">${kids.length ? (open ? "▼" : "►") : ""}</span>
        <span class="activ ${state.ui.activatedCodes.has(code.id) ? "on" : ""}">✅</span>
        <span class="code-dot" style="background:${esc(code.color)}"></span>
        <span class="label">${esc(code.name)}</span>
        ${memo ? `<span class="memo-flag" title="${esc(memo.text.slice(0, 120))}">📝</span>` : ""}
        <span class="count">${n}</span>
        <span class="row-actions">
          <button data-act="add" title="${esc(t("new_code"))}">＋</button>
          <button data-act="memo" title="${esc(t("memo_title"))}">📝</button>
          <button data-act="ren" title="${esc(t("rename"))}">✏️</button>
          <button data-act="del" title="${esc(t("delete"))}">🗑️</button>
        </span>`;
      row.querySelector(".caret").onclick = e => {
        e.stopPropagation();
        if (kids.length) { open ? expandedCodes.delete(code.id) : expandedCodes.add(code.id); renderCodeTree(); }
      };
      row.querySelector(".activ").onclick = e => {
        e.stopPropagation();
        state.ui.activatedCodes.has(code.id) ? state.ui.activatedCodes.delete(code.id) : state.ui.activatedCodes.add(code.id);
        renderCodeTree(); renderPanel4();
      };
      row.onclick = () => { state.ui.selectedCodeId = code.id; renderCodeTree(); };
      row.ondblclick = () => promptModal(t("rename"), t("code_name_q"), code.name, name => { code.name = name; scheduleSave(); renderAll(); });
      row.querySelector("[data-act=add]").onclick = e => { e.stopPropagation(); openNewCodeModal(code.id); };
      row.querySelector("[data-act=memo]").onclick = e => { e.stopPropagation(); openMemoEditor("code", code.id, code.name); };
      row.querySelector("[data-act=ren]").onclick = e => {
        e.stopPropagation();
        promptModal(t("rename"), t("code_name_q"), code.name, name => { code.name = name; scheduleSave(); renderAll(); });
      };
      row.querySelector("[data-act=del]").onclick = e => {
        e.stopPropagation();
        confirmModal(t("delete_code_q"), () => { trashCode(code.id); renderAll(); });
      };
      // Glisser-déposer : réorganisation hiérarchique
      row.addEventListener("dragstart", e => { e.stopPropagation(); e.dataTransfer.setData("text/qualicode-code", code.id); });
      row.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/qualicode-code")) e.preventDefault(); });
      row.addEventListener("drop", e => {
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("text/qualicode-code");
        if (!draggedId || draggedId === code.id) return;
        // Empêche de déposer un code dans sa propre descendance
        let p = code;
        while (p) { if (p.id === draggedId) return; p = getCode(p.parentId); }
        const dragged = getCode(draggedId);
        if (dragged) { dragged.parentId = code.id; expandedCodes.add(code.id); scheduleSave(); renderCodeTree(); }
      });
      container.appendChild(row);
      if (kids.length && open) {
        const kc = document.createElement("div");
        kc.className = "tree-children";
        build(code.id, kc);
        container.appendChild(kc);
      }
    }
  };
  build(null, root);

  // Déposer à la racine
  root.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/qualicode-code")) e.preventDefault(); });
  root.addEventListener("drop", e => {
    if (e.target !== root) return;
    const dragged = getCode(e.dataTransfer.getData("text/qualicode-code"));
    if (dragged) { dragged.parentId = null; scheduleSave(); renderCodeTree(); }
  });
}

function openNewCodeModal(parentId, onCreated) {
  const codes = flatCodes();
  const swatches = CODE_COLORS.map((c, i) =>
    `<span class="sw ${i === 0 ? "sel" : ""}" data-color="${c}" style="background:${c}"></span>`).join("");
  const m = openModal({
    title: t("new_code"),
    bodyHtml: `
      <div class="form-row"><label>${esc(t("name"))}</label><input type="text" id="ncName"></div>
      <div class="form-row"><label>${esc(t("parent_code"))}</label>
        <select id="ncParent">
          <option value="">${esc(t("none"))}</option>
          ${codes.map(c => `<option value="${c.id}" ${c.id === parentId ? "selected" : ""}>${"— ".repeat(c.depth)}${esc(c.name)}</option>`).join("")}
        </select></div>
      <div class="form-row"><label>${esc(t("color"))}</label><div class="color-swatches">${swatches}</div></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const name = o.querySelector("#ncName").value.trim();
          if (!name) return;
          const parent = o.querySelector("#ncParent").value || null;
          const color = o.querySelector(".sw.sel")?.dataset.color;
          const code = addCode(name, parent, color);
          if (parent) expandedCodes.add(parent);
          close();
          renderCodeTree(); renderStatus();
          toast(t("code_created") + name);
          if (onCreated) onCreated(code);
        }
      },
    ],
  });
  m.body.querySelectorAll(".sw").forEach(sw => sw.onclick = () => {
    m.body.querySelectorAll(".sw").forEach(x => x.classList.remove("sel"));
    sw.classList.add("sel");
  });
}

/* ================================================================
   Volet 3 : navigateur de document + codage
================================================================ */
function hexToRgba(hex, alpha) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderBrowser() {
  const el = $("#docBrowser");
  const doc = getDoc(state.ui.currentDocId);
  if (!doc) {
    el.innerHTML = `<div class="empty-hint">${esc(t("hint_no_doc"))}</div>`;
    $("#browserTitle").textContent = t("panel_browser");
    return;
  }
  $("#browserTitle").textContent = "📖 " + doc.name;

  const segs = state.ui.showHighlights ? segmentsOfDoc(doc.id) : [];
  const paras = doc.text.split("\n");
  const vars = Object.entries(doc.variables || {}).filter(([, v]) => v !== "").map(([k, v]) => `${k}: ${v}`).join(" · ");

  let html = `<div class="doc-title-block"><h2>${esc(doc.name)}</h2>
    <div class="doc-meta">${paras.length} ¶ · ${doc.text.length.toLocaleString()} car.${vars ? " · " + esc(vars) : ""}</div></div>
    <div class="doc-content">`;

  let offset = 0;
  for (let i = 0; i < paras.length; i++) {
    const text = paras[i];
    const pStart = offset, pEnd = offset + text.length;
    offset = pEnd + 1; // \n
    html += `<div class="para" data-start="${pStart}"><span class="para-num">${i + 1}</span><span class="para-text">${renderParaText(text, pStart, segs)}</span></div>`;
  }
  html += "</div>";
  el.innerHTML = html;

  // Clic sur un segment surligné → fiche du segment
  el.querySelectorAll("mark.seg").forEach(mark => {
    mark.addEventListener("click", e => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // l'utilisateur est en train de sélectionner
      e.stopPropagation();
      const ids = mark.dataset.segids.split(",");
      if (ids.length === 1) openSegmentModal(ids[0]);
      else openSegmentChooser(ids);
    });
  });
}

// Rend un paragraphe avec surlignages ; préserve exactement le texte (offsets stables)
function renderParaText(text, pStart, allSegs) {
  const pEnd = pStart + text.length;
  const segs = allSegs.filter(s => s.start < pEnd && s.end > pStart);

  // Détection de locuteur (transcriptions) : « Nom : » en début de paragraphe
  const spMatch = text.match(/^([^:\n]{1,32}?)\s?:/);
  const speakerEnd = spMatch ? pStart + spMatch[0].length : -1;

  const bounds = new Set([pStart, pEnd]);
  if (speakerEnd > 0) bounds.add(speakerEnd);
  for (const s of segs) {
    bounds.add(Math.max(s.start, pStart));
    bounds.add(Math.min(s.end, pEnd));
  }
  const pts = [...bounds].sort((a, b) => a - b);

  let out = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a >= b) continue;
    const chunk = esc(text.slice(a - pStart, b - pStart));
    const covering = segs.filter(s => s.start <= a && s.end >= b);
    const isSpeaker = speakerEnd > 0 && b <= speakerEnd;
    if (covering.length) {
      const code = getCode(covering[0].codeId);
      const color = code ? hexToRgba(code.color, 0.35) : "var(--mark-multi)";
      const names = covering.map(s => getCode(s.codeId)?.name ?? "?").join(" + ");
      out += `<mark class="seg ${covering.length > 1 ? "multi" : ""} ${isSpeaker ? "speaker" : ""}" style="background:${color}" title="${esc(names)}" data-segids="${covering.map(s => s.id).join(",")}">${chunk}</mark>`;
    } else if (isSpeaker) {
      out += `<span class="speaker">${chunk}</span>`;
    } else {
      out += chunk;
    }
  }
  return out || "&nbsp;";
}

/* ---------- Sélection de texte → offsets absolus ---------- */
function absOffset(node, offsetInNode) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const paraText = el?.closest?.(".para-text");
  if (!paraText) return null;
  const pStart = Number(paraText.closest(".para").dataset.start);
  if (node.nodeType !== Node.TEXT_NODE) {
    // Ancré sur un élément : approximation par la somme des nœuds précédents
    let acc = 0;
    const kids = [...node.childNodes].slice(0, offsetInNode);
    for (const k of kids) acc += k.textContent.length;
    return pStart + acc;
  }
  let acc = 0;
  const walker = document.createTreeWalker(paraText, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n === node) return pStart + acc + offsetInNode;
    acc += n.textContent.length;
  }
  return null;
}

function getSelectionOffsets() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!$("#docBrowser").contains(r.commonAncestorContainer)) return null;
  const a = absOffset(r.startContainer, r.startOffset);
  const b = absOffset(r.endContainer, r.endOffset);
  if (a == null || b == null || a === b) return null;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

// Capture la sélection courante (avant qu'un clic de bouton ne la fasse disparaître)
function captureSelection() {
  return getSelectionOffsets() || pendingSelection;
}

function showCodingPopup(x, y, sel) {
  pendingSelection = sel;
  const popup = $("#codingPopup");
  const list = $("#codingPopupList");
  const codes = flatCodes();
  list.innerHTML = codes.length
    ? codes.map(c => `<div class="popup-code" data-id="${c.id}" style="padding-left:${8 + c.depth * 14}px">
        <span class="code-dot" style="background:${esc(c.color)}"></span><span>${esc(c.name)}</span></div>`).join("")
    : `<div style="padding:8px;color:var(--text-soft)">${esc(t("select_code_first"))}</div>`;
  list.querySelectorAll(".popup-code").forEach(el => {
    el.onclick = () => { applyCodeToSelection(el.dataset.id, pendingSelection); hideCodingPopup(); };
  });
  popup.hidden = false;
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  popup.style.left = Math.min(x + 6, window.innerWidth - pw - 10) + "px";
  popup.style.top = Math.min(y + 10, window.innerHeight - ph - 10) + "px";
}

function hideCodingPopup() {
  $("#codingPopup").hidden = true;
}

function applyCodeToSelection(codeId, sel) {
  const doc = getDoc(state.ui.currentDocId);
  if (!doc || !sel) return;
  const start = Math.max(0, sel.start), end = Math.min(doc.text.length, sel.end);
  if (end <= start) return;
  addSegment(doc.id, codeId, start, end, doc.text.slice(start, end));
  pendingSelection = null;
  window.getSelection()?.removeAllRanges();
  renderBrowser(); renderCodeTree(); renderDocTree(); renderPanel4(); renderStatus();
  toast(t("coded_with") + " « " + (getCode(codeId)?.name ?? "?") + " »");
}

function inVivoCode(sel) {
  const doc = getDoc(state.ui.currentDocId);
  if (!doc || !sel) return;
  const raw = doc.text.slice(sel.start, sel.end).trim().replace(/\s+/g, " ");
  const name = raw.length > 40 ? raw.slice(0, 37) + "…" : raw;
  if (!name) return;
  const code = addCode(name);
  applyCodeToSelection(code.id, sel);
}

/* ---------- Fiche segment (poids, commentaire, suppression) ---------- */
function openSegmentModal(segId) {
  const s = getSegment(segId);
  if (!s) return;
  const code = getCode(s.codeId), doc = getDoc(s.docId);
  openModal({
    title: t("edit_segment"),
    bodyHtml: `
      <p><span class="badge" style="background:${esc(hexToRgba(code?.color ?? "#888", 0.3))}">${esc(code?.name ?? "?")}</span>
        · <strong>${esc(doc?.name ?? "?")}</strong></p>
      <blockquote style="border-left:3px solid ${esc(code?.color ?? "#888")};margin:8px 0;padding:4px 12px;white-space:pre-wrap">${esc(s.text)}</blockquote>
      <div class="form-row"><label>${esc(t("weight"))} (1–100)</label><input type="number" id="segWeight" min="1" max="100" value="${s.weight}" style="width:110px;padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)"></div>
      <div class="form-row"><label>${esc(t("comment"))}</label><textarea id="segComment" style="min-height:70px">${esc(s.comment)}</textarea></div>`,
    footer: [
      { label: t("uncode"), danger: true, onClick: (o, close) => { deleteSegment(s.id); close(); renderBrowser(); renderCodeTree(); renderDocTree(); renderPanel4(); renderStatus(); toast(t("segment_deleted")); } },
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          s.weight = Math.max(1, Math.min(100, Number(o.querySelector("#segWeight").value) || 1));
          s.comment = o.querySelector("#segComment").value;
          scheduleSave(); close(); renderPanel4();
        }
      },
    ],
  });
}

function openSegmentChooser(segIds) {
  const items = segIds.map(id => {
    const s = getSegment(id);
    const c = s && getCode(s.codeId);
    return s ? `<div class="popup-code" data-id="${s.id}" style="padding:6px 8px"><span class="code-dot" style="background:${esc(c?.color ?? "#888")}"></span> ${esc(c?.name ?? "?")}</div>` : "";
  }).join("");
  const m = openModal({ title: t("edit_segment"), bodyHtml: `<div>${items}</div>` });
  m.body.querySelectorAll(".popup-code").forEach(el => {
    el.onclick = () => { m.close(); openSegmentModal(el.dataset.id); };
  });
}

/* ================================================================
   Volet 4 : segments récupérés / résultats de recherche
================================================================ */
function retrieveSegments() {
  const dOn = state.ui.activatedDocs, cOn = state.ui.activatedCodes;
  let segs = state.project.segments.filter(s => dOn.has(s.docId) && cOn.has(s.codeId));
  if (state.ui.retrievalMode === "and") {
    // Intersection : ne garde que les segments chevauchant un segment d'un AUTRE code activé
    segs = segs.filter(s =>
      state.project.segments.some(o =>
        o.id !== s.id && o.docId === s.docId && cOn.has(o.codeId) && o.codeId !== s.codeId &&
        o.start < s.end && s.start < o.end));
  }
  return segs.sort((a, b) => (a.docId === b.docId ? a.start - b.start : 0));
}

function renderPanel4() {
  const el = $("#retrievedPanel");
  if (panel4Mode === "search") { renderSearchResults(el); return; }
  const segs = retrieveSegments();
  if (!segs.length) {
    el.innerHTML = `<div class="empty-hint">${esc(t("no_segments"))}</div>`;
    return;
  }
  let html = `<div class="panel-toolbar">
    <span>${segs.length} ${esc(t("segments_lbl"))}</span>
    <button class="mini-btn" id="btnExportRetrieved" title="CSV" style="width:auto;padding:0 8px">⬇ CSV</button>
    <button class="mini-btn" id="btnPrintRetrieved" title="${esc(t("export_report"))}" style="width:auto;padding:0 8px">🖨️</button>
  </div>`;
  for (const s of segs) {
    const code = getCode(s.codeId), doc = getDoc(s.docId);
    html += `<div class="seg-card" data-id="${s.id}">
      <div class="seg-card-head">
        <span class="badge" style="background:${esc(hexToRgba(code?.color ?? "#888", 0.3))}">${esc(code?.name ?? "?")}</span>
        <span class="src" data-doc="${s.docId}" data-start="${s.start}">${esc(doc?.name ?? "?")}</span>
        ${s.weight !== 1 ? `<span class="weight-badge">${esc(t("weight"))}: ${s.weight}</span>` : ""}
        ${s.coder ? `<span class="weight-badge">👤 ${esc(s.coder)}</span>` : ""}
        <span class="spacer"></span>
        <button class="mini-btn" data-act="edit" title="${esc(t("edit_segment"))}">✏️</button>
      </div>
      <div class="seg-card-body">${esc(s.text)}</div>
      ${s.comment ? `<div class="seg-comment">💬 ${esc(s.comment)}</div>` : ""}
    </div>`;
  }
  el.innerHTML = html;
  el.querySelector("#btnExportRetrieved").onclick = () => { exportSegmentsCsv(segs); toast(t("export_done")); };
  el.querySelector("#btnPrintRetrieved").onclick = () => openPrintableReport(segs);
  el.querySelectorAll("[data-act=edit]").forEach(b => b.onclick = () => openSegmentModal(b.closest(".seg-card").dataset.id));
  el.querySelectorAll(".src").forEach(sp => sp.onclick = () => gotoDocPosition(sp.dataset.doc, Number(sp.dataset.start)));
}

function gotoDocPosition(docId, charPos) {
  state.ui.currentDocId = docId;
  renderDocTree(); renderBrowser();
  // Fait défiler jusqu'au paragraphe contenant la position
  const paras = [...$("#docBrowser").querySelectorAll(".para")];
  const target = paras.findLast
    ? paras.findLast(p => Number(p.dataset.start) <= charPos)
    : paras.filter(p => Number(p.dataset.start) <= charPos).pop();
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.style.transition = "background 0.4s";
    target.style.background = "var(--accent-soft)";
    setTimeout(() => { target.style.background = ""; }, 1600);
  }
}

/* ---------- Recherche plein texte ---------- */
function runSearch() {
  const q = $("#searchInput").value.trim();
  if (!q) return;
  searchQuery = q;
  searchResults = searchDocuments(q);
  panel4Mode = "search";
  renderPanel4();
}

function renderSearchResults(el) {
  let html = `<div class="panel-toolbar">
    <strong>${esc(t("search_results"))} « ${esc(searchQuery)} » — ${searchResults.length}</strong>
    <button class="mini-btn" id="btnCloseSearch" style="width:auto;padding:0 8px">✕ ${esc(t("close"))}</button>
  </div>`;
  if (!searchResults.length) html += `<div class="empty-hint">${esc(t("search_none"))}</div>`;
  for (const r of searchResults.slice(0, 500)) {
    const doc = getDoc(r.docId);
    let frag = esc(r.text.length > 260 ? r.text.slice(0, 260) + "…" : r.text);
    for (const term of r.terms) {
      frag = frag.replace(new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<b>$1</b>");
    }
    html += `<div class="search-hit" data-doc="${r.docId}" data-start="${r.paraStart}">
      <div class="hit-src">${esc(doc?.name ?? "?")} · ¶ ${r.paraIndex + 1}</div>
      <div class="hit-text">${frag}</div></div>`;
  }
  el.innerHTML = html;
  el.querySelector("#btnCloseSearch").onclick = () => { panel4Mode = "segments"; renderPanel4(); };
  el.querySelectorAll(".search-hit").forEach(h => h.onclick = () => gotoDocPosition(h.dataset.doc, Number(h.dataset.start)));
}

/* ================================================================
   Importation
================================================================ */
function openPasteDoc() {
  const groups = state.project.documentGroups;
  openModal({
    title: t("paste_doc"),
    wide: true,
    bodyHtml: `
      <div class="form-row"><label>${esc(t("doc_title"))}</label><input type="text" id="pdName"></div>
      <div class="form-row"><label>${esc(t("group"))}</label>
        <select id="pdGroup"><option value="">${esc(t("none"))}</option>
        ${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></div>
      <div class="form-row"><label>${esc(t("doc_text"))}</label><textarea id="pdText" style="min-height:240px"></textarea></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("add_doc"), primary: true, onClick: (o, close) => {
          const name = o.querySelector("#pdName").value.trim() || "Document";
          const text = o.querySelector("#pdText").value.replace(/\r\n/g, "\n");
          if (!text.trim()) return;
          const doc = addDocument(name, text, o.querySelector("#pdGroup").value || null);
          state.ui.currentDocId = doc.id;
          close(); renderAll();
        }
      },
    ],
  });
}

// Analyseur CSV minimal avec guillemets (séparateur , ou ;)
function parseCsv(text) {
  const sep = (text.split("\n")[0].match(/;/g) || []).length >= (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

function importCsv(text, baseName) {
  const rows = parseCsv(text);
  if (rows.length < 2) return toast(t("invalid_project"));
  const header = rows[0].map(h => h.trim());
  const group = addGroup(baseName);
  expandedGroups.add(group.id);
  let count = 0;
  for (const row of rows.slice(1)) {
    const title = (row[0] || "").trim() || `${baseName} ${count + 1}`;
    const vars = {};
    const paras = [];
    for (let c = 1; c < header.length; c++) {
      const val = (row[c] || "").trim();
      if (!val) continue;
      // Réponses courtes = variables (questions fermées), longues = texte (questions ouvertes)
      if (val.length <= 50) {
        vars[header[c]] = val;
        if (!state.project.variables.includes(header[c])) state.project.variables.push(header[c]);
      } else {
        paras.push(header[c] + " :\n" + val);
      }
    }
    const doc = addDocument(title, paras.join("\n\n") || title, group.id);
    doc.variables = vars;
    count++;
  }
  scheduleSave();
  renderAll();
  toast(count + " " + t("import_done"));
}

function openStructuredImport() {
  openModal({
    title: t("structured_title"),
    wide: true,
    bodyHtml: `
      <p style="color:var(--text-soft);font-size:13px">${esc(t("structured_hint"))}</p>
      <div class="form-row"><textarea id="stText" style="min-height:260px" placeholder="#DOC Entretien 1\nTexte du premier document…\n#DOC Entretien 2\nTexte du second document…"></textarea></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const text = o.querySelector("#stText").value.replace(/\r\n/g, "\n");
          const parts = text.split(/^#DOC[ \t]+/m).filter(p => p.trim());
          let count = 0;
          for (const part of parts) {
            const nl = part.indexOf("\n");
            const name = (nl === -1 ? part : part.slice(0, nl)).trim();
            const body = (nl === -1 ? "" : part.slice(nl + 1)).trim();
            if (name && body) { addDocument(name, body); count++; }
          }
          close(); renderAll();
          toast(count + " " + t("import_done"));
        }
      },
    ],
  });
}

/* ================================================================
   Codage automatique (recherche lexicale, §2.4)
================================================================ */
function openAutoCode() {
  const codes = flatCodes();
  openModal({
    title: t("autocode_title"),
    bodyHtml: `
      <div class="form-row"><label>${esc(t("autocode_term"))}</label><input type="text" id="acTerm"></div>
      <div class="form-row"><label>${esc(t("autocode_code"))}</label>
        <select id="acCode">${codes.map(c => `<option value="${c.id}">${"— ".repeat(c.depth)}${esc(c.name)}</option>`).join("")}</select></div>
      <div class="form-row"><label>${esc(t("autocode_scope"))}</label>
        <select id="acScope">
          <option value="sentence">${esc(t("scope_sentence"))}</option>
          <option value="match">${esc(t("scope_match"))}</option>
          <option value="para">${esc(t("scope_para"))}</option>
        </select></div>
      <div class="form-row"><label>${esc(t("document"))}s</label>
        <select id="acDocs">
          <option value="all">${esc(t("all_docs"))}</option>
          <option value="activated">${esc(t("sel_docs_hint"))}</option>
        </select></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const term = o.querySelector("#acTerm").value.trim();
          const codeId = o.querySelector("#acCode").value;
          const scope = o.querySelector("#acScope").value;
          const which = o.querySelector("#acDocs").value;
          if (!term || !codeId) return;
          const docs = which === "activated"
            ? state.project.documents.filter(d => state.ui.activatedDocs.has(d.id))
            : state.project.documents;
          let n = 0;
          for (const doc of docs) {
            const lower = doc.text.toLowerCase();
            const kw = term.toLowerCase();
            let idx = lower.indexOf(kw);
            while (idx !== -1) {
              let s = idx, e = idx + term.length;
              if (scope === "para") {
                s = doc.text.lastIndexOf("\n", idx) + 1;
                const ne = doc.text.indexOf("\n", idx);
                e = ne === -1 ? doc.text.length : ne;
              } else if (scope === "sentence") {
                const boundary = /[.!?…]/;
                s = idx; while (s > 0 && !boundary.test(doc.text[s - 1]) && doc.text[s - 1] !== "\n") s--;
                e = idx + term.length; while (e < doc.text.length && !boundary.test(doc.text[e]) && doc.text[e] !== "\n") e++;
                if (e < doc.text.length && boundary.test(doc.text[e])) e++;
                while (s < idx && doc.text[s] === " ") s++;
              }
              addSegment(doc.id, codeId, s, e, doc.text.slice(s, e));
              n++;
              idx = lower.indexOf(kw, idx + kw.length);
            }
          }
          close(); renderAll();
          toast(n + " " + t("autocode_done"));
        }
      },
    ],
  });
}

/* ================================================================
   Mémos (§2.5)
================================================================ */
function openMemoEditor(targetType, targetId, targetName) {
  const memo = getMemo(targetType, targetId);
  openModal({
    title: t("memo_for") + (targetType === "project" ? t("project") : targetName),
    bodyHtml: `<div class="form-row"><label>${esc(t("memo_text"))}</label>
      <textarea id="memoText" style="min-height:180px">${esc(targetType === "project" ? state.project.memo : (memo?.text ?? ""))}</textarea></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const text = o.querySelector("#memoText").value;
          if (targetType === "project") { state.project.memo = text; scheduleSave(); }
          else if (text.trim()) upsertMemo(targetType, targetId, text, targetName);
          else state.project.memos = state.project.memos.filter(m => !(m.targetType === targetType && m.targetId === targetId));
          scheduleSave(); close(); renderDocTree(); renderCodeTree();
        }
      },
    ],
  });
}

function openMemoManager() {
  const targetName = m => {
    if (m.targetType === "document") return "📄 " + (getDoc(m.targetId)?.name ?? "?");
    if (m.targetType === "code") return "🏷️ " + (getCode(m.targetId)?.name ?? "?");
    if (m.targetType === "segment") return "✂️ " + t("segment");
    return "🗂️ " + t("project");
  };
  const memos = state.project.memos;
  let html = state.project.memo
    ? `<div class="search-hit" data-type="project"><div class="hit-src">🗂️ ${esc(t("project"))}</div><div class="hit-text">${esc(state.project.memo.slice(0, 220))}</div></div>` : "";
  html += memos.map(m => `<div class="search-hit" data-type="${m.targetType}" data-id="${m.targetId}">
      <div class="hit-src">${esc(targetName(m))} · ${new Date(m.created).toLocaleDateString()}</div>
      <div class="hit-text">${esc(m.text.slice(0, 220))}</div></div>`).join("");
  if (!html) html = `<div class="empty-hint">${esc(t("no_memos"))}</div>`;
  const m = openModal({ title: t("memos_title"), wide: true, bodyHtml: html });
  m.body.querySelectorAll(".search-hit").forEach(el => {
    el.onclick = () => {
      m.close();
      const type = el.dataset.type;
      if (type === "project") openMemoEditor("project", null, "");
      else if (type === "document") openMemoEditor("document", el.dataset.id, getDoc(el.dataset.id)?.name ?? "");
      else if (type === "code") openMemoEditor("code", el.dataset.id, getCode(el.dataset.id)?.name ?? "");
    };
  });
}

/* ================================================================
   Variables de document (§2.3) et éditeur de données
================================================================ */
function openVariablesList() {
  const render = body => {
    body.innerHTML = `
      ${state.project.variables.map((v, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span style="flex:1">🧮 ${esc(v)}</span>
          <button class="mini-btn" data-del="${i}">🗑️</button>
        </div>`).join("") || `<p style="color:var(--text-soft)">${esc(t("none"))}</p>`}
      <div class="form-row" style="display:flex;gap:8px;margin-top:14px">
        <input type="text" id="newVarName" placeholder="${esc(t("var_name"))}" style="flex:1">
        <button class="btn primary" id="addVarBtn">${esc(t("add_variable"))}</button>
      </div>`;
    body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      const name = state.project.variables[Number(b.dataset.del)];
      state.project.variables.splice(Number(b.dataset.del), 1);
      state.project.documents.forEach(d => { if (d.variables) delete d.variables[name]; });
      scheduleSave(); render(body);
    });
    body.querySelector("#addVarBtn").onclick = () => {
      const name = body.querySelector("#newVarName").value.trim();
      if (name && !state.project.variables.includes(name)) {
        state.project.variables.push(name);
        scheduleSave(); render(body);
      }
    };
  };
  const m = openModal({ title: t("variables_title"), bodyHtml: "" });
  render(m.body);
}

function openDataEditor() {
  const vars = state.project.variables;
  const html = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th>${esc(t("document"))}</th>${vars.map(v => `<th>${esc(v)}</th>`).join("")}</tr></thead>
    <tbody>${state.project.documents.map(d => `
      <tr><td>${esc(d.name)}</td>${vars.map(v => `
        <td><input type="text" data-doc="${d.id}" data-var="${esc(v)}" value="${esc(d.variables?.[v] ?? "")}"
          style="border:none;background:transparent;color:inherit;width:110px;font-size:12.5px"></td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
  const m = openModal({
    title: t("data_editor_title"), wide: true, bodyHtml: html,
    footer: [{ label: t("close"), primary: true, onClick: (o, close) => close() }],
  });
  m.body.querySelectorAll("input[data-doc]").forEach(inp => {
    inp.addEventListener("change", () => {
      const doc = getDoc(inp.dataset.doc);
      if (!doc) return;
      doc.variables = doc.variables || {};
      doc.variables[inp.dataset.var] = inp.value.trim();
      scheduleSave();
    });
  });
}

function openDocProps(doc) {
  const groups = state.project.documentGroups;
  const vars = state.project.variables;
  // Locuteurs détectés (utile pour les transcriptions)
  const speakers = [...new Set(doc.text.split("\n").map(l => (l.match(/^([^:\n]{1,32}?)\s?:/) || [])[1]).filter(Boolean))];
  openModal({
    title: t("doc_props_title"),
    bodyHtml: `
      <div class="form-row"><label>${esc(t("name"))}</label><input type="text" id="dpName" value="${esc(doc.name)}"></div>
      <div class="form-row"><label>${esc(t("group"))}</label>
        <select id="dpGroup"><option value="">${esc(t("none"))}</option>
        ${groups.map(g => `<option value="${g.id}" ${doc.groupId === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>
      ${vars.map(v => `<div class="form-row"><label>${esc(v)}</label><input type="text" data-var="${esc(v)}" value="${esc(doc.variables?.[v] ?? "")}"></div>`).join("")}
      ${speakers.length ? `<div class="form-row"><label>${esc(t("speakers_detected"))}</label><p style="margin:2px 0">${speakers.map(s => `<span class="badge" style="background:var(--accent-soft)">${esc(s)}</span>`).join(" ")}</p></div>` : ""}`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          doc.name = o.querySelector("#dpName").value.trim() || doc.name;
          doc.groupId = o.querySelector("#dpGroup").value || null;
          doc.variables = doc.variables || {};
          o.querySelectorAll("input[data-var]").forEach(inp => { doc.variables[inp.dataset.var] = inp.value.trim(); });
          scheduleSave(); close(); renderAll();
        }
      },
    ],
  });
}

/* ================================================================
   Analyses (§2.6)
================================================================ */
function heatColor(v, max) {
  if (!v) return "";
  const alpha = 0.15 + 0.55 * Math.min(1, v / (max || 1));
  return `background:rgba(38,96,164,${alpha.toFixed(2)});color:${alpha > 0.45 ? "#fff" : "inherit"}`;
}

function openCodeMatrix() {
  const codes = flatCodes();
  const docs = state.project.documents;
  const { matrix } = codeMatrix(docs, codes);
  const max = Math.max(1, ...matrix.flat());
  const html = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th>${esc(t("code"))}</th>${docs.map(d => `<th title="${esc(d.name)}">${esc(d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name)}</th>`).join("")}<th>${esc(t("total"))}</th></tr></thead>
    <tbody>${codes.map((c, i) => `
      <tr><td style="padding-left:${10 + c.depth * 16}px"><span class="code-dot" style="background:${esc(c.color)};display:inline-block;vertical-align:-2px"></span> ${esc(c.name)}</td>
      ${matrix[i].map((v, j) => `<td class="heat" data-code="${c.id}" data-doc="${docs[j].id}" style="${heatColor(v, max)}">${v || ""}</td>`).join("")}
      <td class="num"><strong>${matrix[i].reduce((a, b) => a + b, 0)}</strong></td></tr>`).join("")}
    </tbody></table></div>`;
  const m = openModal({
    title: t("matrix_title"), wide: true, bodyHtml: html,
    footer: [
      { label: "CSV", onClick: () => { exportMatrixCsv(); toast(t("export_done")); } },
      { label: t("close"), primary: true, onClick: (o, close) => close() },
    ],
  });
  // Clic sur une cellule → active le couple document/code et affiche les segments
  m.body.querySelectorAll("td.heat").forEach(td => {
    td.onclick = () => {
      if (!td.textContent) return;
      state.ui.activatedDocs = new Set([td.dataset.doc]);
      state.ui.activatedCodes = new Set([td.dataset.code]);
      panel4Mode = "segments";
      m.close();
      renderDocTree(); renderCodeTree(); renderPanel4();
    };
  });
}

function openCooc() {
  const codes = flatCodes();
  const { matrix } = coocMatrix(codes);
  const max = Math.max(1, ...matrix.flat());
  const html = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th></th>${codes.map(c => `<th title="${esc(c.name)}">${esc(c.name.length > 14 ? c.name.slice(0, 12) + "…" : c.name)}</th>`).join("")}</tr></thead>
    <tbody>${codes.map((c, i) => `
      <tr><td><span class="code-dot" style="background:${esc(c.color)};display:inline-block;vertical-align:-2px"></span> ${esc(c.name)}</td>
      ${matrix[i].map((v, j) => i === j ? `<td style="background:var(--bg-ribbon)"></td>` : `<td class="heat" style="${heatColor(v, max)}">${v || ""}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
  openModal({ title: t("cooc_title"), wide: true, bodyHtml: html, footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }] });
}

function openGroupCompare() {
  const vars = state.project.variables;
  if (!vars.length) return openVariablesList();
  const renderTable = (body, variable) => {
    const codes = flatCodes();
    const { values, matrix } = groupComparison(variable, codes);
    const max = Math.max(1, ...matrix.flat());
    body.querySelector("#gcTable").innerHTML = `<div class="table-scroll"><table class="data-table">
      <thead><tr><th>${esc(t("code"))}</th>${values.map(v => `<th>${esc(v)}</th>`).join("")}</tr></thead>
      <tbody>${codes.map((c, i) => `
        <tr><td style="padding-left:${10 + c.depth * 16}px">${esc(c.name)}</td>
        ${matrix[i].map(v => `<td class="heat" style="${heatColor(v, max)}">${v || ""}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>`;
  };
  const m = openModal({
    title: t("groupcomp_title"), wide: true,
    bodyHtml: `<div class="form-row"><label>${esc(t("variable"))}</label>
      <select id="gcVar">${vars.map(v => `<option>${esc(v)}</option>`).join("")}</select></div><div id="gcTable"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  const sel = m.body.querySelector("#gcVar");
  sel.onchange = () => renderTable(m.body, sel.value);
  renderTable(m.body, sel.value);
}

function analysisDocs() {
  const activated = state.project.documents.filter(d => state.ui.activatedDocs.has(d.id));
  return activated.length ? activated : state.project.documents;
}

function openWordFreq() {
  const renderTable = body => {
    const minLength = Number(body.querySelector("#wfMin").value) || 3;
    const useStopwords = body.querySelector("#wfStop").checked;
    const freqs = wordFrequencies(analysisDocs(), { minLength, useStopwords }).slice(0, 300);
    const total = freqs.reduce((a, [, n]) => a + n, 0);
    body.querySelector("#wfTable").innerHTML = `<div class="table-scroll"><table class="data-table">
      <thead><tr><th>#</th><th>${esc(t("word"))}</th><th>${esc(t("freq"))}</th><th>${esc(t("percent"))}</th></tr></thead>
      <tbody>${freqs.map(([w, n], i) => `<tr><td class="num">${i + 1}</td><td>${esc(w)}</td><td class="num">${n}</td><td class="num">${(100 * n / total).toFixed(1)}</td></tr>`).join("")}</tbody>
      </table></div>`;
  };
  const m = openModal({
    title: t("wordfreq_title") + " — " + (state.ui.activatedDocs.size ? t("sel_docs_hint") : t("all_docs")),
    wide: true,
    bodyHtml: `<div class="panel-toolbar" style="gap:16px">
        <label>${esc(t("min_length"))} <input type="number" id="wfMin" value="3" min="1" max="12" style="width:56px"></label>
        <label><input type="checkbox" id="wfStop" checked> ${esc(t("stopwords"))}</label>
      </div><div id="wfTable"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  m.body.querySelector("#wfMin").onchange = () => renderTable(m.body);
  m.body.querySelector("#wfStop").onchange = () => renderTable(m.body);
  renderTable(m.body);
}

function openKwic() {
  const m = openModal({
    title: t("kwic_title"), wide: true,
    bodyHtml: `<div class="form-row" style="display:flex;gap:8px">
        <input type="text" id="kwTerm" placeholder="${esc(t("kwic_term"))}" style="flex:1">
        <button class="btn primary" id="kwGo">${esc(t("search"))}</button>
      </div><div id="kwTable"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  const run = () => {
    const term = m.body.querySelector("#kwTerm").value.trim();
    if (!term) return;
    const hits = kwic(analysisDocs(), term).slice(0, 400);
    m.body.querySelector("#kwTable").innerHTML = `<div class="table-scroll"><table class="data-table kwic-table">
      <thead><tr><th>${esc(t("document"))}</th><th>${esc(t("context"))} ◀</th><th></th><th>▶ ${esc(t("context"))}</th></tr></thead>
      <tbody>${hits.map(h => `<tr><td>${esc(h.docName)}</td><td class="left">…${esc(h.left)}</td><td class="kw">${esc(h.match)}</td><td class="right">${esc(h.right)}…</td></tr>`).join("")}</tbody>
      </table></div><p style="color:var(--text-soft);font-size:12px">${hits.length} occurrence(s)</p>`;
  };
  m.body.querySelector("#kwGo").onclick = run;
  m.body.querySelector("#kwTerm").addEventListener("keydown", e => { if (e.key === "Enter") run(); });
}

function openStats() {
  const stats = variableStats();
  const docs = state.project.documents;
  let html = `<p><strong>${docs.length}</strong> ${esc(t("docs"))} · <strong>${state.project.codes.length}</strong> ${esc(t("codes_lbl"))} · <strong>${state.project.segments.length}</strong> ${esc(t("segments_lbl"))}</p>`;
  for (const s of stats) {
    html += `<h4 style="margin:14px 0 6px">🧮 ${esc(s.variable)} (n=${s.n})</h4>
      <div class="table-scroll"><table class="data-table">
      <thead><tr><th>${esc(t("value"))}</th><th>${esc(t("count"))}</th><th>${esc(t("percent"))}</th></tr></thead>
      <tbody>${s.values.map(([v, n]) => `<tr><td>${esc(v)}</td><td class="num">${n}</td><td class="num">${(100 * n / s.n).toFixed(1)}</td></tr>`).join("")}</tbody>
      </table></div>`;
  }
  openModal({ title: t("stats_title"), wide: true, bodyHtml: html, footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }] });
}

/* ================================================================
   Visualisations (§2.7)
================================================================ */
function openPortrait() {
  const docs = state.project.documents;
  if (!docs.length) return;
  const render = (body, docId) => {
    const segs = segmentsOfDoc(docId).sort((a, b) => a.start - b.start);
    const usedCodes = [...new Set(segs.map(s => s.codeId))].map(getCode).filter(Boolean);
    body.querySelector("#ptView").innerHTML = `
      <p style="color:var(--text-soft);font-size:12.5px">${esc(t("portrait_hint"))}</p>
      <div class="portrait">${segs.map(s => {
        const c = getCode(s.codeId);
        const size = Math.max(14, Math.min(46, Math.round(Math.sqrt(s.end - s.start) * 2)));
        return `<span class="cell" style="background:${esc(c?.color ?? "#888")};width:${size}px;height:18px" title="${esc((c?.name ?? "?") + " — " + s.text.slice(0, 90))}"></span>`;
      }).join("")}</div>
      <div class="legend">${usedCodes.map(c => `<span class="item"><span class="code-dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</span>`).join("")}</div>`;
  };
  const m = openModal({
    title: t("portrait_title"), wide: true,
    bodyHtml: `<div class="form-row"><select id="ptDoc">${docs.map(d => `<option value="${d.id}" ${d.id === state.ui.currentDocId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div><div id="ptView"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  const sel = m.body.querySelector("#ptDoc");
  sel.onchange = () => render(m.body, sel.value);
  render(m.body, sel.value);
}

function openWordCloud() {
  const freqs = wordFrequencies(analysisDocs(), { minLength: 3, useStopwords: true }).slice(0, 60);
  const max = freqs[0]?.[1] || 1;
  const html = `<div class="word-cloud">${freqs.map(([w, n], i) => {
    const size = 13 + Math.round(34 * Math.sqrt(n / max));
    const color = CODE_COLORS[i % CODE_COLORS.length];
    return `<span style="font-size:${size}px;color:${color}" title="${n}">${esc(w)}</span>`;
  }).join("")}</div>`;
  openModal({
    title: t("wordcloud_title") + " — " + (state.ui.activatedDocs.size ? t("sel_docs_hint") : t("all_docs")),
    wide: true, bodyHtml: html,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
}

function openBarChart() {
  const codes = flatCodes().map(c => ({ ...c, n: state.project.segments.filter(s => s.codeId === c.id).length }))
    .filter(c => c.n > 0).sort((a, b) => b.n - a.n);
  const max = codes[0]?.n || 1;
  const html = `<div class="bar-chart">${codes.map(c => `
    <div class="bar-row">
      <span class="bar-label" title="${esc(c.name)}">${esc(c.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(100 * c.n / max).toFixed(1)}%;background:${esc(c.color)}">${c.n}</span></span>
    </div>`).join("")}</div>`;
  openModal({ title: t("barchart_title"), wide: true, bodyHtml: html, footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }] });
}

/* ================================================================
   Protection par mot de passe (§2.1, §3.4)
================================================================ */
// Demande un mot de passe ; résout avec la saisie ou null si annulé
function askPassword(title = t("enter_password")) {
  return new Promise(resolve => {
    const m = openModal({
      title: t("protect_title"),
      bodyHtml: `<div class="form-row"><label>${esc(title)}</label><input type="password" id="pwInput" autocomplete="off"></div>`,
      footer: [
        { label: t("cancel"), onClick: (o, close) => { close(); resolve(null); } },
        { label: t("ok"), primary: true, onClick: (o, close) => { const v = o.querySelector("#pwInput").value; if (v) { close(); resolve(v); } } },
      ],
    });
    m.body.querySelector("#pwInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.value) { m.close(); resolve(e.target.value); }
    });
    m.overlay.addEventListener("mousedown", e => { if (e.target === m.overlay) resolve(null); });
  });
}

// Lit un fichier .projx (en clair ou chiffré) ; retourne le projet normalisé ou null
async function readProjectFile(file) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    toast(t("invalid_project"));
    return null;
  }
  if (isEncryptedEnvelope(raw)) {
    // Boucle de saisie tant que le mot de passe est incorrect (annulation possible)
    for (;;) {
      const pw = await askPassword();
      if (!pw) return null;
      try {
        const json = await decryptProjectEnvelope(raw, pw);
        const p = JSON.parse(json);
        if (p.format !== "qualicode-projx") throw new Error("format");
        projectPassword = pw;
        return normalizeProject(p);
      } catch {
        toast(t("wrong_password"));
      }
    }
  }
  if (raw.format !== "qualicode-projx") {
    toast(t("invalid_project"));
    return null;
  }
  return normalizeProject(raw);
}

function openProtectModal() {
  const isProtected = !!state.project.protected;
  openModal({
    title: t("protect_title"),
    bodyHtml: `
      <p style="color:var(--text-soft);font-size:13px">${esc(t("protection_hint"))}</p>
      ${isProtected ? `<p><strong>🔒 ${esc(t("protection_active"))}</strong></p>` : ""}
      <div class="form-row"><label>${esc(t("password"))}</label><input type="password" id="ppPw" autocomplete="new-password"></div>
      <div class="form-row"><label>${esc(t("password_confirm"))}</label><input type="password" id="ppPw2" autocomplete="new-password"></div>`,
    footer: [
      ...(isProtected ? [{
        label: t("remove_protection"), danger: true, onClick: (o, close) => {
          state.project.protected = false;
          projectPassword = null;
          scheduleSave(); close(); toast(t("protection_off"));
        }
      }] : []),
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const pw = o.querySelector("#ppPw").value;
          const pw2 = o.querySelector("#ppPw2").value;
          if (!pw) return;
          if (pw !== pw2) return toast(t("password_mismatch"));
          state.project.protected = true;
          projectPassword = pw;
          scheduleSave(); close(); toast(t("protection_on"));
        }
      },
    ],
  });
}

/* ================================================================
   Fusion de projets et accord inter-codeurs (§2.1, §2.9)
================================================================ */
function openMergeModal(incoming) {
  openModal({
    title: t("merge_title"),
    bodyHtml: `
      <p>🧬 <strong>${esc(incoming.name)}</strong> — ${incoming.documents?.length ?? 0} ${esc(t("docs"))},
        ${incoming.codes?.length ?? 0} ${esc(t("codes_lbl"))}, ${incoming.segments?.length ?? 0} ${esc(t("segments_lbl"))}</p>
      <div class="form-row"><label>${esc(t("coder_label_q"))}</label><input type="text" id="mgCoder" value="C2"></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const label = o.querySelector("#mgCoder").value.trim() || "C2";
          const stats = mergeProjects(state.project, incoming, label);
          persistNow();
          close(); renderAll();
          const names = t("merge_stats").split("|");
          const values = [stats.docsMatched, stats.docsAdded, stats.codesMatched, stats.codesAdded, stats.segmentsAdded, stats.segmentsSkipped];
          toast(t("merge_done") + " — " + values.map((v, i) => `${v} ${names[i]}`).join(", "));
        }
      },
    ],
  });
}

function openKappa() {
  const labels = coderLabels(state.project);
  if (labels.length < 2) {
    return openModal({
      title: t("kappa_title"),
      bodyHtml: `<div class="empty-hint">${esc(t("need_two_coders"))}</div>`,
      footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
    });
  }
  const renderTable = body => {
    const coderA = body.querySelector("#kpA").value;
    const coderB = body.querySelector("#kpB").value;
    const r = interCoderAgreement(state.project, coderA, coderB);
    const fmtK = k => (Math.round(k * 100) / 100).toFixed(2);
    const kColor = k => k > 0.8 ? "#59a14f" : k > 0.6 ? "#8cd17d" : k > 0.4 ? "#edc948" : k > 0.2 ? "#f28e2b" : "#e15759";
    const row = (label, x, bold = false) => `
      <tr ${bold ? 'style="font-weight:700;border-top:2px solid var(--border)"' : ""}>
        <td>${label}</td>
        <td class="num">${x.a}</td><td class="num">${x.b}</td><td class="num">${x.c}</td><td class="num">${x.d}</td>
        <td class="num">${(100 * x.po).toFixed(1)} %</td>
        <td class="num" style="color:${kColor(x.kappa)};font-weight:700">${fmtK(x.kappa)}</td>
        <td>${esc(t(kappaInterpretation(x.kappa)))}</td>
      </tr>`;
    body.querySelector("#kpTable").innerHTML = `
      <p style="color:var(--text-soft);font-size:12.5px">${r.sharedDocs} ${esc(t("kappa_basis"))} — ${r.units} ¶</p>
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th>${esc(t("code"))}</th><th>A∩B</th><th>A seul</th><th>B seul</th><th>ni A ni B</th>
          <th>${esc(t("agreement"))}</th><th>κ</th><th>${esc(t("interpretation"))}</th></tr></thead>
        <tbody>
          ${r.perCode.map(x => row(`<span class="code-dot" style="background:${esc(x.code.color)};display:inline-block;vertical-align:-2px"></span> ${esc(x.code.name)}`, x)).join("")}
          ${row(esc(t("overall")), r.overall, true)}
        </tbody></table></div>`;
  };
  const m = openModal({
    title: t("kappa_title"), wide: true,
    bodyHtml: `
      <div class="panel-toolbar" style="gap:16px">
        <label>${esc(t("coder_a"))} <select id="kpA">${labels.map(l => `<option>${esc(l)}</option>`).join("")}</select></label>
        <label>${esc(t("coder_b"))} <select id="kpB">${labels.map((l, i) => `<option ${i === 1 ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      </div><div id="kpTable"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  m.body.querySelector("#kpA").onchange = () => renderTable(m.body);
  m.body.querySelector("#kpB").onchange = () => renderTable(m.body);
  renderTable(m.body);
}

/* ================================================================
   Corbeille (§3.5)
================================================================ */
function openTrash() {
  const render = body => {
    const { documents, codes } = state.project.trash;
    if (!documents.length && !codes.length) {
      body.innerHTML = `<div class="empty-hint">${esc(t("trash_empty"))}</div>`;
      return;
    }
    body.innerHTML = `
      ${documents.map((item, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span style="flex:1">📄 ${esc(item.doc.name)} <small style="color:var(--text-soft)">(${item.segments.length} seg.)</small></span>
          <button class="btn" data-rdoc="${i}">${esc(t("restore"))}</button>
        </div>`).join("")}
      ${codes.map((item, i) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span style="flex:1">🏷️ ${esc(item.codes.map(c => c.name).join(", "))} <small style="color:var(--text-soft)">(${item.segments.length} seg.)</small></span>
          <button class="btn" data-rcode="${i}">${esc(t("restore"))}</button>
        </div>`).join("")}`;
    body.querySelectorAll("[data-rdoc]").forEach(b => b.onclick = () => { restoreTrashedDoc(Number(b.dataset.rdoc)); renderAll(); render(body); });
    body.querySelectorAll("[data-rcode]").forEach(b => b.onclick = () => { restoreTrashedCode(Number(b.dataset.rcode)); renderAll(); render(body); });
  };
  const m = openModal({
    title: t("trash_title"), bodyHtml: "",
    footer: [
      { label: t("empty_trash"), danger: true, onClick: (o) => { state.project.trash = { documents: [], codes: [] }; scheduleSave(); render(o.querySelector(".modal-body")); } },
      { label: t("close"), primary: true, onClick: (o, c) => c() },
    ],
  });
  render(m.body);
}

/* ================================================================
   Barre d'état
================================================================ */
function renderStatus() {
  $("#statusDocs").textContent = `📄 ${state.project.documents.length} ${t("docs")}`;
  $("#statusCodes").textContent = `🏷️ ${state.project.codes.length} ${t("codes_lbl")}`;
  $("#statusSegments").textContent = `✂️ ${state.project.segments.length} ${t("segments_lbl")}`;
}

init();
