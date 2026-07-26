// QualiCode — application d'analyse qualitative de données (MVP du cahier des charges)
import { t, setLang, getLang, applyStaticTranslations, LANGS } from "./i18n.js";
import {
  state, emptyProject, normalizeProject, uid, CODE_COLORS,
  scheduleSave, persistNow, loadPersisted, setOnSaved, savePrefs, loadPrefs,
  listProjects, loadProjectById, deleteProjectById,
  getDoc, getCode, getGroup, getSegment, childCodes, segmentsOfDoc,
  addDocument, addGroup, addCode, addSegment, deleteSegment,
  trashDocument, trashCode, restoreTrashedDoc, restoreTrashedCode,
  upsertMemo, getMemo,
  pushUndoSnapshot, undoAction, redoAction, canUndo, canRedo, clearUndoHistory,
  saveQuery, deleteQuery,
} from "./state.js";
import {
  searchDocuments, wordFrequencies, kwic, codeMatrix, coocMatrix,
  groupComparison, variableStats, flatCodes,
} from "./analysis.js";
import { exportProject, exportSegmentsCsv, exportCodeSystem, exportMatrixCsv, exportReportDocx, openPrintableReport, downloadBlob } from "./export.js";
import { buildSampleProject } from "./sample.js";
import { extractDocxText } from "./docx.js";
import { extractPdfText } from "./pdf.js";
import { buildRefiQdpx, importRefiQdpx } from "./refi.js";
import { detectBiblioFormat, parseRis, parseBibtex, formatApa } from "./biblio.js";
import { chiSquareTest, spearman, docCodeMatrix, codeByVariableTable, buildRExport } from "./stats.js";
import { rtConnect, rtDisconnect, rtStatus, rtBroadcast, setRtHandlers } from "./realtime.js";
import { openConceptMapEditor } from "./conceptmap.js";
import { buildPlayerBar, wrapTimestamps, fmtTs, createMediaElement } from "./audio.js";
import { fileToDataUrl, isImageFile, buildImageView } from "./imagecode.js";
import { extractPdfImages, ocrImages } from "./ocr.js";
import {
  detectSocialFormat, parseWhatsApp, buildChatDocument, chatStats,
  parseCsvRows, parseJsonRecords, guessMapping, buildPostsDocument,
} from "./social.js";
import { AI_MODELS, getAiConfig, saveAiConfig, docParagraphs, suggestCodes } from "./ai.js";
import {
  isSyncSupported, pickFolder, getCoderName, setCoderName,
  publishFilename, writeToFolder, listProjxFiles, coderFromFilename, markSeen, fileStatus,
} from "./sync.js";
import { isEncryptedEnvelope, encryptProjectJson, decryptProjectEnvelope } from "./crypto.js";
import { hasAppLock, setAppLock, removeAppLock, verifyAppLock, applockGate, showLockScreen } from "./applock.js";
import { licenseStatus, licenseGate, activateKey, licenseBadge, PLAN_LABELS } from "./license.js";
import { buildPaymentsHtml } from "./payments.js";
import { downloadGuidePdf, downloadManuelPdf } from "./helpdocs.js";
import { initMobile, isMobileLayout, focusTextPanel, showMobilePanel, registerServiceWorker,
         promptInstall, isInstalled, isIosSafari, canInstallNatively,
         initInstallBanner, initFileHandler, installDiagnostic } from "./mobile.js";
import { mergeProjects, coderLabels, interCoderAgreement, kappaInterpretation } from "./merge.js";

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const expandedCodes = new Set();   // codes dépliés dans l'arbre
const expandedGroups = new Set();  // groupes dépliés
let panel4Mode = "segments";       // segments | search
let searchResults = [];
let searchQuery = "";
let pendingSelection = null;       // {start, end} sélection en attente de codage
let pendingImageRect = null;       // {x,y,w,h} zone d'image en attente de codage
let docFilterQuery = "";           // filtre de l'arbre des documents (gros corpus)
let projectPassword = null;        // mot de passe du projet, gardé en mémoire de session uniquement

// Média (audio OU vidéo) par document : blobs en mémoire de session uniquement
// (jamais persistés — trop volumineux pour localStorage). Seul le nom du fichier
// est enregistré dans le projet (doc.audioName) pour proposer la réassociation.
const docAudio = new Map();        // docId → { url, name, el: HTMLMediaElement, isVideo }

function getDocAudioEl(docId) {
  const a = docAudio.get(docId);
  return a ? a.el : null;
}

function attachAudioToDoc(doc, file) {
  const prev = docAudio.get(doc.id);
  if (prev) { prev.el.pause(); URL.revokeObjectURL(prev.url); }
  const { el, isVideo, url } = createMediaElement(file);
  docAudio.set(doc.id, { url, name: file.name, el, isVideo });
  doc.audioName = file.name;
  scheduleSave();
  renderBrowser();
  toast((isVideo ? t("video_attached") : t("audio_attached")) + " " + file.name);
}

/* ================================================================
   Initialisation
================================================================ */
async function init() {
  loadPrefs();
  setLang(state.ui.lang);
  document.body.classList.toggle("dark", state.ui.theme === "dark");
  $("#langLabel").textContent = getLang().toUpperCase();

  // Verrou d'application : mot de passe AVANT tout accès aux données
  await applockGate();

  if (!(await loadPersisted())) {
    state.project = buildSampleProject();
    persistNow();
  }
  // Abonnement : essai 5 jours puis clé de licence ; l'export reste possible
  await licenseGate(() => exportProject());
  // Déplie les racines par défaut
  state.project.documentGroups.forEach(g => expandedGroups.add(g.id));
  childCodes(null).forEach(c => expandedCodes.add(c.id));

  setOnSaved(() => {
    $("#statusSaved").textContent = "✓ " + t("autosaved") + " · " + new Date().toLocaleTimeString();
    // Diffusion temps réel de la contribution locale après chaque sauvegarde
    if (rtStatus().connected) rtBroadcast(myContribution());
  });
  setRtHandlers({
    onRemoteUpdate: applyRemoteUpdate,
    onStatus: (status, detail) => {
      renderRtStatus();
      if (status === "connected") { toast("🟢 " + t("rt_connected")); rtBroadcast(myContribution()); }
      else if (status === "disconnected") toast("⚪ " + t("rt_offline"));
      else if (status === "peer-joined") { toast("👋 " + detail); rtBroadcast(myContribution()); }
      else if (status === "presence") renderRtStatus();
    },
  });

  bindRibbon();
  bindPanels();
  bindSplitters();

  // Téléphone : volet unique + barre d'onglets, codage tactile, installation PWA
  initMobile({
    onSelectionActive: () => { const s = getSelectionOffsets(); if (s) pendingSelection = s; },
    onCodeSelection: (x, y) => {
      const sel = captureSelection();
      if (sel) showCodingPopup(x, y, sel);
      else toast(t("m_select_first"));
    },
  });
  registerServiceWorker();
  // Installation en un clic : bandeau discret + bouton du ruban
  initInstallBanner(r => { if (r === "accepted") toast("✅ " + t("m_install_done")); });
  // Ouverture directe d'un .projx / .qdpx double-cliqué dans le système
  initFileHandler(files => openProjectFromFile(files[0]));

  applyStaticTranslations();
  renderAll();
  handleLaunchAction();

  // Filet de sécurité : sauvegarde immédiate si la page se ferme ou passe en
  // arrière-plan avant l'expiration du délai de sauvegarde automatique
  const flush = () => { if (state.ui.dirty) persistNow(); };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

function renderAll() {
  applyStaticTranslations();
  renderDocTree();
  renderCodeTree();
  renderBrowser();
  renderPanel4();
  renderStatus();
  updateUndoButtons();
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

  // Sélecteur de langue : menu des 12 langues de l'interface
  $("#btnLang").onclick = () => {
    openModal({
      title: "🌐 " + t("lang_title"),
      bodyHtml: `<p style="font-size:12px;color:var(--text-soft);margin-top:0">${esc(t("lang_hint"))}</p>
        <div class="lang-grid">${LANGS.map(l =>
          `<button class="btn lang-item ${l.code === getLang() ? "primary" : ""}" data-lang="${l.code}"
             ${l.rtl ? 'dir="rtl"' : ""}>${esc(l.label)}</button>`).join("")}</div>`,
      footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
    }).body.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => {
      state.ui.lang = b.dataset.lang;
      setLang(state.ui.lang);
      $("#langLabel").textContent = getLang().toUpperCase();
      savePrefs();
      document.querySelector(".modal-overlay")?.remove();
      renderAll();
    });
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
    // Import REFI-QDA : projet venant de MAXQDA / NVivo / ATLAS.ti (ou QualiCode)
    if (/\.qdpx$/i.test(file.name)) {
      try {
        const { project, stats } = await importRefiQdpx(await file.arrayBuffer());
        switchToProject(normalizeProject(project));
        toast(t("refi_imported")
          .replace("{d}", stats.documents).replace("{c}", stats.codes).replace("{s}", stats.segments));
      } catch (err) {
        console.error(err);
        toast(t("refi_import_fail"));
      }
      return;
    }
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
  $("#btnMyProjects").onclick = openMyProjects;
  $("#btnProtect").onclick = openProtectModal;
  $("#btnApplock").onclick = openApplockModal;
  $("#btnLicense").onclick = openLicenseModal;
  $("#btnLockNow").hidden = !hasAppLock();
  $("#btnLockNow").onclick = () => showLockScreen();
  $("#btnMergeProject").onclick = () => $("#mergeInput").click();
  $("#btnSharedFolder").onclick = openSharedFolder;
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
  $("#btnInstall").onclick = () => openInstallModal();
  // Raccourci toujours visible (surtout sur téléphone, où le ruban est replié)
  $("#btnInstallTop").onclick = () => openInstallModal();
  $("#btnInstallTop").hidden = isInstalled();
  document.addEventListener("qc-installed", () => { $("#btnInstallTop").hidden = true; });
  $("#btnGuidePdf").onclick = () => { downloadGuidePdf(); toast("📖 " + t("doc_downloaded")); };
  $("#btnManuelPdf").onclick = () => { downloadManuelPdf(); toast("🎓 " + t("doc_downloaded")); };

  // --- Importer ---
  $("#btnImportFiles").onclick = () => $("#fileInput").click();
  $("#fileInput").addEventListener("change", async e => {
    const files = [...e.target.files];
    e.target.value = "";
    let imported = 0, failed = [], pdfForOcr = null;
    for (const f of files) {
      try {
        if (isImageFile(f)) {
          // Document image : codage par zones rectangulaires
          const dataUrl = await fileToDataUrl(f);
          const doc = addDocument(f.name.replace(/\.[^.]+$/, ""), "");
          doc.kind = "image";
          doc.imageData = dataUrl;
          state.ui.currentDocId = doc.id;
          scheduleSave();
          imported++;
          continue;
        }
        const text = /\.docx$/i.test(f.name)
          ? await extractDocxText(f)
          : /\.pdf$/i.test(f.name)
            ? await extractPdfText(await f.arrayBuffer())
            : (await f.text()).replace(/\r\n/g, "\n");
        addDocument(f.name.replace(/\.[^.]+$/, ""), text);
        imported++;
      } catch (err) {
        console.error("Import failed:", f.name, err);
        // PDF sans texte extractible : probablement un scan → proposer l'OCR
        if (/\.pdf$/i.test(f.name) && !pdfForOcr) pdfForOcr = f;
        else failed.push(f.name);
      }
    }
    if (imported) renderAll();
    if (failed.length) toast(t("import_failed") + " : " + failed.join(", "));
    else if (imported) toast(imported + " " + t("import_done"));
    if (pdfForOcr) openOcrModal(pdfForOcr);
  });
  $("#btnImportCsv").onclick = () => $("#csvInput").click();
  $("#csvInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) importCsv(await file.text(), file.name.replace(/\.[^.]+$/, ""));
  });
  $("#btnPasteDoc").onclick = openPasteDoc;
  $("#btnTranscribe").onclick = () => $("#transInput").click();
  $("#transInput").addEventListener("change", e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) openTranscribe(file);
  });
  $("#btnSocial").onclick = () => $("#socialInput").click();
  $("#btnBiblio").onclick = openBiblio;
  $("#biblioInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const fmt = detectBiblioFormat(file.name, text);
    if (!fmt) return toast(t("bib_unknown"));
    const refs = fmt === "ris" ? parseRis(text) : parseBibtex(text);
    if (!refs.length) return toast(t("bib_unknown"));
    pushUndoSnapshot();
    for (const r of refs) state.project.bibliography.push({ id: uid(), ...r });
    scheduleSave();
    updateUndoButtons();
    toast(t("bib_imported").replace("{n}", refs.length));
    // Rafraîchit la liste si le modal Bibliographie est déjà ouvert
    if (biblioRerender) biblioRerender();
  });
  $("#socialInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) openSocialImport(file, await file.text());
  });
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
  $("#btnAiSuggest").onclick = openAiSuggest;
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
  $("#btnAdvStats").onclick = openAdvStats;
  $("#btnKappa").onclick = openKappa;
  $("#btnSavedQueries").onclick = openSavedQueries;
  $("#btnRealtime").onclick = openRealtime;
  $("#btnShortcuts").onclick = openShortcutsHelp;

  // --- Visualisation ---
  $("#btnPortrait").onclick = openPortrait;
  $("#btnWordCloud").onclick = openWordCloud;
  $("#btnBarChart").onclick = openBarChart;
  $("#btnConceptMap").onclick = () => openConceptMapEditor(state.project, scheduleSave);

  // --- Rapports ---
  $("#btnExportSegments").onclick = () => { exportSegmentsCsv(state.project.segments); toast(t("export_done")); };
  $("#btnExportDocx").onclick = () => { exportReportDocx(state.project.segments); toast(t("export_done")); };
  $("#btnExportReport").onclick = () => openPrintableReport(state.project.segments);
  $("#btnExportCodes").onclick = () => { exportCodeSystem(); toast(t("export_done")); };
  $("#btnExportMatrixCsv").onclick = () => { exportMatrixCsv(); toast(t("export_done")); };
  $("#btnExportRefi").onclick = () => {
    const blob = buildRefiQdpx(state.project);
    downloadBlob(state.project.name.replace(/[\\/:*?"<>|]/g, "_") + ".qdpx", blob);
    toast(t("export_done") + " — " + t("refi_desc"));
  };

  // --- Annuler / Rétablir ---
  $("#btnUndo").onclick = handleUndo;
  $("#btnRedo").onclick = handleRedo;

  // Raccourcis clavier : Alt+C, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z
  document.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const sel = captureSelection();
      if (sel && state.ui.selectedCodeId) applyCodeToSelection(state.ui.selectedCodeId, sel);
      return;
    }
    const isMac = navigator.platform.startsWith("Mac");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
    if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); $("#btnSaveProject").click(); }
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      // Le champ de recherche vit dans l'onglet Accueil : on y bascule d'abord
      document.querySelector('#ribbonTabs [data-tab="home"]').click();
      $("#searchInput").focus();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "F1") { e.preventDefault(); openShortcutsHelp(); }
  });
}

function handleUndo() {
  if (!undoAction()) return toast(t("nothing_to_undo"));
  renderAll();
  updateUndoButtons();
  toast(t("undo_done"));
}

function handleRedo() {
  if (!redoAction()) return toast(t("nothing_to_redo"));
  renderAll();
  updateUndoButtons();
  toast(t("redo_done"));
}

function updateUndoButtons() {
  $("#btnUndo").disabled = !canUndo();
  $("#btnRedo").disabled = !canRedo();
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
  $("#docFilter").addEventListener("input", e => { docFilterQuery = e.target.value; renderDocTree(); });
  $("#btnDocMemo").onclick = () => {
    const doc = getDoc(state.ui.currentDocId);
    if (doc) openMemoEditor("document", doc.id, doc.name);
  };
  $("#btnDocAudio").onclick = () => {
    if (!getDoc(state.ui.currentDocId)) return toast(t("hint_no_doc"));
    $("#audioInput").click();
  };
  $("#audioInput").addEventListener("change", e => {
    const file = e.target.files[0];
    e.target.value = "";
    const doc = getDoc(state.ui.currentDocId);
    if (file && doc) attachAudioToDoc(doc, file);
  });
  $("#btnDocProps").onclick = () => {
    const doc = getDoc(state.ui.currentDocId);
    if (doc) openDocProps(doc);
  };

  // Sélection de texte → menu de codage flottant
  $("#docBrowser").addEventListener("mouseup", e => {
    setTimeout(() => {
      // Les documents image gèrent leur propre menu (tracé de zones)
      if (getDoc(state.ui.currentDocId)?.kind === "image") return;
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
    row.onclick = () => {
      state.ui.currentDocId = doc.id;
      renderDocTree(); renderBrowser();
      focusTextPanel(); // sur téléphone : bascule aussitôt sur le texte
    };
    row.querySelector("[data-act=memo]").onclick = e => { e.stopPropagation(); openMemoEditor("document", doc.id, doc.name); };
    row.querySelector("[data-act=props]").onclick = e => { e.stopPropagation(); openDocProps(doc); };
    row.querySelector("[data-act=del]").onclick = e => {
      e.stopPropagation();
      confirmModal(t("delete_doc_q"), () => { trashDocument(doc.id); renderAll(); });
    };
    row.addEventListener("dragstart", e => e.dataTransfer.setData("text/qualicode-doc", doc.id));
    return row;
  };

  // Gros corpus : filtre par nom + plafond d'affichage (le DOM reste léger
  // même avec des milliers de documents ; le filtre donne accès à tout)
  const MAX_ROWS = 300;
  const filter = docFilterQuery.trim().toLowerCase();
  const matches = d => !filter || d.name.toLowerCase().includes(filter);
  let shown = 0, hidden = 0;
  const addRow = (container, d) => {
    if (!matches(d)) return;
    if (shown >= MAX_ROWS) { hidden++; return; }
    container.appendChild(docRow(d));
    shown++;
  };

  for (const g of state.project.documentGroups) {
    const groupDocs = state.project.documents.filter(d => d.groupId === g.id);
    if (filter && !groupDocs.some(matches)) continue; // groupe sans résultat masqué
    const gr = document.createElement("div");
    gr.className = "tree-item group-row";
    const open = filter ? true : expandedGroups.has(g.id); // filtre actif : tout déplié
    gr.innerHTML = `<span class="caret">${open ? "▼" : "►"}</span><span class="label">📁 ${esc(g.name)}</span>
      <span class="count">${groupDocs.length}</span>
      <span class="row-actions"><button data-act="ren" title="${esc(t("rename"))}">✏️</button></span>`;
    gr.onclick = () => { expandedGroups.has(g.id) ? expandedGroups.delete(g.id) : expandedGroups.add(g.id); renderDocTree(); };
    gr.querySelector("[data-act=ren]").onclick = e => {
      e.stopPropagation();
      promptModal(t("rename"), t("new_group_name"), g.name, name => { pushUndoSnapshot(); g.name = name; scheduleSave(); renderDocTree(); updateUndoButtons(); });
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
      groupDocs.forEach(d => addRow(kids, d));
      root.appendChild(kids);
    }
  }
  ungrouped.forEach(d => addRow(root, d));

  if (hidden > 0) {
    const more = document.createElement("div");
    more.className = "empty-hint";
    more.textContent = t("docs_hidden").replace("{n}", hidden);
    root.appendChild(more);
  }

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
      row.ondblclick = () => promptModal(t("rename"), t("code_name_q"), code.name, name => { pushUndoSnapshot(); code.name = name; scheduleSave(); renderAll(); updateUndoButtons(); });
      row.querySelector("[data-act=add]").onclick = e => { e.stopPropagation(); openNewCodeModal(code.id); };
      row.querySelector("[data-act=memo]").onclick = e => { e.stopPropagation(); openMemoEditor("code", code.id, code.name); };
      row.querySelector("[data-act=ren]").onclick = e => {
        e.stopPropagation();
        promptModal(t("rename"), t("code_name_q"), code.name, name => { pushUndoSnapshot(); code.name = name; scheduleSave(); renderAll(); updateUndoButtons(); });
      };
      row.querySelector("[data-act=del]").onclick = e => {
        e.stopPropagation();
        confirmModal(t("delete_code_q"), () => { trashCode(code.id); renderAll(); });
      };
      // Glisser-déposer : réorganisation hiérarchique + recodage de segments
      row.addEventListener("dragstart", e => { e.stopPropagation(); e.dataTransfer.setData("text/qualicode-code", code.id); });
      row.addEventListener("dragover", e => {
        if (e.dataTransfer.types.includes("text/qualicode-code") ||
            e.dataTransfer.types.includes("text/qualicode-seg")) e.preventDefault();
      });
      row.addEventListener("drop", e => {
        e.stopPropagation();
        // Recodage : une carte segment déposée sur ce code
        const segId = e.dataTransfer.getData("text/qualicode-seg");
        if (segId) {
          const seg = getSegment(segId);
          if (seg && seg.codeId !== code.id) {
            pushUndoSnapshot();
            seg.codeId = code.id;
            scheduleSave();
            renderAll();
            toast(t("recode_done") + " « " + code.name + " »");
          }
          return;
        }
        const draggedId = e.dataTransfer.getData("text/qualicode-code");
        if (!draggedId || draggedId === code.id) return;
        // Empêche de déposer un code dans sa propre descendance
        let p = code;
        while (p) { if (p.id === draggedId) return; p = getCode(p.parentId); }
        const dragged = getCode(draggedId);
        if (dragged) { pushUndoSnapshot(); dragged.parentId = code.id; expandedCodes.add(code.id); scheduleSave(); renderCodeTree(); updateUndoButtons(); }
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
    if (dragged) { pushUndoSnapshot(); dragged.parentId = null; scheduleSave(); renderCodeTree(); updateUndoButtons(); }
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
  $("#browserTitle").textContent = (doc.kind === "image" ? "🖼️ " : "📖 ") + doc.name;

  // Document image : codage par zones rectangulaires
  if (doc.kind === "image") {
    const zones = state.ui.showHighlights ? segmentsOfDoc(doc.id).filter(s => s.rect) : [];
    el.innerHTML = `<div class="doc-title-block"><h2>${esc(doc.name)}</h2>
      <div class="doc-meta">🖼️ ${zones.length} ${esc(t("img_zones_lbl"))}</div></div>`;
    el.appendChild(buildImageView({
      doc, segments: zones, getCode,
      hint: t("img_hint"),
      onRectDrawn: (rect, x, y) => {
        pendingImageRect = rect;
        showCodingPopupCustom(x, y, codeId => applyCodeToRect(codeId));
      },
      onSegmentClick: segId => openSegmentModal(segId),
    }));
    return;
  }

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

  // --- Lecteur audio horodaté ---
  // Met en pause l'audio des autres documents
  for (const [id, a] of docAudio) if (id !== doc.id) a.el.pause();
  const audioInfo = docAudio.get(doc.id);
  if (audioInfo) {
    const bar = buildPlayerBar(audioInfo.el, {
      onCopyTs: ts => {
        navigator.clipboard?.writeText(ts).catch(() => {});
        toast(t("ts_copied") + " " + ts);
      },
    });
    const label = document.createElement("span");
    label.className = "audio-name";
    label.textContent = (audioInfo.isVideo ? "🎬 " : "🎧 ") + audioInfo.name;
    bar.prepend(label);
    // Codage direct sur la piste : marquer le début, puis la fin de l'extrait
    const bClip = document.createElement("button");
    bClip.className = "mini-btn audio-btn clip-btn";
    bClip.textContent = "⏺ " + t("clip_start");
    bClip.title = t("clip_hint");
    let clipStart = null;
    bClip.onclick = () => {
      if (clipStart === null) {
        clipStart = audioInfo.el.currentTime;
        bClip.textContent = "⏹ " + t("clip_end") + " " + fmtTs(clipStart) + "→…";
        bClip.classList.add("recording");
      } else {
        const a = Math.min(clipStart, audioInfo.el.currentTime);
        const b = Math.max(clipStart, audioInfo.el.currentTime);
        clipStart = null;
        bClip.textContent = "⏺ " + t("clip_start");
        bClip.classList.remove("recording");
        if (b - a < 0.5) return toast(t("clip_too_short"));
        audioInfo.el.pause();
        openClipCodeModal(doc, a, b);
      }
    };
    bar.appendChild(bClip);
    if (audioInfo.isVideo) {
      // Panneau vidéo repliable au-dessus de la barre de lecture
      const wrap = document.createElement("div");
      wrap.className = "video-wrap";
      wrap.appendChild(audioInfo.el);
      const toggle = document.createElement("button");
      toggle.className = "mini-btn audio-btn";
      toggle.textContent = "🎬";
      toggle.title = t("video_toggle");
      toggle.onclick = () => { wrap.hidden = !wrap.hidden; };
      bar.appendChild(toggle);
      el.prepend(bar);
      el.prepend(wrap);
    } else {
      el.prepend(bar);
    }
  } else if (doc.audioName) {
    // Un audio était associé lors d'une session précédente : proposer la réassociation
    const hint = document.createElement("div");
    hint.className = "audio-bar audio-reattach";
    hint.innerHTML = `<span>🎧 ${esc(t("audio_reattach"))} <strong>${esc(doc.audioName)}</strong></span>`;
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = t("audio_reattach_btn");
    b.onclick = () => $("#audioInput").click();
    hint.appendChild(b);
    el.prepend(hint);
  }
  // Horodatages [mm:ss] / [h:mm:ss] cliquables dans le texte
  wrapTimestamps(el, sec => {
    const a = docAudio.get(doc.id);
    if (!a) return toast(t("ts_no_audio"));
    a.el.currentTime = sec;
    a.el.play();
  });

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
  // Restaure les boutons In vivo / Nouveau code (masqués en mode image)
  $("#popupInVivo").style.display = "";
  $("#popupNewCode").style.display = "";
}

// Variante du menu de codage : applique un rappel arbitraire (zones d'images…)
function showCodingPopupCustom(x, y, applyFn) {
  const popup = $("#codingPopup");
  const list = $("#codingPopupList");
  const codes = flatCodes();
  list.innerHTML = codes.length
    ? codes.map(c => `<div class="popup-code" data-id="${c.id}" style="padding-left:${8 + c.depth * 14}px">
        <span class="code-dot" style="background:${esc(c.color)}"></span><span>${esc(c.name)}</span></div>`).join("")
    : `<div style="padding:8px;color:var(--text-soft)">${esc(t("select_code_first"))}</div>`;
  list.querySelectorAll(".popup-code").forEach(el => {
    el.onclick = () => { applyFn(el.dataset.id); hideCodingPopup(); };
  });
  $("#popupInVivo").style.display = "none";
  $("#popupNewCode").style.display = "none";
  popup.hidden = false;
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  popup.style.left = Math.min(x + 6, window.innerWidth - pw - 10) + "px";
  popup.style.top = Math.min(y + 10, window.innerHeight - ph - 10) + "px";
}

// Applique un code à la zone d'image en attente
function applyCodeToRect(codeId) {
  const doc = getDoc(state.ui.currentDocId);
  if (!doc || !pendingImageRect) return;
  pushUndoSnapshot();
  state.project.segments.push({
    id: uid(), docId: doc.id, codeId,
    start: -1, end: -1, rect: pendingImageRect,
    text: t("img_zone_lbl"), weight: 1, comment: "",
    created: new Date().toISOString(),
  });
  pendingImageRect = null;
  scheduleSave();
  renderAll();
  toast(t("coded_with") + " « " + (getCode(codeId)?.name ?? "?") + " »");
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
    html += `<div class="seg-card" data-id="${s.id}" draggable="true" title="${esc(t("drag_to_recode"))}">
      <div class="seg-card-head">
        <span class="badge" style="background:${esc(hexToRgba(code?.color ?? "#888", 0.3))}">${esc(code?.name ?? "?")}</span>
        <span class="src" data-doc="${s.docId}" data-start="${s.start}"${s.mediaStart != null ? ` data-media="${s.mediaStart}"` : ""}>${esc(doc?.name ?? "?")}</span>
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
  el.querySelectorAll(".src").forEach(sp => sp.onclick = () => {
    gotoDocPosition(sp.dataset.doc, Math.max(0, Number(sp.dataset.start)));
    // Extrait codé sur la piste : saute le média au début de l'extrait
    if (sp.dataset.media != null) {
      const a = docAudio.get(sp.dataset.doc);
      if (a) { a.el.currentTime = Number(sp.dataset.media); a.el.play(); }
      else toast(t("ts_no_audio"));
    }
  });
  // Recodage par glisser-déposer : tirer une carte segment sur un code du volet Codes
  el.querySelectorAll(".seg-card").forEach(card => {
    card.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/qualicode-seg", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
  });
}

function gotoDocPosition(docId, charPos) {
  state.ui.currentDocId = docId;
  renderDocTree(); renderBrowser();
  focusTextPanel();
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

/* ---------- Transcription assistée : audio/vidéo + éditeur + horodatages ---------- */
function openTranscribe(file) {
  const { el: audio, isVideo, url } = createMediaElement(file);
  const groups = state.project.documentGroups;
  const m = openModal({
    title: (isVideo ? "🎬 " : "🎙️ ") + t("transcribe_title"), wide: true,
    bodyHtml: `
      <div id="trVideo"></div>
      <div id="trPlayer"></div>
      <p class="trans-hint">${esc(t("transcribe_hint"))}</p>
      <div class="form-row"><label>${esc(t("doc_title"))}</label>
        <input type="text" id="trName" value="${esc(file.name.replace(/\.[^.]+$/, ""))}"></div>
      ${groups.length ? `<div class="form-row"><label>${esc(t("group"))}</label>
        <select id="trGroup"><option value="">—</option>${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></div>` : `<select id="trGroup" hidden><option value=""></option></select>`}
      <div class="form-row"><label>${esc(t("doc_text"))}</label>
        <textarea id="trText" style="min-height:260px" placeholder="Enquêteur : …&#10;Participante : …"></textarea></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, close) => { audio.pause(); URL.revokeObjectURL(url); close(); } },
      {
        label: t("add_doc"), primary: true, onClick: (o, close) => {
          const text = o.querySelector("#trText").value.replace(/\r\n/g, "\n");
          if (!text.trim()) return;
          const name = o.querySelector("#trName").value.trim() || file.name;
          const doc = addDocument(name, text, o.querySelector("#trGroup").value || null);
          // Le média reste associé au nouveau document pour la relecture
          audio.pause();
          docAudio.set(doc.id, { url, name: file.name, el: audio, isVideo });
          doc.audioName = file.name;
          state.ui.currentDocId = doc.id;
          scheduleSave();
          close(); renderAll();
          toast(t("transcribe_done"));
        }
      },
    ],
  });

  const ta = m.body.querySelector("#trText");
  const insertTs = ts => {
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, pos) + ts + " " + ta.value.slice(ta.selectionEnd ?? pos);
    ta.selectionStart = ta.selectionEnd = pos + ts.length + 1;
    ta.focus();
  };
  if (isVideo) {
    const wrap = document.createElement("div");
    wrap.className = "video-wrap";
    wrap.appendChild(audio);
    m.body.querySelector("#trVideo").appendChild(wrap);
  }
  m.body.querySelector("#trPlayer").appendChild(buildPlayerBar(audio, { onCopyTs: insertTs }));

  // Raccourcis (actifs dans la fenêtre de transcription) :
  // Ctrl+Espace = lecture/pause · Ctrl+B = -5 s · Ctrl+T = horodatage au curseur
  m.overlay.addEventListener("keydown", e => {
    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === " " || e.code === "Space") { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    else if (k === "b") { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
    else if (k === "t") { e.preventDefault(); insertTs(fmtTs(audio.currentTime)); }
  });
  ta.focus();
}

/* ---------- Codage direct sur la piste audio/vidéo ---------- */
function openClipCodeModal(doc, mediaStart, mediaEnd) {
  const codes = flatCodes();
  if (!codes.length) return toast(t("select_code_first"));
  openModal({
    title: "⏺ " + t("clip_title"),
    bodyHtml: `
      <p>🎧 <strong>${esc(fmtTs(mediaStart))} → ${esc(fmtTs(mediaEnd))}</strong>
        (${Math.round(mediaEnd - mediaStart)} s) — ${esc(doc.name)}</p>
      <div class="form-row"><label>${esc(t("clip_code"))}</label>
        <select id="clipCode">${codes.map(c =>
          `<option value="${c.id}">${"— ".repeat(c.depth)}${esc(c.name)}</option>`).join("")}</select></div>
      <div class="form-row"><label>${esc(t("clip_note"))}</label>
        <input type="text" id="clipNote" placeholder="${esc(t("clip_note_ph"))}"></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, c) => c() },
      {
        label: t("ok"), primary: true, onClick: (o, close) => {
          const codeId = o.querySelector("#clipCode").value;
          const note = o.querySelector("#clipNote").value.trim();
          pushUndoSnapshot();
          state.project.segments.push({
            id: uid(), docId: doc.id, codeId,
            start: -1, end: -1, mediaStart, mediaEnd,
            text: `[🎧 ${fmtTs(mediaStart)}–${fmtTs(mediaEnd)}]` + (note ? " " + note : ""),
            weight: 1, comment: "", created: new Date().toISOString(),
          });
          scheduleSave();
          close(); renderAll();
          toast(t("coded_with") + " « " + (getCode(codeId)?.name ?? "?") + " »");
        }
      },
    ],
  });
}

/* ---------- OCR des PDF scannés (IA, clé utilisateur) ---------- */
async function openOcrModal(file) {
  const cfg = getAiConfig();
  const m = openModal({
    title: "📖 " + t("ocr_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("ocr_how")).replace("{f}", file.name)}</p>
      <div class="form-row"><label>${esc(t("ai_key"))}</label>
        <input type="password" id="ocrKey" value="${esc(cfg.key || "")}" placeholder="sk-ant-…" autocomplete="off"></div>
      <label class="rcheck" style="display:block;margin:10px 0;color:var(--danger,#c0392b)">
        <input type="checkbox" id="ocrConsent"> ${esc(t("ocr_consent"))}</label>
      <div id="ocrStatus" style="font-size:12.5px;color:var(--text-soft);margin:6px 0"></div>
      <div id="ocrResult" hidden>
        <div class="form-row"><label>${esc(t("doc_title"))}</label>
          <input type="text" id="ocrName" value="${esc(file.name.replace(/\.[^.]+$/, ""))}"></div>
        <textarea id="ocrText" style="min-height:220px;width:100%"></textarea>
        <button class="btn primary" id="ocrAdd" style="margin-top:8px">✅ ${esc(t("add_doc"))}</button>
      </div>`,
    footer: [
      { label: t("close"), onClick: (o, c) => c() },
      { label: "🔎 " + t("ocr_run"), primary: true, onClick: o => run(o) },
    ],
  });

  async function run(o) {
    const status = o.querySelector("#ocrStatus");
    const key = o.querySelector("#ocrKey").value.trim();
    if (!key) { status.textContent = t("ai_need_key"); return; }
    if (!o.querySelector("#ocrConsent").checked) { status.textContent = t("ai_need_consent"); return; }
    saveAiConfig({ ...getAiConfig(), key });
    try {
      status.textContent = "⏳ " + t("ocr_extracting");
      const blobs = extractPdfImages(await file.arrayBuffer());
      if (!blobs.length) { status.textContent = "⚠️ " + t("ocr_no_images"); return; }
      const model = getAiConfig().model || "claude-haiku-4-5-20251001";
      const text = await ocrImages({
        apiKey: key, model, blobs,
        onProgress: (i, n) => { status.textContent = "⏳ " + t("ocr_page").replace("{i}", i).replace("{n}", n); },
      });
      status.textContent = "✅ " + t("ocr_done_check");
      o.querySelector("#ocrResult").hidden = false;
      o.querySelector("#ocrText").value = text;
      o.querySelector("#ocrAdd").onclick = () => {
        const txt = o.querySelector("#ocrText").value.trim();
        if (!txt) return;
        const doc = addDocument(o.querySelector("#ocrName").value.trim() || file.name, txt.replace(/\r\n/g, "\n"));
        state.ui.currentDocId = doc.id;
        m.close();
        renderAll();
        toast(t("import_done"));
      };
    } catch (e) {
      status.textContent = "⚠️ " + (e.message === "cle-invalide" ? t("ai_bad_key")
        : e.message === "quota" ? t("ai_quota")
        : t("ai_error") + " " + e.message);
    }
  }
}

/* ---------- Bibliographie : références RIS / BibTeX ---------- */
function openBiblio() {
  const render = body => {
    const refs = state.project.bibliography;
    const listHtml = refs.length
      ? refs.map(r => `
        <div class="seg-card" data-id="${esc(r.id)}">
          <div class="seg-card-head">
            <span class="badge" style="background:var(--bg-hover)">${esc(r.type)}</span>
            <strong style="flex:1">${esc(r.title)}</strong>
            <span style="color:var(--text-soft);font-size:11.5px">${esc(r.year)}</span>
            <button class="mini-btn" data-act="delref" title="${esc(t("delete"))}">🗑️</button>
          </div>
          <div class="seg-card-body" style="font-size:12.5px">${esc(formatApa(r))}</div>
        </div>`).join("")
      : `<div class="empty-hint">${esc(t("bib_empty"))}</div>`;
    body.innerHTML = `
      <p class="trans-hint">${esc(t("bib_hint"))}</p>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn primary" id="bibImport">📥 ${esc(t("bib_import"))}</button>
        ${refs.length ? `<button class="btn" id="bibExport">📄 ${esc(t("bib_export"))}</button>` : ""}
        <span style="align-self:center;color:var(--text-soft);font-size:12.5px">${refs.length} ${esc(t("bib_refs_lbl"))}</span>
      </div>
      ${listHtml}`;
    body.querySelector("#bibImport").onclick = () => $("#biblioInput").click();
    body.querySelector("#bibExport")?.addEventListener("click", () => {
      const sorted = [...refs].sort((a, b) => (a.authors[0] || "").localeCompare(b.authors[0] || ""));
      const txt = sorted.map(formatApa).join("\n\n");
      downloadBlob("bibliographie.txt", new Blob(["﻿" + txt], { type: "text/plain;charset=utf-8" }));
      toast(t("export_done"));
    });
    body.querySelectorAll("[data-act=delref]").forEach(b => b.onclick = () => {
      pushUndoSnapshot();
      state.project.bibliography = state.project.bibliography.filter(x => x.id !== b.closest(".seg-card").dataset.id);
      scheduleSave();
      updateUndoButtons();
      render(body);
    });
  };
  const m = openModal({
    title: "📚 " + t("bib_title"), wide: true, bodyHtml: "",
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  render(m.body);
  biblioRerender = () => { if (document.body.contains(m.body)) render(m.body); };
}
let biblioRerender = null;

/* ---------- Import réseaux sociaux (exports WhatsApp / CSV / JSON) ---------- */
function setDocSource(doc, source) {
  if (!state.project.variables.includes("source")) state.project.variables.push("source");
  doc.variables = doc.variables || {};
  doc.variables.source = source;
}

function groupSelectHtml(id) {
  const groups = state.project.documentGroups;
  return groups.length
    ? `<div class="form-row"><label>${esc(t("group"))}</label>
        <select id="${id}"><option value="">—</option>${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></div>`
    : `<select id="${id}" hidden><option value=""></option></select>`;
}

function openSocialImport(file, text) {
  const format = detectSocialFormat(file.name, text);
  if (format === "whatsapp") return openWhatsAppImport(file, text);
  if (format === "csv" || format === "json") return openPostsImport(file, text, format);
  toast(t("social_unknown"));
}

// WhatsApp : aperçu + options, puis création du document
function openWhatsAppImport(file, text) {
  const { messages, system } = parseWhatsApp(text);
  if (!messages.length) return toast(t("social_unknown"));
  const stats = chatStats(messages);
  const authorsHtml = stats.authors.slice(0, 8)
    .map(([a, n]) => `<span class="badge" style="background:var(--bg-hover)">${esc(a)} · ${n}</span>`).join(" ");
  const m = openModal({
    title: "📱 " + t("wa_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("wa_stats"))
        .replace("{n}", stats.count).replace("{a}", stats.authors.length)
        .replace("{d1}", stats.firstDate).replace("{d2}", stats.lastDate)}
        ${system ? " · " + system + " " + esc(t("wa_system_skipped")) : ""}</p>
      <div style="margin-bottom:10px">${authorsHtml}</div>
      <div class="form-row"><label>${esc(t("doc_title"))}</label>
        <input type="text" id="waName" value="${esc(file.name.replace(/\.[^.]+$/, ""))}"></div>
      ${groupSelectHtml("waGroup")}
      <label class="rcheck" style="display:block;margin:10px 0"><input type="checkbox" id="waMerge" checked>
        ${esc(t("wa_merge"))}</label>
      <p style="font-size:12px;color:var(--text-soft)">${esc(t("wa_ethics"))}</p>`,
    footer: [
      { label: t("cancel"), onClick: (o, c) => c() },
      {
        label: t("add_doc"), primary: true, onClick: (o, close) => {
          const docText = buildChatDocument(messages, { mergeConsecutive: o.querySelector("#waMerge").checked });
          const doc = addDocument(o.querySelector("#waName").value.trim() || file.name, docText,
            o.querySelector("#waGroup").value || null);
          setDocSource(doc, "WhatsApp");
          state.ui.currentDocId = doc.id;
          scheduleSave();
          close(); renderAll();
          toast(t("social_done").replace("{n}", stats.count));
        }
      },
    ],
  });
}

// CSV / JSON : mappage des colonnes auteur / texte / date, aperçu, création
function openPostsImport(file, text, format) {
  let table;
  try {
    table = format === "json" ? parseJsonRecords(text) : parseCsvRows(text);
  } catch { return toast(t("social_unknown")); }
  if (!table || table.length < 2) return toast(t("social_unknown"));
  const headers = table[0], rows = table.slice(1);
  const guess = guessMapping(headers);

  const colSelect = (id, selIdx, allowNone) =>
    `<select id="${id}">${allowNone ? `<option value="-1">—</option>` : ""}${headers.map((h, i) =>
      `<option value="${i}" ${i === selIdx ? "selected" : ""}>${esc(h)}</option>`).join("")}</select>`;

  const m = openModal({
    title: "📱 " + t("posts_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("posts_hint")).replace("{n}", rows.length)}</p>
      <div class="form-row"><label>${esc(t("posts_col_text"))} *</label>${colSelect("spText", guess.text === -1 ? 0 : guess.text, false)}</div>
      <div class="form-row"><label>${esc(t("posts_col_author"))}</label>${colSelect("spAuthor", guess.author, true)}</div>
      <div class="form-row"><label>${esc(t("posts_col_date"))}</label>${colSelect("spDate", guess.date, true)}</div>
      <div class="form-row"><label>${esc(t("doc_title"))}</label>
        <input type="text" id="spName" value="${esc(file.name.replace(/\.[^.]+$/, ""))}"></div>
      ${groupSelectHtml("spGroup")}
      <div class="form-row"><label>${esc(t("posts_source"))}</label>
        <input type="text" id="spSource" value="${format === "json" ? "JSON" : "CSV"}" placeholder="X/Twitter, YouTube…"></div>
      <div id="spPreview" style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px;font-size:12px"></div>`,
    footer: [
      { label: t("cancel"), onClick: (o, c) => c() },
      {
        label: t("add_doc"), primary: true, onClick: (o, close) => {
          const map = {
            text: Number(o.querySelector("#spText").value),
            author: Number(o.querySelector("#spAuthor").value),
            date: Number(o.querySelector("#spDate").value),
          };
          const { text: docText, count } = buildPostsDocument(rows, map);
          if (!count) return toast(t("social_unknown"));
          const doc = addDocument(o.querySelector("#spName").value.trim() || file.name, docText,
            o.querySelector("#spGroup").value || null);
          setDocSource(doc, o.querySelector("#spSource").value.trim() || "Réseaux sociaux");
          state.ui.currentDocId = doc.id;
          scheduleSave();
          close(); renderAll();
          toast(t("social_done").replace("{n}", count));
        }
      },
    ],
  });

  const refreshPreview = () => {
    const map = {
      text: Number(m.body.querySelector("#spText").value),
      author: Number(m.body.querySelector("#spAuthor").value),
      date: Number(m.body.querySelector("#spDate").value),
    };
    const { text: previewText } = buildPostsDocument(rows.slice(0, 5), map);
    m.body.querySelector("#spPreview").textContent = previewText || "—";
  };
  ["spText", "spAuthor", "spDate"].forEach(id =>
    m.body.querySelector("#" + id).addEventListener("change", refreshPreview));
  refreshPreview();
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
   Mes projets : bibliothèque locale multi-projets
================================================================ */
function switchToProject(project) {
  state.project = project;
  state.ui.activatedDocs.clear(); state.ui.activatedCodes.clear();
  state.ui.currentDocId = project.documents[0]?.id ?? null;
  state.ui.selectedCodeId = null;
  projectPassword = null;
  panel4Mode = "segments";
  clearUndoHistory();
  updateUndoButtons();
  project.documentGroups.forEach(g => expandedGroups.add(g.id));
  childCodes(null).forEach(c => expandedCodes.add(c.id));
  persistNow();
  renderAll();
}

function openMyProjects() {
  persistNow(); // le projet courant apparaît dans la liste avec ses chiffres à jour
  const render = body => {
    const projects = listProjects();
    if (!projects.length) {
      body.innerHTML = `<div class="empty-hint">${esc(t("no_projects"))}</div>`;
      return;
    }
    body.innerHTML = `
      <p style="color:var(--text-soft);font-size:12.5px;margin-top:0">${esc(t("my_projects_hint"))}</p>
      ${projects.map(p => {
        const isCurrent = p.id === state.project.id;
        const date = new Date(p.modified).toLocaleString();
        return `<div class="seg-card" data-id="${esc(p.id)}">
          <div class="seg-card-head">
            <span style="font-size:15px">🗂️</span>
            <strong>${esc(p.name)}</strong>
            ${isCurrent ? `<span class="badge" style="background:var(--accent-soft)">✓ ${esc(t("currently_open"))}</span>` : ""}
            <span class="spacer"></span>
            ${isCurrent ? "" : `<button class="btn primary" data-act="open" style="padding:4px 14px">${esc(t("open"))}</button>
            <button class="mini-btn" data-act="del" title="${esc(t("delete"))}">🗑️</button>`}
          </div>
          <div class="seg-card-body" style="font-size:12px;color:var(--text-soft);padding:6px 12px">
            ${date} · ${p.documents} ${esc(t("docs"))} · ${p.codes} ${esc(t("codes_lbl"))} · ${p.segments} ${esc(t("segments_lbl"))}
          </div>
        </div>`;
      }).join("")}`;
    body.querySelectorAll("[data-act=open]").forEach(btn => btn.onclick = async () => {
      const id = btn.closest(".seg-card").dataset.id;
      const project = await loadProjectById(id);
      if (project) {
        m.close();
        switchToProject(project);
        toast(t("project_loaded") + " : " + project.name);
      }
    });
    body.querySelectorAll("[data-act=del]").forEach(btn => btn.onclick = () => {
      const id = btn.closest(".seg-card").dataset.id;
      confirmModal(t("delete_project_q"), () => {
        deleteProjectById(id);
        toast(t("project_deleted"));
        render(body);
      });
    });
  };
  const m = openModal({
    title: t("my_projects_title"), wide: true, bodyHtml: "",
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  render(m.body);
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
function openMergeModal(incoming, { coderLabel, onMerged } = {}) {
  openModal({
    title: t("merge_title"),
    bodyHtml: `
      <p>🧬 <strong>${esc(incoming.name)}</strong> — ${incoming.documents?.length ?? 0} ${esc(t("docs"))},
        ${incoming.codes?.length ?? 0} ${esc(t("codes_lbl"))}, ${incoming.segments?.length ?? 0} ${esc(t("segments_lbl"))}</p>
      <div class="form-row"><label>${esc(t("coder_label_q"))}</label><input type="text" id="mgCoder" value="${esc(coderLabel || "C2")}"></div>`,
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
          if (onMerged) onMerged();
        }
      },
    ],
  });
}

/* ================================================================
   Collaboration par dossier partagé (Drive/Dropbox/USB synchronisé)
================================================================ */
let sharedDirHandle = null; // poignée du dossier, valable pour la session

function openSharedFolder() {
  if (!isSyncSupported()) {
    return openModal({
      title: "🔄 " + t("sf_title"),
      bodyHtml: `<div class="empty-hint">${esc(t("sf_unsupported"))}</div>`,
      footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
    });
  }

  const m = openModal({
    title: "🔄 " + t("sf_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("sf_how"))}</p>
      <div class="form-row"><label>${esc(t("sf_coder"))}</label>
        <input type="text" id="sfCoder" value="${esc(getCoderName())}" placeholder="${esc(t("sf_coder_ph"))}"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <button class="btn" id="sfConnect">📁 ${esc(t("sf_connect"))}</button>
        <button class="btn primary" id="sfPublish" disabled>📤 ${esc(t("sf_publish"))}</button>
        <button class="btn" id="sfRefresh" disabled>🔍 ${esc(t("sf_refresh"))}</button>
      </div>
      <div id="sfStatus" style="font-size:12.5px;color:var(--text-soft);margin:6px 0">${
        sharedDirHandle ? "📁 " + esc(sharedDirHandle.name) : esc(t("sf_not_connected"))}</div>
      <div id="sfList"></div>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });

  const $$ = sel => m.body.querySelector(sel);
  const setButtons = () => {
    $$("#sfPublish").disabled = !sharedDirHandle;
    $$("#sfRefresh").disabled = !sharedDirHandle;
    if (sharedDirHandle) $$("#sfStatus").textContent = "📁 " + sharedDirHandle.name;
  };
  setButtons();

  const myFilename = () => publishFilename(state.project.name, $$("#sfCoder").value.trim() || "codeur");

  $$("#sfConnect").onclick = async () => {
    try {
      sharedDirHandle = await pickFolder();
      setButtons();
      await refresh();
    } catch { /* sélection annulée */ }
  };

  $$("#sfPublish").onclick = async () => {
    const coder = $$("#sfCoder").value.trim();
    if (!coder) { $$("#sfStatus").textContent = t("sf_need_coder"); return; }
    setCoderName(coder);
    persistNow();
    try {
      let content;
      if (state.project.protected) {
        const pw = projectPassword || await askPassword();
        if (!pw) return;
        projectPassword = pw;
        content = JSON.stringify(await encryptProjectJson(JSON.stringify(state.project), pw));
      } else {
        content = JSON.stringify(state.project);
      }
      await writeToFolder(sharedDirHandle, myFilename(), content);
      toast(t("sf_published") + " " + myFilename());
      await refresh();
    } catch (e) {
      $$("#sfStatus").textContent = "⚠️ " + t("sf_write_error") + " " + e.message;
    }
  };

  $$("#sfRefresh").onclick = refresh;

  async function refresh() {
    const mine = myFilename();
    let files;
    try { files = await listProjxFiles(sharedDirHandle); }
    catch (e) { $$("#sfStatus").textContent = "⚠️ " + e.message; return; }
    const others = files.filter(f => f.name !== mine);
    const mineThere = files.some(f => f.name === mine);
    $$("#sfStatus").textContent = "📁 " + sharedDirHandle.name +
      " — " + others.length + " " + t("sf_team_files") + (mineThere ? " · " + t("sf_mine_ok") : "");
    if (!others.length) {
      $$("#sfList").innerHTML = `<div class="empty-hint">${esc(t("sf_empty"))}</div>`;
      return;
    }
    $$("#sfList").innerHTML = others.map((f, i) => {
      const st = fileStatus(f.name, f.lastModified);
      const badge = st === "new" ? `<span class="weight-badge">🆕 ${esc(t("sf_new"))}</span>`
        : st === "updated" ? `<span class="weight-badge">🔁 ${esc(t("sf_updated"))}</span>`
        : `<span class="weight-badge">✅ ${esc(t("sf_uptodate"))}</span>`;
      return `<div class="seg-card">
        <div class="seg-card-head">
          <strong style="flex:1">${esc(f.name)}</strong>
          ${badge}
          <span style="color:var(--text-soft);font-size:11.5px">${new Date(f.lastModified).toLocaleString()}</span>
          <button class="btn" data-merge="${i}">🧬 ${esc(t("sf_merge"))}</button>
        </div>
      </div>`;
    }).join("");
    $$("#sfList").querySelectorAll("[data-merge]").forEach(btn => btn.onclick = async () => {
      const f = others[Number(btn.dataset.merge)];
      const incoming = await readProjectFile(f.file);
      if (!incoming) return;
      openMergeModal(incoming, {
        coderLabel: coderFromFilename(f.name) || "C2",
        onMerged: () => { markSeen(f.name, f.lastModified); refresh(); },
      });
    });
  }

  if (sharedDirHandle) refresh();
}

/* ================================================================
   Suggestions IA : l'IA propose, le chercheur valide (clé utilisateur)
================================================================ */
function openAiSuggest() {
  const doc = getDoc(state.ui.currentDocId);
  if (!doc) return toast(t("hint_no_doc"));
  const cfg = getAiConfig();

  const m = openModal({
    title: "🤖 " + t("ai_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("ai_how"))}</p>
      <div class="form-row"><label>${esc(t("ai_key"))}</label>
        <input type="password" id="aiKey" value="${esc(cfg.key || "")}" placeholder="sk-ant-…" autocomplete="off"></div>
      <p style="font-size:11.5px;color:var(--text-soft);margin:2px 0 8px">${esc(t("ai_key_hint"))}</p>
      <div class="form-row"><label>${esc(t("ai_model"))}</label>
        <select id="aiModel">${AI_MODELS.map(mo =>
          `<option value="${mo.id}" ${mo.id === cfg.model ? "selected" : ""}>${esc(mo.label)}</option>`).join("")}</select></div>
      <div class="form-row"><label>${esc(t("ai_doc"))}</label><strong>${esc(doc.name)}</strong></div>
      <label class="rcheck" style="display:block;margin:10px 0;color:var(--danger,#c0392b)">
        <input type="checkbox" id="aiConsent"> ${esc(t("ai_consent"))}</label>
      <div id="aiStatus" style="font-size:12.5px;color:var(--text-soft);margin:6px 0"></div>
      <div id="aiResults"></div>`,
    footer: [
      { label: t("close"), onClick: (o, c) => c() },
      { label: "🔎 " + t("ai_analyze"), primary: true, onClick: o => runAnalysis(o) },
    ],
  });

  async function runAnalysis(o) {
    const key = o.querySelector("#aiKey").value.trim();
    const model = o.querySelector("#aiModel").value;
    const status = o.querySelector("#aiStatus");
    if (!key) { status.textContent = t("ai_need_key"); return; }
    if (!o.querySelector("#aiConsent").checked) { status.textContent = t("ai_need_consent"); return; }
    saveAiConfig({ key, model }); // clé gardée sur CET ordinateur uniquement

    const paragraphs = docParagraphs(doc.text);
    const codes = flatCodes().map(c => ({ name: c.name, definition: getMemo("code", c.id)?.text || "" }));
    status.textContent = "⏳ " + t("ai_running");
    o.querySelector("#aiResults").innerHTML = "";
    try {
      const sugs = await suggestCodes({ apiKey: key, model, docName: doc.name, paragraphs, codes });
      renderSuggestions(o, sugs);
      status.textContent = sugs.length ? "" : t("ai_none");
    } catch (e) {
      status.textContent = "⚠️ " + (e.message === "cle-invalide" ? t("ai_bad_key")
        : e.message === "quota" ? t("ai_quota")
        : e.message === "reponse-illisible" ? t("ai_bad_answer")
        : t("ai_error") + " " + e.message);
    }
  }

  function renderSuggestions(o, sugs) {
    const existing = new Set(flatCodes().map(c => c.name.toLowerCase()));
    o.querySelector("#aiResults").innerHTML = `
      <p style="font-weight:600;margin:10px 0 6px">${sugs.length} ${esc(t("ai_suggestions"))}</p>
      ${sugs.map((s, i) => `
        <div class="seg-card">
          <div class="seg-card-head">
            <label class="rcheck" style="flex:1;display:flex;gap:8px;align-items:center">
              <input type="checkbox" class="ai-pick" data-i="${i}" checked>
              <span class="badge" style="background:var(--bg-hover)">${esc(s.code)}</span>
              ${s.isNew && !existing.has(s.code.toLowerCase()) ? `<span class="weight-badge">✨ ${esc(t("ai_new_code"))}</span>` : ""}
            </label>
          </div>
          <div class="seg-card-body">« ${esc(s.excerpt)} »</div>
          ${s.why ? `<div class="seg-comment">💡 ${esc(s.why)}</div>` : ""}
        </div>`).join("")}
      <button class="btn primary" id="aiApply" style="margin-top:10px">✅ ${esc(t("ai_apply"))}</button>`;
    o.querySelector("#aiApply").onclick = () => {
      const picked = [...o.querySelectorAll(".ai-pick:checked")].map(cb => sugs[Number(cb.dataset.i)]);
      if (!picked.length) return;
      let created = 0, coded = 0;
      for (const s of picked) {
        let code = flatCodes().find(c => c.name.toLowerCase() === s.code.toLowerCase());
        if (!code) { code = addCode(s.code); created++; }
        addSegment(doc.id, code.id, s.start, s.end, doc.text.slice(s.start, s.end));
        coded++;
      }
      renderAll();
      toast(t("ai_applied").replace("{n}", coded).replace("{c}", created));
      o.querySelector("#aiResults").innerHTML = "";
      o.querySelector("#aiStatus").textContent = "✅ " + t("ai_applied").replace("{n}", coded).replace("{c}", created);
    };
  }
}

/* ================================================================
   Collaboration en temps réel (serveur de synchronisation fourni)
================================================================ */
function myContribution() {
  // Mes segments = ceux qui ne portent pas d'étiquette de codeur
  return {
    projectName: state.project.name,
    codes: flatCodes().map(c => ({ id: c.id, name: c.name, color: c.color })),
    segments: state.project.segments.filter(s => !s.coder),
    docNames: state.project.documents.map(d => ({ id: d.id, name: d.name })),
  };
}

function applyRemoteUpdate(msg) {
  const label = msg.coder;
  // Codes : appariés par nom (insensible à la casse), créés s'ils manquent
  const byName = new Map(flatCodes().map(c => [c.name.toLowerCase(), c]));
  const codeMap = new Map();
  for (const rc of msg.codes || []) {
    const mine = byName.get(String(rc.name).toLowerCase());
    if (mine) { codeMap.set(rc.id, mine.id); continue; }
    const created = { id: uid(), name: rc.name, parentId: null, color: rc.color || "#888", created: new Date().toISOString() };
    state.project.codes.push(created);
    byName.set(created.name.toLowerCase(), created);
    codeMap.set(rc.id, created.id);
  }
  // Documents appariés par nom ; la contribution précédente du codeur est remplacée
  const docByName = new Map(state.project.documents.map(d => [d.name, d.id]));
  const remoteDocName = new Map((msg.docNames || []).map(d => [d.id, d.name]));
  state.project.segments = state.project.segments.filter(s => s.coder !== label);
  let added = 0;
  for (const rs of msg.segments || []) {
    const docId = docByName.get(remoteDocName.get(rs.docId));
    const codeId = codeMap.get(rs.codeId);
    if (!docId || !codeId) continue;
    state.project.segments.push({ ...rs, id: uid(), docId, codeId, coder: label });
    added++;
  }
  scheduleSave();
  renderAll();
  toast("🔄 " + label + " : " + added + " " + t("segments_lbl"));
}

function renderRtStatus() {
  const st = rtStatus();
  const el = $("#rtStatus");
  if (!el) return;
  el.textContent = st.connected
    ? "🟢 " + t("rt_live") + (st.peers.length ? " · " + st.peers.join(", ") : "")
    : "";
}

function openRealtime() {
  const st = rtStatus();
  const m = openModal({
    title: "🌐 " + t("rt_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("rt_how"))}</p>
      <div class="form-row"><label>${esc(t("rt_url"))}</label>
        <input type="text" id="rtUrl" value="${esc(st.url || "ws://localhost:8765")}" placeholder="ws://serveur:8765"></div>
      <div class="form-row"><label>${esc(t("rt_room"))}</label>
        <input type="text" id="rtRoom" value="${esc(st.room || state.project.name)}"></div>
      <div class="form-row"><label>${esc(t("sf_coder"))}</label>
        <input type="text" id="rtCoder" value="${esc(st.coder || getCoderName())}"></div>
      <div id="rtInfo" style="font-size:12.5px;margin:8px 0;color:var(--text-soft)">${
        st.connected ? "🟢 " + esc(t("rt_connected")) + " — " + esc(st.peers.join(", ") || t("rt_alone")) : "⚪ " + esc(t("rt_offline"))}</div>
      <p style="font-size:11.5px;color:var(--text-soft)">${esc(t("rt_server_hint"))}</p>`,
    footer: [
      { label: t("close"), onClick: (o, c) => c() },
      { label: "🔌 " + t("rt_disconnect"), onClick: (o, c) => { rtDisconnect(); renderRtStatus(); c(); } },
      {
        label: "🟢 " + t("rt_connect"), primary: true, onClick: (o, close) => {
          const coder = o.querySelector("#rtCoder").value.trim();
          if (!coder) return;
          setCoderName(coder);
          rtConnect({ url: o.querySelector("#rtUrl").value.trim(), room: o.querySelector("#rtRoom").value.trim() || "qualicode", coder });
          close();
        }
      },
    ],
  });
}

/* ================================================================
   Statistiques avancées (χ², V de Cramér, corrélations, pont R/SPSS)
================================================================ */
function openAdvStats() {
  const codes = flatCodes();
  const vars = state.project.variables;
  const m = openModal({
    title: "📐 " + t("adv_title"), wide: true,
    bodyHtml: `
      <p class="trans-hint">${esc(t("adv_hint"))}</p>
      <h4 style="margin:10px 0 6px">${esc(t("adv_cross"))}</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="asCode">${codes.map(c => `<option value="${c.id}">${"— ".repeat(c.depth)}${esc(c.name)}</option>`).join("")}</select>
        <select id="asVar">${vars.map(v => `<option>${esc(v)}</option>`).join("")}</select>
        <button class="btn primary" id="asRun">χ² ${esc(t("adv_run"))}</button>
      </div>
      <div id="asResult" style="margin:10px 0"></div>
      <h4 style="margin:14px 0 6px">${esc(t("adv_corr"))}</h4>
      <button class="btn" id="asCorr">🔢 ${esc(t("adv_corr_run"))}</button>
      <div id="asCorrOut" style="margin:10px 0;overflow:auto"></div>
      <h4 style="margin:14px 0 6px">${esc(t("adv_bridge"))}</h4>
      <p style="font-size:12px;color:var(--text-soft)">${esc(t("adv_bridge_hint"))}</p>
      <button class="btn" id="asCsv">⬇ qualicode_matrice.csv</button>
      <button class="btn" id="asR">⬇ script_analyse.R</button>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  const body = m.body;

  body.querySelector("#asRun").onclick = () => {
    const codeId = body.querySelector("#asCode").value;
    const variable = body.querySelector("#asVar").value;
    const out = body.querySelector("#asResult");
    if (!variable) { out.innerHTML = `<div class="empty-hint">${esc(t("adv_need_var"))}</div>`; return; }
    const ids = codeWithDescendantsLocal(codeId);
    const data = codeByVariableTable(state.project, ids, variable);
    if (!data) { out.innerHTML = `<div class="empty-hint">${esc(t("adv_need_cats"))}</div>`; return; }
    const test = chiSquareTest(data.table);
    if (!test) { out.innerHTML = `<div class="empty-hint">${esc(t("adv_need_cats"))}</div>`; return; }
    const codeName = getCode(codeId)?.name ?? "?";
    const sig = test.p < 0.05;
    out.innerHTML = `
      <table class="data-table"><thead><tr><th></th>${data.cats.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td><strong>${esc(t("adv_with"))} « ${esc(codeName)} »</strong></td>${data.table[0].map(v => `<td>${v}</td>`).join("")}</tr>
        <tr><td><strong>${esc(t("adv_without"))}</strong></td>${data.table[1].map(v => `<td>${v}</td>`).join("")}</tr>
      </tbody></table>
      <p style="margin:8px 0"><strong>χ²(${test.df}) = ${test.chi2.toFixed(2)}</strong> ·
        p = ${test.p < 0.001 ? "&lt; 0,001" : test.p.toFixed(3)} ·
        V de Cramér = ${test.v.toFixed(2)} · n = ${test.n}</p>
      <p style="font-weight:600;color:${sig ? "var(--accent)" : "var(--text-soft)"}">
        ${esc(sig ? t("adv_sig") : t("adv_nonsig"))}</p>
      ${test.lowExpectedShare > 0.2 ? `<p style="font-size:12px;color:#c0392b">⚠️ ${esc(t("adv_low_n"))}</p>` : ""}`;
  };

  body.querySelector("#asCorr").onclick = () => {
    const { codes: cs, rows } = docCodeMatrix(state.project, codes);
    // Les 10 codes les plus fréquents, pour une matrice lisible
    const totals = cs.map(c => ({ c, total: rows.reduce((a, r) => a + r.counts[c.id], 0) }))
      .filter(x => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
    if (totals.length < 2 || rows.length < 3) {
      body.querySelector("#asCorrOut").innerHTML = `<div class="empty-hint">${esc(t("adv_need_data"))}</div>`;
      return;
    }
    const series = totals.map(x => rows.map(r => r.counts[x.c.id]));
    let html = `<table class="data-table"><thead><tr><th></th>${totals.map(x => `<th title="${esc(x.c.name)}">${esc(x.c.name.slice(0, 12))}</th>`).join("")}</tr></thead><tbody>`;
    for (let i = 0; i < totals.length; i++) {
      html += `<tr><td><strong>${esc(totals[i].c.name.slice(0, 18))}</strong></td>`;
      for (let j = 0; j < totals.length; j++) {
        if (j === i) { html += `<td>—</td>`; continue; }
        const res = spearman(series[i], series[j]);
        if (!res) { html += `<td></td>`; continue; }
        const shade = Math.min(0.85, Math.abs(res.r));
        const color = res.r >= 0 ? `rgba(78,121,167,${shade})` : `rgba(225,87,89,${shade})`;
        html += `<td class="heat" style="background:${color}" title="ρ=${res.r.toFixed(2)} p=${res.p.toFixed(3)}">${res.r.toFixed(2)}</td>`;
      }
      html += `</tr>`;
    }
    body.querySelector("#asCorrOut").innerHTML = html + `</tbody></table>
      <p style="font-size:11.5px;color:var(--text-soft)">${esc(t("adv_corr_note"))}</p>`;
  };

  const doExport = which => {
    const { csv, script } = buildRExport(state.project, codes);
    if (which === "csv") downloadBlob("qualicode_matrice.csv", new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    else downloadBlob("script_analyse.R", new Blob([script], { type: "text/plain;charset=utf-8" }));
    toast(t("export_done"));
  };
  body.querySelector("#asCsv").onclick = () => doExport("csv");
  body.querySelector("#asR").onclick = () => doExport("r");
}

// Un code + ses descendants (aide locale pour le croisement)
function codeWithDescendantsLocal(codeId) {
  const out = [codeId];
  const walk = id => { for (const c of state.project.codes) if (c.parentId === id) { out.push(c.id); walk(c.id); } };
  walk(codeId);
  return out;
}

/* ================================================================
   Palette de commandes (Ctrl+K) et aide clavier (F1)
================================================================ */
function openPalette() {
  if (document.getElementById("qcPalette")) return;
  const actions = [];
  document.querySelectorAll(".ribbon-pane").forEach(pane => {
    pane.querySelectorAll(".rbtn").forEach(btn => {
      const label = btn.textContent.trim();
      if (label) actions.push({ label, run: () => btn.click() });
    });
  });
  document.querySelectorAll("#ribbonTabs button").forEach(tab => {
    actions.push({ label: "→ " + t("palette_goto") + " " + tab.textContent.trim(), run: () => tab.click() });
  });

  const ov = document.createElement("div");
  ov.id = "qcPalette";
  ov.className = "palette-overlay";
  ov.innerHTML = `<div class="palette">
    <input type="text" id="palInput" placeholder="${esc(t("palette_ph"))}" autocomplete="off">
    <div class="palette-list" id="palList"></div>
  </div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector("#palInput");
  const list = ov.querySelector("#palList");
  let selected = 0, shown = [];

  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = actions.filter(a => a.label.toLowerCase().includes(q)).slice(0, 12);
    selected = Math.min(selected, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((a, i) =>
      `<div class="palette-item ${i === selected ? "sel" : ""}" data-i="${i}">${esc(a.label)}</div>`).join("")
      || `<div class="palette-item">${esc(t("palette_none"))}</div>`;
    list.querySelectorAll("[data-i]").forEach(el => {
      el.onmouseenter = () => { selected = Number(el.dataset.i); render(); };
      el.onmousedown = e => { e.preventDefault(); pick(Number(el.dataset.i)); };
    });
  };
  const close = () => ov.remove();
  const pick = i => { const a = shown[i]; close(); if (a) a.run(); };

  input.addEventListener("input", () => { selected = 0; render(); });
  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(selected + 1, shown.length - 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(selected); }
  });
  ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
  render();
  input.focus();
}

function openShortcutsHelp() {
  const rows = [
    ["Ctrl+K", t("hk_palette")], ["Ctrl+S", t("hk_save")], ["Ctrl+F", t("hk_search")],
    ["Ctrl+Z / Ctrl+Y", t("hk_undo")], ["Alt+C", t("hk_code")], ["F1", t("hk_help")],
    ["Ctrl+Espace", t("hk_playpause")], ["Ctrl+B", t("hk_back5")], ["Ctrl+T", t("hk_ts")],
  ];
  openModal({
    title: "⌨️ " + t("hk_title"),
    bodyHtml: `<table class="data-table"><tbody>${rows.map(([k, d]) =>
      `<tr><td style="white-space:nowrap"><kbd>${esc(k)}</kbd></td><td>${esc(d)}</td></tr>`).join("")}</tbody></table>`,
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
}

/* ================================================================
   Requêtes sauvegardées : combinaisons de filtres réutilisables
================================================================ */
function openSavedQueries() {
  const render = body => {
    const queries = state.project.savedQueries;
    const listHtml = queries.length
      ? queries.map(q => {
          const date = new Date(q.created).toLocaleDateString();
          const modeLbl = q.retrievalMode === "and" ? "ET" : "OU";
          return `<div class="seg-card" data-id="${esc(q.id)}">
            <div class="seg-card-head">
              <strong style="flex:1">${esc(q.name)}</strong>
              <span style="color:var(--text-soft);font-size:12px">${q.activatedDocs.length} docs · ${q.activatedCodes.length} codes · ${modeLbl} · ${date}</span>
              <button class="btn" data-act="load">${esc(t("load_query"))}</button>
              <button class="mini-btn" data-act="delq" title="${esc(t("delete"))}">🗑️</button>
            </div>
          </div>`;
        }).join("")
      : `<div class="empty-hint">${esc(t("no_queries"))}</div>`;
    body.innerHTML = `
      <button class="btn primary" id="btnSaveCurrentQuery" style="margin-bottom:12px">💾 ${esc(t("save_query"))}</button>
      ${listHtml}`;
    body.querySelector("#btnSaveCurrentQuery").onclick = () => {
      promptModal(t("save_query"), t("query_name_q"), "", name => {
        saveQuery(name, state.ui.activatedDocs, state.ui.activatedCodes, state.ui.retrievalMode);
        toast(t("query_saved"));
        render(body);
      });
    };
    body.querySelectorAll("[data-act=load]").forEach(b => b.onclick = () => {
      const q = state.project.savedQueries.find(x => x.id === b.closest(".seg-card").dataset.id);
      if (!q) return;
      // N'active que les documents/codes qui existent encore
      const docIds = new Set(state.project.documents.map(d => d.id));
      const codeIds = new Set(state.project.codes.map(c => c.id));
      state.ui.activatedDocs = new Set(q.activatedDocs.filter(id => docIds.has(id)));
      state.ui.activatedCodes = new Set(q.activatedCodes.filter(id => codeIds.has(id)));
      state.ui.retrievalMode = q.retrievalMode;
      $("#retrievalMode").value = q.retrievalMode;
      renderAll();
      toast(t("query_loaded") + " : " + q.name);
    });
    body.querySelectorAll("[data-act=delq]").forEach(b => b.onclick = () => {
      deleteQuery(b.closest(".seg-card").dataset.id);
      toast(t("query_deleted"));
      render(body);
    });
  };
  const m = openModal({
    title: t("saved_queries_title"), wide: true, bodyHtml: "",
    footer: [{ label: t("close"), primary: true, onClick: (o, c) => c() }],
  });
  render(m.body);
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
   Installation de l'application (téléphone et ordinateur)
================================================================ */
async function openInstallModal() {
  if (isInstalled()) { toast("📲 " + t("m_install_already")); return; }
  const d = await installDiagnostic();
  const line = (ok, label) =>
    `<li class="diag-line ${ok ? "ok" : "ko"}">${ok ? "✅" : "❌"} ${esc(label)}</li>`;

  const rows = [`<p>${esc(t("m_install_hint"))}</p>`];

  // 1. Ce qui bloque, dit franchement et en premier
  if (d.context === "file") rows.push(`<p class="diag-block">${esc(t("m_blocked_file"))}</p>`);
  else if (d.context === "insecure") rows.push(`<p class="diag-block">${esc(t("m_blocked_insecure"))}</p>`);

  // 2. La liste des conditions, cochées ou non
  rows.push(`<h3>${esc(t("m_diag_title"))}</h3><ul class="diag-list">
    ${line(d.context === "web", t("m_diag_web"))}
    ${line(d.hasManifest, t("m_diag_manifest"))}
    ${line(d.swReady, t("m_diag_sw"))}
    ${line(d.chromiumLike || d.iosSafari, t("m_diag_browser"))}
  </ul>`);

  // 3. La marche à suivre, adaptée à l'appareil réellement utilisé
  if (d.context !== "web") {
    rows.push(`<p><b>${esc(t("m_fix_open_site"))}</b></p>
      <p class="site-url"><a href="${esc(d.siteUrl)}" target="_blank" rel="noopener">${esc(d.siteUrl)}</a></p>
      <p class="hint">${esc(t("m_site_down"))}</p>`);
    if (d.platform === "desktop") rows.push(`<p class="hint">${esc(t("m_fix_desktop_scripts"))}</p>`);
  } else {
    const steps = d.platform === "android" ? "m_steps_android"
      : d.platform === "ios" ? "m_steps_ios" : "m_steps_desktop";
    rows.push(`<p class="hint">${esc(t(steps))}</p>`);
    if (!d.nativePrompt && d.chromiumLike) rows.push(`<p class="hint">${esc(t("m_no_native_hint"))}</p>`);
    if (!d.chromiumLike && !d.iosSafari) rows.push(`<p class="hint">${esc(t("m_install_firefox"))}</p>`);
    // Ordinateur sans invite d'installation : le raccourci de bureau reste possible
    if (!d.nativePrompt && d.platform === "desktop") {
      rows.push(`<p class="hint">${esc(t("m_fix_desktop_scripts"))}</p>`);
    }
  }

  return openModal({
    title: "📲 " + t("m_install"),
    bodyHtml: rows.join(""),
    footer: [
      { label: t("close"), onClick: (o, close) => close() },
      ...(d.context !== "web" ? [{
        label: "📋 " + t("m_copy_addr"),
        onClick: async () => {
          try { await navigator.clipboard.writeText(d.siteUrl); toast("📋 " + t("m_addr_copied")); }
          catch { prompt(t("m_fix_open_site"), d.siteUrl); }
        },
      }] : []),
      ...(d.nativePrompt ? [{
        label: t("m_install_yes"), primary: true,
        onClick: async (o, close) => {
          close();
          const r = await promptInstall();
          if (r === "accepted") toast("✅ " + t("m_install_done"));
        },
      }] : []),
    ],
  });
}

/** Ouvre un projet reçu du système (double-clic sur un .projx / .qdpx). */
async function openProjectFromFile(file) {
  if (/\.qdpx$/i.test(file.name)) {
    try {
      const { project, stats } = await importRefiQdpx(await file.arrayBuffer());
      switchToProject(normalizeProject(project));
      toast(t("refi_imported")
        .replace("{d}", stats.documents).replace("{c}", stats.codes).replace("{s}", stats.segments));
    } catch { toast(t("refi_import_fail")); }
    return;
  }
  const p = await readProjectFile(file);
  if (!p) return;
  switchToProject(p);
  toast("📂 " + t("m_open_projx") + " « " + file.name + " »");
}

/** Raccourcis du manifeste : index.html?action=projects|new|manual */
function handleLaunchAction() {
  const action = new URLSearchParams(location.search).get("action");
  if (!action) return;
  history.replaceState(null, "", location.pathname); // n'agit qu'au lancement
  if (action === "projects") openMyProjects();
  else if (action === "new") $("#btnNewProject")?.click();
  else if (action === "manual") { downloadManuelPdf(); toast("🎓 " + t("doc_downloaded")); }
}

/* ================================================================
   Verrou d'application et licence
================================================================ */
function openApplockModal() {
  const locked = hasAppLock();
  const m = openModal({
    title: "🔐 " + t("applock_title"),
    bodyHtml: `
      <p class="hint">${esc(t("applock_hint"))}</p>
      ${locked ? `<div class="form-row"><label>${esc(t("applock_current"))}</label><input type="password" id="alCur"></div>` : ""}
      <div class="form-row"><label>${esc(t("applock_new"))}</label><input type="password" id="alNew"></div>
      <div class="form-row"><label>${esc(t("applock_confirm"))}</label><input type="password" id="alNew2"></div>
      <p class="lock-msg" id="alMsg" hidden></p>`,
    footer: [
      ...(locked ? [{
        label: t("applock_remove"), danger: true,
        onClick: async (o, close) => {
          if (!(await verifyAppLock(o.querySelector("#alCur").value))) return showAlMsg(o, t("applock_badpw"));
          removeAppLock();
          $("#btnLockNow").hidden = true;
          close(); toast(t("applock_removed"));
        },
      }] : []),
      { label: t("cancel"), onClick: (o, close) => close() },
      {
        label: locked ? t("applock_change") : t("applock_set"), primary: true,
        onClick: async (o, close) => {
          if (locked && !(await verifyAppLock(o.querySelector("#alCur").value))) return showAlMsg(o, t("applock_badpw"));
          const p1 = o.querySelector("#alNew").value, p2 = o.querySelector("#alNew2").value;
          if (p1.length < 4) return showAlMsg(o, t("applock_short"));
          if (p1 !== p2) return showAlMsg(o, t("applock_mismatch"));
          await setAppLock(p1);
          $("#btnLockNow").hidden = false;
          close(); toast("🔐 " + t("applock_set_ok"));
        },
      },
    ],
  });
  function showAlMsg(o, text) {
    const el = o.querySelector("#alMsg");
    el.textContent = text; el.hidden = false;
  }
  return m;
}

async function openLicenseModal() {
  const st = await licenseStatus();
  let stateLine;
  if (st.state === "active") {
    stateLine = `✅ <b>${esc(t("lic_state_active"))}</b> — ${esc(t(PLAN_LABELS[st.plan]))}` +
      (st.plan === "life" ? "" : ` · ${esc(t("lic_expires"))} ${esc(st.exp)}`) +
      (st.licensee ? ` · ${esc(t("lic_licensee"))} : ${esc(st.licensee)}` : "");
  } else if (st.state === "trial") {
    stateLine = `⏳ <b>${esc(t("lic_state_trial").replace("{n}", st.daysLeft))}</b>`;
  } else {
    stateLine = `⛔ <b>${esc(t("lic_state_expired"))}</b>`;
  }
  openModal({
    title: "💳 " + t("lic_title"), wide: true,
    bodyHtml: `
      <p class="lic-state">${stateLine}</p>
      <div class="form-row"><label>${esc(t("lic_key_label"))}</label>
        <input type="text" id="licKey" placeholder="QC1-…" spellcheck="false"></div>
      <p class="lock-msg" id="licMsg" hidden></p>
      <hr>
      <h3>${esc(t("lic_buy_title"))}</h3>
      ${buildPaymentsHtml()}`,
    footer: [
      { label: t("close"), onClick: (o, close) => close() },
      {
        label: t("lic_activate"), primary: true,
        onClick: async (o, close) => {
          const r = await activateKey(o.querySelector("#licKey").value);
          const msg = o.querySelector("#licMsg");
          if (r.ok) { close(); toast("✅ " + t("lic_activated")); renderStatus(); }
          else { msg.textContent = t(r.reason === "expired" ? "lic_key_expired" : "lic_invalid"); msg.hidden = false; }
        },
      },
    ],
  });
}

/* ================================================================
   Barre d'état
================================================================ */
function renderStatus() {
  $("#statusDocs").textContent = `📄 ${state.project.documents.length} ${t("docs")}`;
  $("#statusCodes").textContent = `🏷️ ${state.project.codes.length} ${t("codes_lbl")}`;
  $("#statusSegments").textContent = `✂️ ${state.project.segments.length} ${t("segments_lbl")}`;
  licenseStatus().then(st => { $("#licStatus").textContent = licenseBadge(st); });
}

init();
