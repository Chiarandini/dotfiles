var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/organize-loose-files.tsx
var organize_loose_files_exports = {};
__export(organize_loose_files_exports, {
  default: () => OrganizeLooseFiles
});
module.exports = __toCommonJS(organize_loose_files_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_api = require("@raycast/api");
var import_react = require("react");
var IGNORED_FOLDER_NAMES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".DS_Store",
  "My Kindle Content",
  "newBooks"
]);
function expandTilde(filePath) {
  if (filePath.startsWith("~/")) {
    return import_path.default.join(process.env.HOME ?? "", filePath.slice(2));
  }
  return filePath;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function parseExtensions(raw) {
  const list = (raw ?? "pdf,epub,djvu,mobi,azw3").split(",").map((s) => s.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
  return new Set(list);
}
function parseLibraryPaths(raw) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const resolved = import_path.default.resolve(expandTilde(trimmed));
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}
function findLooseFiles(root, extensions) {
  let entries;
  try {
    entries = import_fs.default.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    const ext = import_path.default.extname(entry.name).slice(1).toLowerCase();
    if (!extensions.has(ext)) continue;
    const full = import_path.default.join(root, entry.name);
    try {
      const stat = import_fs.default.statSync(full);
      out.push({
        name: entry.name,
        fullPath: full,
        sizeBytes: stat.size,
        scanRoot: root
      });
    } catch {
    }
  }
  return out;
}
function findAllSubfolders(root) {
  const out = [];
  const walk = (current, rel) => {
    let entries;
    try {
      entries = import_fs.default.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      if (IGNORED_FOLDER_NAMES.has(entry.name)) continue;
      const childRel = rel ? import_path.default.join(rel, entry.name) : entry.name;
      out.push(childRel);
      walk(import_path.default.join(current, entry.name), childRel);
    }
  };
  walk(root, "");
  return out;
}
var MAX_RETRIES_ON_429 = 7;
var INITIAL_BACKOFF_MS = 3e3;
var BATCH_SIZE = 40;
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
function isRateLimitError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(msg) || /rate limit/i.test(msg);
}
function buildBatchPrompt(filenames, folders) {
  const folderList = folders.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const fileList = filenames.map((n, i) => `${i + 1}. ${n}`).join("\n");
  return [
    "You are organizing a personal book library. For each file below, pick the single most appropriate existing folder from the folder list.",
    "",
    "Available folders:",
    folderList,
    "",
    "Files to classify:",
    fileList,
    "",
    "Output a JSON array with one object per file in the same order, with fields `index` (1-based) and `folder` (exact path from the folder list, or `ROOT` if no folder fits). Prefer the most specific subfolder (e.g. `Mathematics/Langlands Program` over `Mathematics`).",
    "",
    "Output ONLY the JSON array, no prose, no markdown fences.",
    "",
    "Example output for 2 files:",
    `[{"index":1,"folder":"Mathematics/Analysis"},{"index":2,"folder":"ROOT"}]`
  ].join("\n");
}
function stripMarkdownFences(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
function normalizeFolder(raw, folders) {
  const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[.,;]+$/, "");
  if (cleaned.toUpperCase() === "ROOT") return "";
  if (folders.includes(cleaned)) return cleaned;
  const lowered = cleaned.toLowerCase();
  const match = folders.find((f) => f.toLowerCase() === lowered);
  if (match) return match;
  return null;
}
var AI_CALL_TIMEOUT_MS = 6e4;
async function askWithTimeout(prompt, model, outerSignal, timeoutMs, label) {
  const inner = new AbortController();
  const onOuterAbort = () => inner.abort(new DOMException("Outer aborted", "AbortError"));
  if (outerSignal.aborted) inner.abort();
  else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  const timeoutId = setTimeout(() => {
    inner.abort(
      new DOMException(
        `AI call timed out after ${timeoutMs}ms`,
        "TimeoutError"
      )
    );
  }, timeoutMs);
  const startedAt = Date.now();
  console.log(
    `[organize] ${label}: starting AI.ask (model=${model}, promptBytes=${prompt.length})`
  );
  try {
    const result = await import_api.AI.ask(prompt, {
      model,
      creativity: "low",
      signal: inner.signal
    });
    const elapsed = Date.now() - startedAt;
    console.log(
      `[organize] ${label}: AI.ask resolved in ${elapsed}ms (responseBytes=${result.length})`
    );
    return result;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      `[organize] ${label}: AI.ask failed after ${elapsed}ms: ${msg}`
    );
    throw err;
  } finally {
    clearTimeout(timeoutId);
    outerSignal.removeEventListener("abort", onOuterAbort);
  }
}
async function classifyBatch(filenames, folders, signal, label) {
  const prompt = buildBatchPrompt(filenames, folders);
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
    try {
      const response = await askWithTimeout(
        prompt,
        import_api.AI.Model["Anthropic_Claude_4.5_Haiku"],
        signal,
        AI_CALL_TIMEOUT_MS,
        `${label} attempt=${attempt}`
      );
      const text = stripMarkdownFences(response);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
        else throw e;
      }
      if (!Array.isArray(parsed))
        throw new Error("AI did not return a JSON array");
      const out = /* @__PURE__ */ new Map();
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const idx = Number(entry.index);
        const folderRaw = String(entry.folder ?? "");
        if (!Number.isInteger(idx) || idx < 1 || idx > filenames.length)
          continue;
        const filename = filenames[idx - 1];
        const normalized = normalizeFolder(folderRaw, folders);
        if (normalized !== null) out.set(filename, normalized);
      }
      console.log(
        `[organize] ${label}: classified ${out.size}/${filenames.length} files`
      );
      return out;
    } catch (err) {
      lastErr = err;
      if (signal.aborted) throw err;
      if (!isRateLimitError(err) || attempt === MAX_RETRIES_ON_429) throw err;
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`[organize] ${label}: 429 backoff ${Math.round(delay)}ms`);
      await sleep(delay, signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
function chunk(arr, size) {
  if (size <= 0) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function uniqueDestination(targetDir, filename) {
  let dest = import_path.default.join(targetDir, filename);
  if (!import_fs.default.existsSync(dest)) return dest;
  const ext = import_path.default.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  for (let i = 2; i < 1e3; i++) {
    const candidate = import_path.default.join(targetDir, `${base} (${i})${ext}`);
    if (!import_fs.default.existsSync(candidate)) return candidate;
  }
  throw new Error("Could not find unique filename after 1000 attempts");
}
function resolveDestination(classification, miscFolderName) {
  if (classification.status !== "ready") return null;
  if (classification.destination !== "") {
    return { relPath: classification.destination, isMiscFallback: false };
  }
  if (!miscFolderName) return null;
  return { relPath: miscFolderName, isMiscFallback: true };
}
function performMove(file, destRel, createTargetDir) {
  const targetDir = import_path.default.join(file.scanRoot, destRel);
  if (!import_fs.default.existsSync(targetDir)) {
    if (!createTargetDir)
      throw new Error(`Target folder does not exist: ${destRel}`);
    import_fs.default.mkdirSync(targetDir, { recursive: true });
  }
  const dest = uniqueDestination(targetDir, file.name);
  import_fs.default.renameSync(file.fullPath, dest);
  return dest;
}
function OrganizeLooseFiles() {
  const prefs = (0, import_api.getPreferenceValues)();
  const scanRoots = (0, import_react.useMemo)(
    () => parseLibraryPaths(prefs.libraryPaths),
    [prefs.libraryPaths]
  );
  const extensions = (0, import_react.useMemo)(
    () => parseExtensions(prefs.extensions),
    [prefs.extensions]
  );
  const miscFolderName = (prefs.miscFolderName ?? "Misc").trim();
  const [files, setFiles] = (0, import_react.useState)([]);
  const [classifications, setClassifications] = (0, import_react.useState)(/* @__PURE__ */ new Map());
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const [refreshCounter, setRefreshCounter] = (0, import_react.useState)(0);
  const abortRef = (0, import_react.useRef)(null);
  const refresh = (0, import_react.useCallback)(() => setRefreshCounter((n) => n + 1), []);
  const removeFiles = (0, import_react.useCallback)((paths) => {
    const toRemove = new Set(paths);
    setFiles((prev) => prev.filter((f) => !toRemove.has(f.fullPath)));
    setClassifications((prev) => {
      const next = new Map(prev);
      for (const p of toRemove) next.delete(p);
      return next;
    });
  }, []);
  (0, import_react.useEffect)(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const missing = scanRoots.filter((r) => !import_fs.default.existsSync(r));
    if (missing.length > 0) {
      (0, import_api.showToast)({
        style: import_api.Toast.Style.Failure,
        title: "Directory not found",
        message: missing.join(", ")
      });
    }
    const existingRoots = scanRoots.filter((r) => import_fs.default.existsSync(r));
    const allLoose = [];
    const foldersByRoot = /* @__PURE__ */ new Map();
    for (const root of existingRoots) {
      const loose = findLooseFiles(root, extensions);
      allLoose.push(...loose);
      foldersByRoot.set(root, findAllSubfolders(root));
    }
    setFiles(allLoose);
    setClassifications(
      new Map(
        allLoose.map((f) => [f.fullPath, { status: "pending" }])
      )
    );
    setIsLoading(false);
    if (allLoose.length === 0) return;
    const filesByRootForClassify = /* @__PURE__ */ new Map();
    for (const file of allLoose) {
      if (!filesByRootForClassify.has(file.scanRoot)) {
        filesByRootForClassify.set(file.scanRoot, []);
      }
      filesByRootForClassify.get(file.scanRoot).push(file);
    }
    (async () => {
      for (const [root, rootFiles] of filesByRootForClassify) {
        const folders = foldersByRoot.get(root) ?? [];
        if (folders.length === 0) {
          setClassifications((prev) => {
            const next = new Map(prev);
            for (const f of rootFiles) {
              next.set(f.fullPath, { status: "ready", destination: "" });
            }
            return next;
          });
          continue;
        }
        const batches = chunk(rootFiles, BATCH_SIZE);
        console.log(
          `[organize] root=${root} files=${rootFiles.length} folders=${folders.length} batches=${batches.length}`
        );
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          if (controller.signal.aborted) return;
          const filenames = batch.map((f) => f.name);
          const label = `${import_path.default.basename(root)}[batch ${batchIdx + 1}/${batches.length}]`;
          try {
            const resultMap = await classifyBatch(
              filenames,
              folders,
              controller.signal,
              label
            );
            if (controller.signal.aborted) return;
            setClassifications((prev) => {
              const next = new Map(prev);
              for (const file of batch) {
                if (resultMap.has(file.name)) {
                  next.set(file.fullPath, {
                    status: "ready",
                    destination: resultMap.get(file.name)
                  });
                } else {
                  next.set(file.fullPath, {
                    status: "error",
                    message: "AI omitted this file from its response"
                  });
                }
              }
              return next;
            });
          } catch (err) {
            if (controller.signal.aborted) return;
            const message = err instanceof Error ? err.message : String(err);
            setClassifications((prev) => {
              const next = new Map(prev);
              for (const file of batch) {
                next.set(file.fullPath, { status: "error", message });
              }
              return next;
            });
          }
        }
      }
    })();
    return () => controller.abort();
  }, [scanRoots, extensions, refreshCounter]);
  const moveOne = (0, import_react.useCallback)(
    async (file, destRel, isMiscFallback) => {
      try {
        performMove(file, destRel, isMiscFallback);
        await (0, import_api.showToast)({
          style: import_api.Toast.Style.Success,
          title: isMiscFallback ? "Moved to Misc" : "Moved",
          message: `${file.name} \u2192 ${destRel}`
        });
        removeFiles([file.fullPath]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await (0, import_api.showToast)({
          style: import_api.Toast.Style.Failure,
          title: "Move failed",
          message
        });
      }
    },
    [removeFiles]
  );
  const moveAll = (0, import_react.useCallback)(
    async (opts) => {
      const plans = [];
      for (const file of files) {
        const c = classifications.get(file.fullPath);
        if (!c) continue;
        const resolved = resolveDestination(c, miscFolderName);
        if (!resolved) continue;
        if (resolved.isMiscFallback && !opts.includeMisc) continue;
        plans.push({
          file,
          destRel: resolved.relPath,
          isMiscFallback: resolved.isMiscFallback
        });
      }
      if (plans.length === 0) {
        await (0, import_api.showToast)({
          style: import_api.Toast.Style.Failure,
          title: "Nothing to move"
        });
        return;
      }
      const miscCount = plans.filter((p) => p.isMiscFallback).length;
      const confirmed = await (0, import_api.confirmAlert)({
        title: `Move ${plans.length} file${plans.length === 1 ? "" : "s"}?`,
        message: plans.map((p) => {
          const scope = import_path.default.basename(p.file.scanRoot);
          const suffix = p.isMiscFallback ? " (Misc fallback)" : "";
          return `\u2022 [${scope}] ${p.file.name} \u2192 ${p.destRel}${suffix}`;
        }).join("\n") + (miscCount > 0 ? `

${miscCount} routed to Misc fallback.` : ""),
        primaryAction: { title: "Move All", style: import_api.Alert.ActionStyle.Default }
      });
      if (!confirmed) return;
      let moved = 0;
      let failed = 0;
      const movedPaths = [];
      for (const plan of plans) {
        try {
          performMove(plan.file, plan.destRel, plan.isMiscFallback);
          moved++;
          movedPaths.push(plan.file.fullPath);
        } catch {
          failed++;
        }
      }
      await (0, import_api.showToast)({
        style: failed === 0 ? import_api.Toast.Style.Success : import_api.Toast.Style.Failure,
        title: `Moved ${moved} file${moved === 1 ? "" : "s"}`,
        message: failed > 0 ? `${failed} failed` : void 0
      });
      removeFiles(movedPaths);
    },
    [files, classifications, miscFolderName, removeFiles]
  );
  const filesByRoot = (0, import_react.useMemo)(() => {
    const m = /* @__PURE__ */ new Map();
    for (const f of files) {
      if (!m.has(f.scanRoot)) m.set(f.scanRoot, []);
      m.get(f.scanRoot).push(f);
    }
    return m;
  }, [files]);
  const [isShowingDetail, setIsShowingDetail] = (0, import_react.useState)(true);
  const buildDetailMarkdown = (0, import_react.useCallback)(
    (file, c, resolved) => {
      const rootLabel = file.scanRoot.replace(process.env.HOME ?? "", "~");
      const lines = [
        `# ${file.name}`,
        "",
        `**Size:** ${formatBytes(file.sizeBytes)}`,
        `**Scan root:** \`${rootLabel}\``,
        "",
        "---",
        "",
        "## Proposed destination",
        ""
      ];
      if (c.status === "pending") {
        lines.push("_Classifying\u2026_");
      } else if (c.status === "error") {
        lines.push(`**Error:** ${c.message}`);
      } else if (resolved) {
        const fullPath = import_path.default.join(rootLabel, resolved.relPath);
        lines.push(`\`${fullPath}\``);
        if (resolved.isMiscFallback) {
          lines.push(
            "",
            "_Misc fallback \u2014 AI could not confidently classify this file._"
          );
        }
      } else {
        lines.push("_No match \u2014 file will stay where it is._");
      }
      return lines.filter((l) => l !== null).join("\n");
    },
    []
  );
  const emptyView = /* @__PURE__ */ _jsx(
    import_api.List.EmptyView,
    {
      icon: import_api.Icon.CheckCircle,
      title: isLoading ? "Scanning\u2026" : "No loose book files",
      description: isLoading ? void 0 : `No files with extensions [${[...extensions].join(", ")}] directly in ${scanRoots.join(" or ")}.`
    }
  );
  return /* @__PURE__ */ _jsx(
    import_api.List,
    {
      isLoading,
      searchBarPlaceholder: "Filter loose files\u2026",
      navigationTitle: "Organize Loose Files",
      isShowingDetail
    },
    files.length === 0 ? emptyView : [...filesByRoot.entries()].map(([scanRoot, rootFiles]) => /* @__PURE__ */ _jsx(
      import_api.List.Section,
      {
        key: scanRoot,
        title: scanRoot.replace(process.env.HOME ?? "", "~"),
        subtitle: `${rootFiles.length} loose file${rootFiles.length === 1 ? "" : "s"}`
      },
      rootFiles.map((file) => {
        const c = classifications.get(file.fullPath) ?? {
          status: "pending"
        };
        const resolved = resolveDestination(c, miscFolderName);
        let statusText;
        let icon = import_api.Icon.Clock;
        if (c.status === "pending") {
          statusText = "Classifying\u2026";
        } else if (c.status === "error") {
          statusText = "error";
          icon = import_api.Icon.ExclamationMark;
        } else if (resolved) {
          const leaf = import_path.default.basename(resolved.relPath);
          statusText = resolved.isMiscFallback ? `\u2192 ${leaf} (Misc)` : `\u2192 ${leaf}`;
          icon = resolved.isMiscFallback ? import_api.Icon.QuestionMark : import_api.Icon.ArrowRight;
        } else {
          statusText = "(stays put)";
          icon = import_api.Icon.Minus;
        }
        const listItemProps = isShowingDetail ? {
          accessories: [{ text: statusText, icon }],
          detail: /* @__PURE__ */ _jsx(
            import_api.List.Item.Detail,
            {
              markdown: buildDetailMarkdown(file, c, resolved)
            }
          )
        } : {
          subtitle: c.status === "ready" && resolved ? resolved.isMiscFallback ? `\u2192 ${resolved.relPath} (Misc fallback)` : `\u2192 ${resolved.relPath}` : c.status === "error" ? `error: ${c.message}` : c.status === "pending" ? "Classifying\u2026" : "(no match \u2014 stays put)",
          accessories: [
            {
              text: formatBytes(file.sizeBytes),
              tooltip: "File size"
            },
            { icon }
          ]
        };
        return /* @__PURE__ */ _jsx(
          import_api.List.Item,
          {
            key: file.fullPath,
            icon: import_api.Icon.Document,
            title: file.name,
            ...listItemProps,
            actions: /* @__PURE__ */ _jsx(import_api.ActionPanel, null, resolved && !resolved.isMiscFallback && /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: `Move to ${resolved.relPath}`,
                icon: import_api.Icon.ArrowRight,
                onAction: () => moveOne(
                  file,
                  resolved.relPath,
                  resolved.isMiscFallback
                )
              }
            ), resolved && resolved.isMiscFallback && /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: `Move to Misc (${resolved.relPath})`,
                icon: import_api.Icon.QuestionMark,
                onAction: () => moveOne(
                  file,
                  resolved.relPath,
                  resolved.isMiscFallback
                )
              }
            ), /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: "Move All (Confident Matches Only)",
                icon: import_api.Icon.ArrowClockwise,
                shortcut: {
                  modifiers: ["cmd", "shift"],
                  key: "return"
                },
                onAction: () => moveAll({ includeMisc: false })
              }
            ), miscFolderName && /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: "Move All (Including Misc Fallbacks)",
                icon: import_api.Icon.ArrowClockwise,
                shortcut: {
                  modifiers: ["cmd", "opt"],
                  key: "return"
                },
                onAction: () => moveAll({ includeMisc: true })
              }
            ), /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: "Refresh",
                icon: import_api.Icon.RotateClockwise,
                shortcut: { modifiers: ["cmd"], key: "r" },
                onAction: refresh
              }
            ), /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: isShowingDetail ? "Hide Detail Panel" : "Show Detail Panel",
                icon: import_api.Icon.Sidebar,
                shortcut: { modifiers: ["cmd"], key: "d" },
                onAction: () => setIsShowingDetail((v) => !v)
              }
            ), /* @__PURE__ */ _jsx(import_api.Action.ShowInFinder, { path: file.fullPath }), /* @__PURE__ */ _jsx(
              import_api.Action.Open,
              {
                title: "Open File",
                target: file.fullPath,
                icon: import_api.Icon.Eye
              }
            ), resolved && /* @__PURE__ */ _jsx(
              import_api.Action.Open,
              {
                title: "Open Proposed Folder",
                target: import_path.default.join(file.scanRoot, resolved.relPath),
                icon: import_api.Icon.Folder
              }
            ))
          }
        );
      })
    ))
  );
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvcGRmLWxpYnJhcnkvc3JjL29yZ2FuaXplLWxvb3NlLWZpbGVzLnRzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuaW1wb3J0IHtcbiAgQWN0aW9uLFxuICBBY3Rpb25QYW5lbCxcbiAgQUksXG4gIEFsZXJ0LFxuICBjb25maXJtQWxlcnQsXG4gIGdldFByZWZlcmVuY2VWYWx1ZXMsXG4gIEljb24sXG4gIExpc3QsXG4gIHNob3dUb2FzdCxcbiAgVG9hc3QsXG59IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjtcblxuaW50ZXJmYWNlIFByZWZlcmVuY2VzIHtcbiAgbGlicmFyeVBhdGhzOiBzdHJpbmc7XG4gIGV4dGVuc2lvbnM/OiBzdHJpbmc7XG4gIG1pc2NGb2xkZXJOYW1lPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgTG9vc2VGaWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBmdWxsUGF0aDogc3RyaW5nO1xuICBzaXplQnl0ZXM6IG51bWJlcjtcbiAgc2NhblJvb3Q6IHN0cmluZzsgLy8gYWJzb2x1dGUgcGF0aCBvZiB0aGUgc2NhbiByb290IHRoaXMgZmlsZSBiZWxvbmdzIHRvXG59XG5cbnR5cGUgQ2xhc3NpZmljYXRpb24gPVxuICB8IHsgc3RhdHVzOiBcInBlbmRpbmdcIiB9XG4gIC8vIGRlc3RpbmF0aW9uIGlzIGEgcGF0aCByZWxhdGl2ZSB0byB0aGUgc2NhbiByb290IChcIlwiPW5vIG1hdGNoIC8gUk9PVClcbiAgfCB7IHN0YXR1czogXCJyZWFkeVwiOyBkZXN0aW5hdGlvbjogc3RyaW5nIH1cbiAgfCB7IHN0YXR1czogXCJlcnJvclwiOyBtZXNzYWdlOiBzdHJpbmcgfTtcblxuY29uc3QgSUdOT1JFRF9GT0xERVJfTkFNRVMgPSBuZXcgU2V0KFtcbiAgXCJub2RlX21vZHVsZXNcIixcbiAgXCIuZ2l0XCIsXG4gIFwiLkRTX1N0b3JlXCIsXG4gIFwiTXkgS2luZGxlIENvbnRlbnRcIixcbiAgXCJuZXdCb29rc1wiLFxuXSk7XG5cbmZ1bmN0aW9uIGV4cGFuZFRpbGRlKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoZmlsZVBhdGguc3RhcnRzV2l0aChcIn4vXCIpKSB7XG4gICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudi5IT01FID8/IFwiXCIsIGZpbGVQYXRoLnNsaWNlKDIpKTtcbiAgfVxuICByZXR1cm4gZmlsZVBhdGg7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdEJ5dGVzKGJ5dGVzOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoYnl0ZXMgPCAxMDI0KSByZXR1cm4gYCR7Ynl0ZXN9IEJgO1xuICBpZiAoYnl0ZXMgPCAxMDI0ICogMTAyNCkgcmV0dXJuIGAkeyhieXRlcyAvIDEwMjQpLnRvRml4ZWQoMSl9IEtCYDtcbiAgcmV0dXJuIGAkeyhieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSl9IE1CYDtcbn1cblxuZnVuY3Rpb24gcGFyc2VFeHRlbnNpb25zKHJhdzogc3RyaW5nIHwgdW5kZWZpbmVkKTogU2V0PHN0cmluZz4ge1xuICBjb25zdCBsaXN0ID0gKHJhdyA/PyBcInBkZixlcHViLGRqdnUsbW9iaSxhenczXCIpXG4gICAgLnNwbGl0KFwiLFwiKVxuICAgIC5tYXAoKHMpID0+IHMudHJpbSgpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXlxcLi8sIFwiXCIpKVxuICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gIHJldHVybiBuZXcgU2V0KGxpc3QpO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxpYnJhcnlQYXRocyhyYXc6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgcGFydCBvZiByYXcuc3BsaXQoXCIsXCIpKSB7XG4gICAgY29uc3QgdHJpbW1lZCA9IHBhcnQudHJpbSgpO1xuICAgIGlmICghdHJpbW1lZCkgY29udGludWU7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSBwYXRoLnJlc29sdmUoZXhwYW5kVGlsZGUodHJpbW1lZCkpO1xuICAgIGlmIChzZWVuLmhhcyhyZXNvbHZlZCkpIGNvbnRpbnVlO1xuICAgIHNlZW4uYWRkKHJlc29sdmVkKTtcbiAgICBvdXQucHVzaChyZXNvbHZlZCk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZmluZExvb3NlRmlsZXMocm9vdDogc3RyaW5nLCBleHRlbnNpb25zOiBTZXQ8c3RyaW5nPik6IExvb3NlRmlsZVtdIHtcbiAgbGV0IGVudHJpZXM6IGZzLkRpcmVudFtdO1xuICB0cnkge1xuICAgIGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhyb290LCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBjb25zdCBvdXQ6IExvb3NlRmlsZVtdID0gW107XG4gIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgIGlmICghZW50cnkuaXNGaWxlKCkpIGNvbnRpbnVlO1xuICAgIGlmIChlbnRyeS5uYW1lLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcbiAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZW50cnkubmFtZSkuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoIWV4dGVuc2lvbnMuaGFzKGV4dCkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4ocm9vdCwgZW50cnkubmFtZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsKTtcbiAgICAgIG91dC5wdXNoKHtcbiAgICAgICAgbmFtZTogZW50cnkubmFtZSxcbiAgICAgICAgZnVsbFBhdGg6IGZ1bGwsXG4gICAgICAgIHNpemVCeXRlczogc3RhdC5zaXplLFxuICAgICAgICBzY2FuUm9vdDogcm9vdCxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gdW5yZWFkYWJsZSwgc2tpcFxuICAgIH1cbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG4vLyBSZWN1cnNpdmVseSBsaXN0IGFsbCBzdWJmb2xkZXIgcGF0aHMgcmVsYXRpdmUgdG8gcm9vdC5cbmZ1bmN0aW9uIGZpbmRBbGxTdWJmb2xkZXJzKHJvb3Q6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCB3YWxrID0gKGN1cnJlbnQ6IHN0cmluZywgcmVsOiBzdHJpbmcpID0+IHtcbiAgICBsZXQgZW50cmllczogZnMuRGlyZW50W107XG4gICAgdHJ5IHtcbiAgICAgIGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhjdXJyZW50LCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgaWYgKCFlbnRyeS5pc0RpcmVjdG9yeSgpKSBjb250aW51ZTtcbiAgICAgIGlmIChlbnRyeS5uYW1lLnN0YXJ0c1dpdGgoXCIuXCIpKSBjb250aW51ZTtcbiAgICAgIGlmIChJR05PUkVEX0ZPTERFUl9OQU1FUy5oYXMoZW50cnkubmFtZSkpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgY2hpbGRSZWwgPSByZWwgPyBwYXRoLmpvaW4ocmVsLCBlbnRyeS5uYW1lKSA6IGVudHJ5Lm5hbWU7XG4gICAgICBvdXQucHVzaChjaGlsZFJlbCk7XG4gICAgICB3YWxrKHBhdGguam9pbihjdXJyZW50LCBlbnRyeS5uYW1lKSwgY2hpbGRSZWwpO1xuICAgIH1cbiAgfTtcbiAgd2Fsayhyb290LCBcIlwiKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuY29uc3QgTUFYX1JFVFJJRVNfT05fNDI5ID0gNztcbmNvbnN0IElOSVRJQUxfQkFDS09GRl9NUyA9IDMwMDA7XG5jb25zdCBCQVRDSF9TSVpFID0gNDA7IC8vIE1heCBmaWxlcyBwZXIgc2luZ2xlIEFJIGNhbGwgdG8ga2VlcCB0aGUgcHJvbXB0IHJlYXNvbmFibGUuXG5cbmZ1bmN0aW9uIHNsZWVwKG1zOiBudW1iZXIsIHNpZ25hbDogQWJvcnRTaWduYWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgXCJhYm9ydFwiLFxuICAgICAgKCkgPT4ge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgICAgICByZWplY3QobmV3IERPTUV4Y2VwdGlvbihcIkFib3J0ZWRcIiwgXCJBYm9ydEVycm9yXCIpKTtcbiAgICAgIH0sXG4gICAgICB7IG9uY2U6IHRydWUgfSxcbiAgICApO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gaXNSYXRlTGltaXRFcnJvcihlcnI6IHVua25vd24pOiBib29sZWFuIHtcbiAgY29uc3QgbXNnID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICByZXR1cm4gL1xcYjQyOVxcYi8udGVzdChtc2cpIHx8IC9yYXRlIGxpbWl0L2kudGVzdChtc2cpO1xufVxuXG5mdW5jdGlvbiBidWlsZEJhdGNoUHJvbXB0KGZpbGVuYW1lczogc3RyaW5nW10sIGZvbGRlcnM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgY29uc3QgZm9sZGVyTGlzdCA9IGZvbGRlcnMubWFwKChmLCBpKSA9PiBgJHtpICsgMX0uICR7Zn1gKS5qb2luKFwiXFxuXCIpO1xuICBjb25zdCBmaWxlTGlzdCA9IGZpbGVuYW1lcy5tYXAoKG4sIGkpID0+IGAke2kgKyAxfS4gJHtufWApLmpvaW4oXCJcXG5cIik7XG4gIHJldHVybiBbXG4gICAgXCJZb3UgYXJlIG9yZ2FuaXppbmcgYSBwZXJzb25hbCBib29rIGxpYnJhcnkuIEZvciBlYWNoIGZpbGUgYmVsb3csIHBpY2sgdGhlIHNpbmdsZSBtb3N0IGFwcHJvcHJpYXRlIGV4aXN0aW5nIGZvbGRlciBmcm9tIHRoZSBmb2xkZXIgbGlzdC5cIixcbiAgICBcIlwiLFxuICAgIFwiQXZhaWxhYmxlIGZvbGRlcnM6XCIsXG4gICAgZm9sZGVyTGlzdCxcbiAgICBcIlwiLFxuICAgIFwiRmlsZXMgdG8gY2xhc3NpZnk6XCIsXG4gICAgZmlsZUxpc3QsXG4gICAgXCJcIixcbiAgICBcIk91dHB1dCBhIEpTT04gYXJyYXkgd2l0aCBvbmUgb2JqZWN0IHBlciBmaWxlIGluIHRoZSBzYW1lIG9yZGVyLCB3aXRoIGZpZWxkcyBgaW5kZXhgICgxLWJhc2VkKSBhbmQgYGZvbGRlcmAgKGV4YWN0IHBhdGggZnJvbSB0aGUgZm9sZGVyIGxpc3QsIG9yIGBST09UYCBpZiBubyBmb2xkZXIgZml0cykuIFByZWZlciB0aGUgbW9zdCBzcGVjaWZpYyBzdWJmb2xkZXIgKGUuZy4gYE1hdGhlbWF0aWNzL0xhbmdsYW5kcyBQcm9ncmFtYCBvdmVyIGBNYXRoZW1hdGljc2ApLlwiLFxuICAgIFwiXCIsXG4gICAgXCJPdXRwdXQgT05MWSB0aGUgSlNPTiBhcnJheSwgbm8gcHJvc2UsIG5vIG1hcmtkb3duIGZlbmNlcy5cIixcbiAgICBcIlwiLFxuICAgIFwiRXhhbXBsZSBvdXRwdXQgZm9yIDIgZmlsZXM6XCIsXG4gICAgYFt7XCJpbmRleFwiOjEsXCJmb2xkZXJcIjpcIk1hdGhlbWF0aWNzL0FuYWx5c2lzXCJ9LHtcImluZGV4XCI6MixcImZvbGRlclwiOlwiUk9PVFwifV1gLFxuICBdLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIHN0cmlwTWFya2Rvd25GZW5jZXModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHRcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL15gYGAoPzpqc29uKT9cXHMqL2ksIFwiXCIpXG4gICAgLnJlcGxhY2UoL1xccypgYGAkL2ksIFwiXCIpXG4gICAgLnRyaW0oKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRm9sZGVyKHJhdzogc3RyaW5nLCBmb2xkZXJzOiBzdHJpbmdbXSk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBjbGVhbmVkID0gcmF3XG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9eW1wiJ2BdK3xbXCInYF0rJC9nLCBcIlwiKVxuICAgIC5yZXBsYWNlKC9bLiw7XSskLywgXCJcIik7XG4gIGlmIChjbGVhbmVkLnRvVXBwZXJDYXNlKCkgPT09IFwiUk9PVFwiKSByZXR1cm4gXCJcIjtcbiAgaWYgKGZvbGRlcnMuaW5jbHVkZXMoY2xlYW5lZCkpIHJldHVybiBjbGVhbmVkO1xuICBjb25zdCBsb3dlcmVkID0gY2xlYW5lZC50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBtYXRjaCA9IGZvbGRlcnMuZmluZCgoZikgPT4gZi50b0xvd2VyQ2FzZSgpID09PSBsb3dlcmVkKTtcbiAgaWYgKG1hdGNoKSByZXR1cm4gbWF0Y2g7XG4gIHJldHVybiBudWxsO1xufVxuXG5jb25zdCBBSV9DQUxMX1RJTUVPVVRfTVMgPSA2MF8wMDA7IC8vIEhhcmQgdXBwZXIgYm91bmQgc28gYSBodW5nIHJlcXVlc3Qgc3VyZmFjZXMgYXMgYW4gZXJyb3IuXG5cbi8vIENhbGwgQUkuYXNrIHdpdGggYW4gZW5mb3JjZWQgdGltZW91dC4gSWYgYHNpZ25hbGAgaXMgYWJvcnRlZCBvciB0aGUgdGltZW91dCBlbGFwc2VzLFxuLy8gdGhlIHJlcXVlc3QgaXMgY2FuY2VsbGVkIGFuZCBhbiBlcnJvciBpcyB0aHJvd24uXG5hc3luYyBmdW5jdGlvbiBhc2tXaXRoVGltZW91dChcbiAgcHJvbXB0OiBzdHJpbmcsXG4gIG1vZGVsOiBzdHJpbmcsXG4gIG91dGVyU2lnbmFsOiBBYm9ydFNpZ25hbCxcbiAgdGltZW91dE1zOiBudW1iZXIsXG4gIGxhYmVsOiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBpbm5lciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3Qgb25PdXRlckFib3J0ID0gKCkgPT5cbiAgICBpbm5lci5hYm9ydChuZXcgRE9NRXhjZXB0aW9uKFwiT3V0ZXIgYWJvcnRlZFwiLCBcIkFib3J0RXJyb3JcIikpO1xuICBpZiAob3V0ZXJTaWduYWwuYWJvcnRlZCkgaW5uZXIuYWJvcnQoKTtcbiAgZWxzZSBvdXRlclNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgb25PdXRlckFib3J0LCB7IG9uY2U6IHRydWUgfSk7XG5cbiAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaW5uZXIuYWJvcnQoXG4gICAgICBuZXcgRE9NRXhjZXB0aW9uKFxuICAgICAgICBgQUkgY2FsbCB0aW1lZCBvdXQgYWZ0ZXIgJHt0aW1lb3V0TXN9bXNgLFxuICAgICAgICBcIlRpbWVvdXRFcnJvclwiLFxuICAgICAgKSxcbiAgICApO1xuICB9LCB0aW1lb3V0TXMpO1xuXG4gIGNvbnN0IHN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gIGNvbnNvbGUubG9nKFxuICAgIGBbb3JnYW5pemVdICR7bGFiZWx9OiBzdGFydGluZyBBSS5hc2sgKG1vZGVsPSR7bW9kZWx9LCBwcm9tcHRCeXRlcz0ke3Byb21wdC5sZW5ndGh9KWAsXG4gICk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBBSS5hc2socHJvbXB0LCB7XG4gICAgICBtb2RlbDogbW9kZWwgYXMgdW5rbm93biBhcyBBSS5Nb2RlbCxcbiAgICAgIGNyZWF0aXZpdHk6IFwibG93XCIsXG4gICAgICBzaWduYWw6IGlubmVyLnNpZ25hbCxcbiAgICB9KTtcbiAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdDtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbb3JnYW5pemVdICR7bGFiZWx9OiBBSS5hc2sgcmVzb2x2ZWQgaW4gJHtlbGFwc2VkfW1zIChyZXNwb25zZUJ5dGVzPSR7cmVzdWx0Lmxlbmd0aH0pYCxcbiAgICApO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gc3RhcnRlZEF0O1xuICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbb3JnYW5pemVdICR7bGFiZWx9OiBBSS5hc2sgZmFpbGVkIGFmdGVyICR7ZWxhcHNlZH1tczogJHttc2d9YCxcbiAgICApO1xuICAgIHRocm93IGVycjtcbiAgfSBmaW5hbGx5IHtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICBvdXRlclNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgb25PdXRlckFib3J0KTtcbiAgfVxufVxuXG4vLyBDbGFzc2lmeSBhIGJhdGNoIG9mIGZpbGVzIGluIGEgc2luZ2xlIEFJIGNhbGwuIFJldHVybnMgYSBtYXAga2V5ZWQgYnkgZmlsZW5hbWVcbi8vIChhcyBhcHBlYXJlZCBpbiBgZmlsZW5hbWVzYCkgLT4gZGVzdGluYXRpb24gKGVtcHR5IHN0cmluZyA9IFJPT1QpLlxuLy8gVGhyb3dzIG9uIEFJL25ldHdvcmsgZXJyb3JzIGFuZCByZXRyaWVzIG9uIDQyOS5cbmFzeW5jIGZ1bmN0aW9uIGNsYXNzaWZ5QmF0Y2goXG4gIGZpbGVuYW1lczogc3RyaW5nW10sXG4gIGZvbGRlcnM6IHN0cmluZ1tdLFxuICBzaWduYWw6IEFib3J0U2lnbmFsLFxuICBsYWJlbDogc3RyaW5nLFxuKTogUHJvbWlzZTxNYXA8c3RyaW5nLCBzdHJpbmc+PiB7XG4gIGNvbnN0IHByb21wdCA9IGJ1aWxkQmF0Y2hQcm9tcHQoZmlsZW5hbWVzLCBmb2xkZXJzKTtcbiAgbGV0IGxhc3RFcnI6IHVua25vd247XG5cbiAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPD0gTUFYX1JFVFJJRVNfT05fNDI5OyBhdHRlbXB0KyspIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhc2tXaXRoVGltZW91dChcbiAgICAgICAgcHJvbXB0LFxuICAgICAgICBBSS5Nb2RlbFtcIkFudGhyb3BpY19DbGF1ZGVfNC41X0hhaWt1XCJdLFxuICAgICAgICBzaWduYWwsXG4gICAgICAgIEFJX0NBTExfVElNRU9VVF9NUyxcbiAgICAgICAgYCR7bGFiZWx9IGF0dGVtcHQ9JHthdHRlbXB0fWAsXG4gICAgICApO1xuICAgICAgY29uc3QgdGV4dCA9IHN0cmlwTWFya2Rvd25GZW5jZXMocmVzcG9uc2UpO1xuICAgICAgbGV0IHBhcnNlZDogdW5rbm93bjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHBhcnNlZCA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIFRyeSB0byBleHRyYWN0IGEgSlNPTiBhcnJheSBpZiB0aGUgbW9kZWwgd3JhcHBlZCBpdCBpbiBleHRyYSB0ZXh0LlxuICAgICAgICBjb25zdCBtYXRjaCA9IHRleHQubWF0Y2goL1xcW1tcXHNcXFNdKlxcXS8pO1xuICAgICAgICBpZiAobWF0Y2gpIHBhcnNlZCA9IEpTT04ucGFyc2UobWF0Y2hbMF0pO1xuICAgICAgICBlbHNlIHRocm93IGU7XG4gICAgICB9XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFyc2VkKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQUkgZGlkIG5vdCByZXR1cm4gYSBKU09OIGFycmF5XCIpO1xuXG4gICAgICBjb25zdCBvdXQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBwYXJzZWQpIHtcbiAgICAgICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkgIT09IFwib2JqZWN0XCIpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBpZHggPSBOdW1iZXIoKGVudHJ5IGFzIHsgaW5kZXg/OiB1bmtub3duIH0pLmluZGV4KTtcbiAgICAgICAgY29uc3QgZm9sZGVyUmF3ID0gU3RyaW5nKChlbnRyeSBhcyB7IGZvbGRlcj86IHVua25vd24gfSkuZm9sZGVyID8/IFwiXCIpO1xuICAgICAgICBpZiAoIU51bWJlci5pc0ludGVnZXIoaWR4KSB8fCBpZHggPCAxIHx8IGlkeCA+IGZpbGVuYW1lcy5sZW5ndGgpXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIGNvbnN0IGZpbGVuYW1lID0gZmlsZW5hbWVzW2lkeCAtIDFdO1xuICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplRm9sZGVyKGZvbGRlclJhdywgZm9sZGVycyk7XG4gICAgICAgIGlmIChub3JtYWxpemVkICE9PSBudWxsKSBvdXQuc2V0KGZpbGVuYW1lLCBub3JtYWxpemVkKTtcbiAgICAgIH1cbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW29yZ2FuaXplXSAke2xhYmVsfTogY2xhc3NpZmllZCAke291dC5zaXplfS8ke2ZpbGVuYW1lcy5sZW5ndGh9IGZpbGVzYCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gb3V0O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbGFzdEVyciA9IGVycjtcbiAgICAgIGlmIChzaWduYWwuYWJvcnRlZCkgdGhyb3cgZXJyO1xuICAgICAgaWYgKCFpc1JhdGVMaW1pdEVycm9yKGVycikgfHwgYXR0ZW1wdCA9PT0gTUFYX1JFVFJJRVNfT05fNDI5KSB0aHJvdyBlcnI7XG4gICAgICBjb25zdCBkZWxheSA9XG4gICAgICAgIElOSVRJQUxfQkFDS09GRl9NUyAqIE1hdGgucG93KDIsIGF0dGVtcHQpICsgTWF0aC5yYW5kb20oKSAqIDUwMDtcbiAgICAgIGNvbnNvbGUubG9nKGBbb3JnYW5pemVdICR7bGFiZWx9OiA0MjkgYmFja29mZiAke01hdGgucm91bmQoZGVsYXkpfW1zYCk7XG4gICAgICBhd2FpdCBzbGVlcChkZWxheSwgc2lnbmFsKTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbGFzdEVyciBpbnN0YW5jZW9mIEVycm9yID8gbGFzdEVyciA6IG5ldyBFcnJvcihTdHJpbmcobGFzdEVycikpO1xufVxuXG4vLyBTcGxpdCBhbiBhcnJheSBpbnRvIGNodW5rcyBvZiBhdCBtb3N0IGBzaXplYC5cbmZ1bmN0aW9uIGNodW5rPFQ+KGFycjogVFtdLCBzaXplOiBudW1iZXIpOiBUW11bXSB7XG4gIGlmIChzaXplIDw9IDApIHJldHVybiBbYXJyXTtcbiAgY29uc3Qgb3V0OiBUW11bXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gc2l6ZSkgb3V0LnB1c2goYXJyLnNsaWNlKGksIGkgKyBzaXplKSk7XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHVuaXF1ZURlc3RpbmF0aW9uKHRhcmdldERpcjogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IGRlc3QgPSBwYXRoLmpvaW4odGFyZ2V0RGlyLCBmaWxlbmFtZSk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhkZXN0KSkgcmV0dXJuIGRlc3Q7XG4gIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlbmFtZSk7XG4gIGNvbnN0IGJhc2UgPSBmaWxlbmFtZS5zbGljZSgwLCBmaWxlbmFtZS5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgZm9yIChsZXQgaSA9IDI7IGkgPCAxMDAwOyBpKyspIHtcbiAgICBjb25zdCBjYW5kaWRhdGUgPSBwYXRoLmpvaW4odGFyZ2V0RGlyLCBgJHtiYXNlfSAoJHtpfSkke2V4dH1gKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY2FuZGlkYXRlKSkgcmV0dXJuIGNhbmRpZGF0ZTtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgZmluZCB1bmlxdWUgZmlsZW5hbWUgYWZ0ZXIgMTAwMCBhdHRlbXB0c1wiKTtcbn1cblxuLy8gUmVzb2x2ZSB0aGUgZWZmZWN0aXZlIGRlc3RpbmF0aW9uIGZvciBhIGZpbGUgZ2l2ZW4gaXRzIGNsYXNzaWZpY2F0aW9uIGFuZCB0aGUgbWlzYyBmYWxsYmFjayBzZXR0aW5nLlxuLy8gUmV0dXJucyBudWxsIGlmIHRoZSBmaWxlIHNob3VsZCBub3QgYmUgbW92ZWQgKG5vIG1hdGNoICsgbm8gbWlzYyBmb2xkZXIgY29uZmlndXJlZCkuXG5mdW5jdGlvbiByZXNvbHZlRGVzdGluYXRpb24oXG4gIGNsYXNzaWZpY2F0aW9uOiBDbGFzc2lmaWNhdGlvbixcbiAgbWlzY0ZvbGRlck5hbWU6IHN0cmluZyxcbik6IHsgcmVsUGF0aDogc3RyaW5nOyBpc01pc2NGYWxsYmFjazogYm9vbGVhbiB9IHwgbnVsbCB7XG4gIGlmIChjbGFzc2lmaWNhdGlvbi5zdGF0dXMgIT09IFwicmVhZHlcIikgcmV0dXJuIG51bGw7XG4gIGlmIChjbGFzc2lmaWNhdGlvbi5kZXN0aW5hdGlvbiAhPT0gXCJcIikge1xuICAgIHJldHVybiB7IHJlbFBhdGg6IGNsYXNzaWZpY2F0aW9uLmRlc3RpbmF0aW9uLCBpc01pc2NGYWxsYmFjazogZmFsc2UgfTtcbiAgfVxuICBpZiAoIW1pc2NGb2xkZXJOYW1lKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHsgcmVsUGF0aDogbWlzY0ZvbGRlck5hbWUsIGlzTWlzY0ZhbGxiYWNrOiB0cnVlIH07XG59XG5cbmZ1bmN0aW9uIHBlcmZvcm1Nb3ZlKFxuICBmaWxlOiBMb29zZUZpbGUsXG4gIGRlc3RSZWw6IHN0cmluZyxcbiAgY3JlYXRlVGFyZ2V0RGlyOiBib29sZWFuLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgdGFyZ2V0RGlyID0gcGF0aC5qb2luKGZpbGUuc2NhblJvb3QsIGRlc3RSZWwpO1xuICBpZiAoIWZzLmV4aXN0c1N5bmModGFyZ2V0RGlyKSkge1xuICAgIGlmICghY3JlYXRlVGFyZ2V0RGlyKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUYXJnZXQgZm9sZGVyIGRvZXMgbm90IGV4aXN0OiAke2Rlc3RSZWx9YCk7XG4gICAgZnMubWtkaXJTeW5jKHRhcmdldERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIH1cbiAgY29uc3QgZGVzdCA9IHVuaXF1ZURlc3RpbmF0aW9uKHRhcmdldERpciwgZmlsZS5uYW1lKTtcbiAgZnMucmVuYW1lU3luYyhmaWxlLmZ1bGxQYXRoLCBkZXN0KTtcbiAgcmV0dXJuIGRlc3Q7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIE9yZ2FuaXplTG9vc2VGaWxlcygpIHtcbiAgY29uc3QgcHJlZnMgPSBnZXRQcmVmZXJlbmNlVmFsdWVzPFByZWZlcmVuY2VzPigpO1xuICBjb25zdCBzY2FuUm9vdHMgPSB1c2VNZW1vKFxuICAgICgpID0+IHBhcnNlTGlicmFyeVBhdGhzKHByZWZzLmxpYnJhcnlQYXRocyksXG4gICAgW3ByZWZzLmxpYnJhcnlQYXRoc10sXG4gICk7XG4gIGNvbnN0IGV4dGVuc2lvbnMgPSB1c2VNZW1vKFxuICAgICgpID0+IHBhcnNlRXh0ZW5zaW9ucyhwcmVmcy5leHRlbnNpb25zKSxcbiAgICBbcHJlZnMuZXh0ZW5zaW9uc10sXG4gICk7XG4gIGNvbnN0IG1pc2NGb2xkZXJOYW1lID0gKHByZWZzLm1pc2NGb2xkZXJOYW1lID8/IFwiTWlzY1wiKS50cmltKCk7XG5cbiAgY29uc3QgW2ZpbGVzLCBzZXRGaWxlc10gPSB1c2VTdGF0ZTxMb29zZUZpbGVbXT4oW10pO1xuICBjb25zdCBbY2xhc3NpZmljYXRpb25zLCBzZXRDbGFzc2lmaWNhdGlvbnNdID0gdXNlU3RhdGU8XG4gICAgTWFwPHN0cmluZywgQ2xhc3NpZmljYXRpb24+XG4gID4obmV3IE1hcCgpKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbcmVmcmVzaENvdW50ZXIsIHNldFJlZnJlc2hDb3VudGVyXSA9IHVzZVN0YXRlKDApO1xuICBjb25zdCBhYm9ydFJlZiA9IHVzZVJlZjxBYm9ydENvbnRyb2xsZXIgfCBudWxsPihudWxsKTtcblxuICBjb25zdCByZWZyZXNoID0gdXNlQ2FsbGJhY2soKCkgPT4gc2V0UmVmcmVzaENvdW50ZXIoKG4pID0+IG4gKyAxKSwgW10pO1xuXG4gIGNvbnN0IHJlbW92ZUZpbGVzID0gdXNlQ2FsbGJhY2soKHBhdGhzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHRvUmVtb3ZlID0gbmV3IFNldChwYXRocyk7XG4gICAgc2V0RmlsZXMoKHByZXYpID0+IHByZXYuZmlsdGVyKChmKSA9PiAhdG9SZW1vdmUuaGFzKGYuZnVsbFBhdGgpKSk7XG4gICAgc2V0Q2xhc3NpZmljYXRpb25zKChwcmV2KSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KTtcbiAgICAgIGZvciAoY29uc3QgcCBvZiB0b1JlbW92ZSkgbmV4dC5kZWxldGUocCk7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9KTtcbiAgfSwgW10pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYWJvcnRSZWYuY3VycmVudD8uYWJvcnQoKTtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGFib3J0UmVmLmN1cnJlbnQgPSBjb250cm9sbGVyO1xuXG4gICAgY29uc3QgbWlzc2luZyA9IHNjYW5Sb290cy5maWx0ZXIoKHIpID0+ICFmcy5leGlzdHNTeW5jKHIpKTtcbiAgICBpZiAobWlzc2luZy5sZW5ndGggPiAwKSB7XG4gICAgICBzaG93VG9hc3Qoe1xuICAgICAgICBzdHlsZTogVG9hc3QuU3R5bGUuRmFpbHVyZSxcbiAgICAgICAgdGl0bGU6IFwiRGlyZWN0b3J5IG5vdCBmb3VuZFwiLFxuICAgICAgICBtZXNzYWdlOiBtaXNzaW5nLmpvaW4oXCIsIFwiKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCBleGlzdGluZ1Jvb3RzID0gc2NhblJvb3RzLmZpbHRlcigocikgPT4gZnMuZXhpc3RzU3luYyhyKSk7XG5cbiAgICAvLyBDb2xsZWN0IGxvb3NlIGZpbGVzIGFuZCBwZXItcm9vdCBmb2xkZXIgbGlzdHMuXG4gICAgY29uc3QgYWxsTG9vc2U6IExvb3NlRmlsZVtdID0gW107XG4gICAgY29uc3QgZm9sZGVyc0J5Um9vdCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgICBmb3IgKGNvbnN0IHJvb3Qgb2YgZXhpc3RpbmdSb290cykge1xuICAgICAgY29uc3QgbG9vc2UgPSBmaW5kTG9vc2VGaWxlcyhyb290LCBleHRlbnNpb25zKTtcbiAgICAgIGFsbExvb3NlLnB1c2goLi4ubG9vc2UpO1xuICAgICAgZm9sZGVyc0J5Um9vdC5zZXQocm9vdCwgZmluZEFsbFN1YmZvbGRlcnMocm9vdCkpO1xuICAgIH1cblxuICAgIHNldEZpbGVzKGFsbExvb3NlKTtcbiAgICBzZXRDbGFzc2lmaWNhdGlvbnMoXG4gICAgICBuZXcgTWFwKFxuICAgICAgICBhbGxMb29zZS5tYXAoKGYpID0+IFtmLmZ1bGxQYXRoLCB7IHN0YXR1czogXCJwZW5kaW5nXCIgYXMgY29uc3QgfV0pLFxuICAgICAgKSxcbiAgICApO1xuICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG5cbiAgICBpZiAoYWxsTG9vc2UubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICAvLyBHcm91cCBsb29zZSBmaWxlcyBieSBzY2FuIHJvb3QsIHRoZW4gY2xhc3NpZnkgZWFjaCByb290J3MgZmlsZXMgaW4gYmF0Y2hlcyB2aWEgYSBzaW5nbGVcbiAgICAvLyBBSSBjYWxsIHBlciBiYXRjaC4gVGhpcyByZXBsYWNlcyBOIHBlci1maWxlIGNhbGxzIHdpdGggY2VpbChOL0JBVENIX1NJWkUpIGNhbGxzIHRvdGFsLlxuICAgIGNvbnN0IGZpbGVzQnlSb290Rm9yQ2xhc3NpZnkgPSBuZXcgTWFwPHN0cmluZywgTG9vc2VGaWxlW10+KCk7XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGFsbExvb3NlKSB7XG4gICAgICBpZiAoIWZpbGVzQnlSb290Rm9yQ2xhc3NpZnkuaGFzKGZpbGUuc2NhblJvb3QpKSB7XG4gICAgICAgIGZpbGVzQnlSb290Rm9yQ2xhc3NpZnkuc2V0KGZpbGUuc2NhblJvb3QsIFtdKTtcbiAgICAgIH1cbiAgICAgIGZpbGVzQnlSb290Rm9yQ2xhc3NpZnkuZ2V0KGZpbGUuc2NhblJvb3QpIS5wdXNoKGZpbGUpO1xuICAgIH1cblxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IFtyb290LCByb290RmlsZXNdIG9mIGZpbGVzQnlSb290Rm9yQ2xhc3NpZnkpIHtcbiAgICAgICAgY29uc3QgZm9sZGVycyA9IGZvbGRlcnNCeVJvb3QuZ2V0KHJvb3QpID8/IFtdO1xuICAgICAgICBpZiAoZm9sZGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBzZXRDbGFzc2lmaWNhdGlvbnMoKHByZXYpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBmIG9mIHJvb3RGaWxlcykge1xuICAgICAgICAgICAgICBuZXh0LnNldChmLmZ1bGxQYXRoLCB7IHN0YXR1czogXCJyZWFkeVwiLCBkZXN0aW5hdGlvbjogXCJcIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmF0Y2hlcyA9IGNodW5rKHJvb3RGaWxlcywgQkFUQ0hfU0laRSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbb3JnYW5pemVdIHJvb3Q9JHtyb290fSBmaWxlcz0ke3Jvb3RGaWxlcy5sZW5ndGh9IGZvbGRlcnM9JHtmb2xkZXJzLmxlbmd0aH0gYmF0Y2hlcz0ke2JhdGNoZXMubGVuZ3RofWAsXG4gICAgICAgICk7XG4gICAgICAgIGZvciAobGV0IGJhdGNoSWR4ID0gMDsgYmF0Y2hJZHggPCBiYXRjaGVzLmxlbmd0aDsgYmF0Y2hJZHgrKykge1xuICAgICAgICAgIGNvbnN0IGJhdGNoID0gYmF0Y2hlc1tiYXRjaElkeF07XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgICAgICBjb25zdCBmaWxlbmFtZXMgPSBiYXRjaC5tYXAoKGYpID0+IGYubmFtZSk7XG4gICAgICAgICAgY29uc3QgbGFiZWwgPSBgJHtwYXRoLmJhc2VuYW1lKHJvb3QpfVtiYXRjaCAke2JhdGNoSWR4ICsgMX0vJHtiYXRjaGVzLmxlbmd0aH1dYDtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0TWFwID0gYXdhaXQgY2xhc3NpZnlCYXRjaChcbiAgICAgICAgICAgICAgZmlsZW5hbWVzLFxuICAgICAgICAgICAgICBmb2xkZXJzLFxuICAgICAgICAgICAgICBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICAgICAgbGFiZWwsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgICAgICAgIHNldENsYXNzaWZpY2F0aW9ucygocHJldikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGJhdGNoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdE1hcC5oYXMoZmlsZS5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgbmV4dC5zZXQoZmlsZS5mdWxsUGF0aCwge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IFwicmVhZHlcIixcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb246IHJlc3VsdE1hcC5nZXQoZmlsZS5uYW1lKSEsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbmV4dC5zZXQoZmlsZS5mdWxsUGF0aCwge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IFwiZXJyb3JcIixcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogXCJBSSBvbWl0dGVkIHRoaXMgZmlsZSBmcm9tIGl0cyByZXNwb25zZVwiLFxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICAgICAgICAgIHNldENsYXNzaWZpY2F0aW9ucygocHJldikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGJhdGNoKSB7XG4gICAgICAgICAgICAgICAgbmV4dC5zZXQoZmlsZS5mdWxsUGF0aCwgeyBzdGF0dXM6IFwiZXJyb3JcIiwgbWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gKCkgPT4gY29udHJvbGxlci5hYm9ydCgpO1xuICB9LCBbc2NhblJvb3RzLCBleHRlbnNpb25zLCByZWZyZXNoQ291bnRlcl0pO1xuXG4gIGNvbnN0IG1vdmVPbmUgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAoZmlsZTogTG9vc2VGaWxlLCBkZXN0UmVsOiBzdHJpbmcsIGlzTWlzY0ZhbGxiYWNrOiBib29sZWFuKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBwZXJmb3JtTW92ZShmaWxlLCBkZXN0UmVsLCBpc01pc2NGYWxsYmFjayk7XG4gICAgICAgIGF3YWl0IHNob3dUb2FzdCh7XG4gICAgICAgICAgc3R5bGU6IFRvYXN0LlN0eWxlLlN1Y2Nlc3MsXG4gICAgICAgICAgdGl0bGU6IGlzTWlzY0ZhbGxiYWNrID8gXCJNb3ZlZCB0byBNaXNjXCIgOiBcIk1vdmVkXCIsXG4gICAgICAgICAgbWVzc2FnZTogYCR7ZmlsZS5uYW1lfSBcdTIxOTIgJHtkZXN0UmVsfWAsXG4gICAgICAgIH0pO1xuICAgICAgICByZW1vdmVGaWxlcyhbZmlsZS5mdWxsUGF0aF0pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgICAgIGF3YWl0IHNob3dUb2FzdCh7XG4gICAgICAgICAgc3R5bGU6IFRvYXN0LlN0eWxlLkZhaWx1cmUsXG4gICAgICAgICAgdGl0bGU6IFwiTW92ZSBmYWlsZWRcIixcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICAgIFtyZW1vdmVGaWxlc10sXG4gICk7XG5cbiAgY29uc3QgbW92ZUFsbCA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChvcHRzOiB7IGluY2x1ZGVNaXNjOiBib29sZWFuIH0pID0+IHtcbiAgICAgIGNvbnN0IHBsYW5zOiB7XG4gICAgICAgIGZpbGU6IExvb3NlRmlsZTtcbiAgICAgICAgZGVzdFJlbDogc3RyaW5nO1xuICAgICAgICBpc01pc2NGYWxsYmFjazogYm9vbGVhbjtcbiAgICAgIH1bXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICAgIGNvbnN0IGMgPSBjbGFzc2lmaWNhdGlvbnMuZ2V0KGZpbGUuZnVsbFBhdGgpO1xuICAgICAgICBpZiAoIWMpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVEZXN0aW5hdGlvbihjLCBtaXNjRm9sZGVyTmFtZSk7XG4gICAgICAgIGlmICghcmVzb2x2ZWQpIGNvbnRpbnVlO1xuICAgICAgICBpZiAocmVzb2x2ZWQuaXNNaXNjRmFsbGJhY2sgJiYgIW9wdHMuaW5jbHVkZU1pc2MpIGNvbnRpbnVlO1xuICAgICAgICBwbGFucy5wdXNoKHtcbiAgICAgICAgICBmaWxlLFxuICAgICAgICAgIGRlc3RSZWw6IHJlc29sdmVkLnJlbFBhdGgsXG4gICAgICAgICAgaXNNaXNjRmFsbGJhY2s6IHJlc29sdmVkLmlzTWlzY0ZhbGxiYWNrLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChwbGFucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXdhaXQgc2hvd1RvYXN0KHtcbiAgICAgICAgICBzdHlsZTogVG9hc3QuU3R5bGUuRmFpbHVyZSxcbiAgICAgICAgICB0aXRsZTogXCJOb3RoaW5nIHRvIG1vdmVcIixcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1pc2NDb3VudCA9IHBsYW5zLmZpbHRlcigocCkgPT4gcC5pc01pc2NGYWxsYmFjaykubGVuZ3RoO1xuICAgICAgY29uc3QgY29uZmlybWVkID0gYXdhaXQgY29uZmlybUFsZXJ0KHtcbiAgICAgICAgdGl0bGU6IGBNb3ZlICR7cGxhbnMubGVuZ3RofSBmaWxlJHtwbGFucy5sZW5ndGggPT09IDEgPyBcIlwiIDogXCJzXCJ9P2AsXG4gICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgcGxhbnNcbiAgICAgICAgICAgIC5tYXAoKHApID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgc2NvcGUgPSBwYXRoLmJhc2VuYW1lKHAuZmlsZS5zY2FuUm9vdCk7XG4gICAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IHAuaXNNaXNjRmFsbGJhY2sgPyBcIiAoTWlzYyBmYWxsYmFjaylcIiA6IFwiXCI7XG4gICAgICAgICAgICAgIHJldHVybiBgXHUyMDIyIFske3Njb3BlfV0gJHtwLmZpbGUubmFtZX0gXHUyMTkyICR7cC5kZXN0UmVsfSR7c3VmZml4fWA7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmpvaW4oXCJcXG5cIikgK1xuICAgICAgICAgIChtaXNjQ291bnQgPiAwID8gYFxcblxcbiR7bWlzY0NvdW50fSByb3V0ZWQgdG8gTWlzYyBmYWxsYmFjay5gIDogXCJcIiksXG4gICAgICAgIHByaW1hcnlBY3Rpb246IHsgdGl0bGU6IFwiTW92ZSBBbGxcIiwgc3R5bGU6IEFsZXJ0LkFjdGlvblN0eWxlLkRlZmF1bHQgfSxcbiAgICAgIH0pO1xuICAgICAgaWYgKCFjb25maXJtZWQpIHJldHVybjtcblxuICAgICAgbGV0IG1vdmVkID0gMDtcbiAgICAgIGxldCBmYWlsZWQgPSAwO1xuICAgICAgY29uc3QgbW92ZWRQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgcGxhbiBvZiBwbGFucykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHBlcmZvcm1Nb3ZlKHBsYW4uZmlsZSwgcGxhbi5kZXN0UmVsLCBwbGFuLmlzTWlzY0ZhbGxiYWNrKTtcbiAgICAgICAgICBtb3ZlZCsrO1xuICAgICAgICAgIG1vdmVkUGF0aHMucHVzaChwbGFuLmZpbGUuZnVsbFBhdGgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICBmYWlsZWQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYXdhaXQgc2hvd1RvYXN0KHtcbiAgICAgICAgc3R5bGU6IGZhaWxlZCA9PT0gMCA/IFRvYXN0LlN0eWxlLlN1Y2Nlc3MgOiBUb2FzdC5TdHlsZS5GYWlsdXJlLFxuICAgICAgICB0aXRsZTogYE1vdmVkICR7bW92ZWR9IGZpbGUke21vdmVkID09PSAxID8gXCJcIiA6IFwic1wifWAsXG4gICAgICAgIG1lc3NhZ2U6IGZhaWxlZCA+IDAgPyBgJHtmYWlsZWR9IGZhaWxlZGAgOiB1bmRlZmluZWQsXG4gICAgICB9KTtcbiAgICAgIHJlbW92ZUZpbGVzKG1vdmVkUGF0aHMpO1xuICAgIH0sXG4gICAgW2ZpbGVzLCBjbGFzc2lmaWNhdGlvbnMsIG1pc2NGb2xkZXJOYW1lLCByZW1vdmVGaWxlc10sXG4gICk7XG5cbiAgY29uc3QgZmlsZXNCeVJvb3QgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBtID0gbmV3IE1hcDxzdHJpbmcsIExvb3NlRmlsZVtdPigpO1xuICAgIGZvciAoY29uc3QgZiBvZiBmaWxlcykge1xuICAgICAgaWYgKCFtLmhhcyhmLnNjYW5Sb290KSkgbS5zZXQoZi5zY2FuUm9vdCwgW10pO1xuICAgICAgbS5nZXQoZi5zY2FuUm9vdCkhLnB1c2goZik7XG4gICAgfVxuICAgIHJldHVybiBtO1xuICB9LCBbZmlsZXNdKTtcblxuICBjb25zdCBbaXNTaG93aW5nRGV0YWlsLCBzZXRJc1Nob3dpbmdEZXRhaWxdID0gdXNlU3RhdGUodHJ1ZSk7XG5cbiAgY29uc3QgYnVpbGREZXRhaWxNYXJrZG93biA9IHVzZUNhbGxiYWNrKFxuICAgIChcbiAgICAgIGZpbGU6IExvb3NlRmlsZSxcbiAgICAgIGM6IENsYXNzaWZpY2F0aW9uLFxuICAgICAgcmVzb2x2ZWQ6IFJldHVyblR5cGU8dHlwZW9mIHJlc29sdmVEZXN0aW5hdGlvbj4sXG4gICAgKSA9PiB7XG4gICAgICBjb25zdCByb290TGFiZWwgPSBmaWxlLnNjYW5Sb290LnJlcGxhY2UocHJvY2Vzcy5lbnYuSE9NRSA/PyBcIlwiLCBcIn5cIik7XG4gICAgICBjb25zdCBsaW5lczogKHN0cmluZyB8IG51bGwpW10gPSBbXG4gICAgICAgIGAjICR7ZmlsZS5uYW1lfWAsXG4gICAgICAgIFwiXCIsXG4gICAgICAgIGAqKlNpemU6KiogJHtmb3JtYXRCeXRlcyhmaWxlLnNpemVCeXRlcyl9YCxcbiAgICAgICAgYCoqU2NhbiByb290OioqIFxcYCR7cm9vdExhYmVsfVxcYGAsXG4gICAgICAgIFwiXCIsXG4gICAgICAgIFwiLS0tXCIsXG4gICAgICAgIFwiXCIsXG4gICAgICAgIFwiIyMgUHJvcG9zZWQgZGVzdGluYXRpb25cIixcbiAgICAgICAgXCJcIixcbiAgICAgIF07XG5cbiAgICAgIGlmIChjLnN0YXR1cyA9PT0gXCJwZW5kaW5nXCIpIHtcbiAgICAgICAgbGluZXMucHVzaChcIl9DbGFzc2lmeWluZ1x1MjAyNl9cIik7XG4gICAgICB9IGVsc2UgaWYgKGMuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgbGluZXMucHVzaChgKipFcnJvcjoqKiAke2MubWVzc2FnZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzb2x2ZWQpIHtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4ocm9vdExhYmVsLCByZXNvbHZlZC5yZWxQYXRoKTtcbiAgICAgICAgbGluZXMucHVzaChgXFxgJHtmdWxsUGF0aH1cXGBgKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmlzTWlzY0ZhbGxiYWNrKSB7XG4gICAgICAgICAgbGluZXMucHVzaChcbiAgICAgICAgICAgIFwiXCIsXG4gICAgICAgICAgICBcIl9NaXNjIGZhbGxiYWNrIFx1MjAxNCBBSSBjb3VsZCBub3QgY29uZmlkZW50bHkgY2xhc3NpZnkgdGhpcyBmaWxlLl9cIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaW5lcy5wdXNoKFwiX05vIG1hdGNoIFx1MjAxNCBmaWxlIHdpbGwgc3RheSB3aGVyZSBpdCBpcy5fXCIpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbGluZXMuZmlsdGVyKChsKSA9PiBsICE9PSBudWxsKS5qb2luKFwiXFxuXCIpO1xuICAgIH0sXG4gICAgW10sXG4gICk7XG5cbiAgY29uc3QgZW1wdHlWaWV3ID0gKFxuICAgIDxMaXN0LkVtcHR5Vmlld1xuICAgICAgaWNvbj17SWNvbi5DaGVja0NpcmNsZX1cbiAgICAgIHRpdGxlPXtpc0xvYWRpbmcgPyBcIlNjYW5uaW5nXHUyMDI2XCIgOiBcIk5vIGxvb3NlIGJvb2sgZmlsZXNcIn1cbiAgICAgIGRlc2NyaXB0aW9uPXtcbiAgICAgICAgaXNMb2FkaW5nXG4gICAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgICA6IGBObyBmaWxlcyB3aXRoIGV4dGVuc2lvbnMgWyR7Wy4uLmV4dGVuc2lvbnNdLmpvaW4oXCIsIFwiKX1dIGRpcmVjdGx5IGluICR7c2NhblJvb3RzLmpvaW4oXCIgb3IgXCIpfS5gXG4gICAgICB9XG4gICAgLz5cbiAgKTtcblxuICByZXR1cm4gKFxuICAgIDxMaXN0XG4gICAgICBpc0xvYWRpbmc9e2lzTG9hZGluZ31cbiAgICAgIHNlYXJjaEJhclBsYWNlaG9sZGVyPVwiRmlsdGVyIGxvb3NlIGZpbGVzXHUyMDI2XCJcbiAgICAgIG5hdmlnYXRpb25UaXRsZT1cIk9yZ2FuaXplIExvb3NlIEZpbGVzXCJcbiAgICAgIGlzU2hvd2luZ0RldGFpbD17aXNTaG93aW5nRGV0YWlsfVxuICAgID5cbiAgICAgIHtmaWxlcy5sZW5ndGggPT09IDBcbiAgICAgICAgPyBlbXB0eVZpZXdcbiAgICAgICAgOiBbLi4uZmlsZXNCeVJvb3QuZW50cmllcygpXS5tYXAoKFtzY2FuUm9vdCwgcm9vdEZpbGVzXSkgPT4gKFxuICAgICAgICAgICAgPExpc3QuU2VjdGlvblxuICAgICAgICAgICAgICBrZXk9e3NjYW5Sb290fVxuICAgICAgICAgICAgICB0aXRsZT17c2NhblJvb3QucmVwbGFjZShwcm9jZXNzLmVudi5IT01FID8/IFwiXCIsIFwiflwiKX1cbiAgICAgICAgICAgICAgc3VidGl0bGU9e2Ake3Jvb3RGaWxlcy5sZW5ndGh9IGxvb3NlIGZpbGUke3Jvb3RGaWxlcy5sZW5ndGggPT09IDEgPyBcIlwiIDogXCJzXCJ9YH1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3Jvb3RGaWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjID0gY2xhc3NpZmljYXRpb25zLmdldChmaWxlLmZ1bGxQYXRoKSA/PyB7XG4gICAgICAgICAgICAgICAgICBzdGF0dXM6IFwicGVuZGluZ1wiIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlRGVzdGluYXRpb24oYywgbWlzY0ZvbGRlck5hbWUpO1xuXG4gICAgICAgICAgICAgICAgbGV0IHN0YXR1c1RleHQ6IHN0cmluZztcbiAgICAgICAgICAgICAgICBsZXQgaWNvbiA9IEljb24uQ2xvY2s7XG4gICAgICAgICAgICAgICAgaWYgKGMuc3RhdHVzID09PSBcInBlbmRpbmdcIikge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzVGV4dCA9IFwiQ2xhc3NpZnlpbmdcdTIwMjZcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGMuc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c1RleHQgPSBcImVycm9yXCI7XG4gICAgICAgICAgICAgICAgICBpY29uID0gSWNvbi5FeGNsYW1hdGlvbk1hcms7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgICAgLy8gU2hvdyBvbmx5IHRoZSBsZWFmIGZvbGRlciBuYW1lIHRvIGtlZXAgYWNjZXNzb3JpZXMgY29tcGFjdDtcbiAgICAgICAgICAgICAgICAgIC8vIGZ1bGwgcGF0aCBpcyB2aXNpYmxlIGluIHRoZSBkZXRhaWwgcGFuZWwuXG4gICAgICAgICAgICAgICAgICBjb25zdCBsZWFmID0gcGF0aC5iYXNlbmFtZShyZXNvbHZlZC5yZWxQYXRoKTtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c1RleHQgPSByZXNvbHZlZC5pc01pc2NGYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICA/IGBcdTIxOTIgJHtsZWFmfSAoTWlzYylgXG4gICAgICAgICAgICAgICAgICAgIDogYFx1MjE5MiAke2xlYWZ9YDtcbiAgICAgICAgICAgICAgICAgIGljb24gPSByZXNvbHZlZC5pc01pc2NGYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICA/IEljb24uUXVlc3Rpb25NYXJrXG4gICAgICAgICAgICAgICAgICAgIDogSWNvbi5BcnJvd1JpZ2h0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzdGF0dXNUZXh0ID0gXCIoc3RheXMgcHV0KVwiO1xuICAgICAgICAgICAgICAgICAgaWNvbiA9IEljb24uTWludXM7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gV2hlbiBkZXRhaWwgcGFuZWwgaXMgb3Blbiwgc3VidGl0bGUgaXMgaGlkZGVuIFx1MjAxNCBzaG93IGRlc3QgaW4gYWNjZXNzb3J5IGluc3RlYWQuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlzdEl0ZW1Qcm9wcyA9IGlzU2hvd2luZ0RldGFpbFxuICAgICAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3JpZXM6IFt7IHRleHQ6IHN0YXR1c1RleHQsIGljb24gfV0sXG4gICAgICAgICAgICAgICAgICAgICAgZGV0YWlsOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8TGlzdC5JdGVtLkRldGFpbFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtYXJrZG93bj17YnVpbGREZXRhaWxNYXJrZG93bihmaWxlLCBjLCByZXNvbHZlZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIDoge1xuICAgICAgICAgICAgICAgICAgICAgIHN1YnRpdGxlOlxuICAgICAgICAgICAgICAgICAgICAgICAgYy5zdGF0dXMgPT09IFwicmVhZHlcIiAmJiByZXNvbHZlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICA/IHJlc29sdmVkLmlzTWlzY0ZhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgXHUyMTkyICR7cmVzb2x2ZWQucmVsUGF0aH0gKE1pc2MgZmFsbGJhY2spYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYFx1MjE5MiAke3Jlc29sdmVkLnJlbFBhdGh9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICA6IGMuc3RhdHVzID09PSBcImVycm9yXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGBlcnJvcjogJHtjLm1lc3NhZ2V9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYy5zdGF0dXMgPT09IFwicGVuZGluZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiQ2xhc3NpZnlpbmdcdTIwMjZcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBcIihubyBtYXRjaCBcdTIwMTQgc3RheXMgcHV0KVwiLFxuICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yaWVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IGZvcm1hdEJ5dGVzKGZpbGUuc2l6ZUJ5dGVzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbHRpcDogXCJGaWxlIHNpemVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGljb24gfSxcbiAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgIDxMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICAgICAga2V5PXtmaWxlLmZ1bGxQYXRofVxuICAgICAgICAgICAgICAgICAgICBpY29uPXtJY29uLkRvY3VtZW50fVxuICAgICAgICAgICAgICAgICAgICB0aXRsZT17ZmlsZS5uYW1lfVxuICAgICAgICAgICAgICAgICAgICB7Li4ubGlzdEl0ZW1Qcm9wc31cbiAgICAgICAgICAgICAgICAgICAgYWN0aW9ucz17XG4gICAgICAgICAgICAgICAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAge3Jlc29sdmVkICYmICFyZXNvbHZlZC5pc01pc2NGYWxsYmFjayAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17YE1vdmUgdG8gJHtyZXNvbHZlZC5yZWxQYXRofWB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5BcnJvd1JpZ2h0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW92ZU9uZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWQucmVsUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWQuaXNNaXNjRmFsbGJhY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIHtyZXNvbHZlZCAmJiByZXNvbHZlZC5pc01pc2NGYWxsYmFjayAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17YE1vdmUgdG8gTWlzYyAoJHtyZXNvbHZlZC5yZWxQYXRofSlgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb249e0ljb24uUXVlc3Rpb25NYXJrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW92ZU9uZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWQucmVsUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWQuaXNNaXNjRmFsbGJhY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJNb3ZlIEFsbCAoQ29uZmlkZW50IE1hdGNoZXMgT25seSlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93Q2xvY2t3aXNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGlmaWVyczogW1wiY21kXCIsIFwic2hpZnRcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBcInJldHVyblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gbW92ZUFsbCh7IGluY2x1ZGVNaXNjOiBmYWxzZSB9KX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICB7bWlzY0ZvbGRlck5hbWUgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJNb3ZlIEFsbCAoSW5jbHVkaW5nIE1pc2MgRmFsbGJhY2tzKVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5BcnJvd0Nsb2Nrd2lzZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kaWZpZXJzOiBbXCJjbWRcIiwgXCJvcHRcIl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IFwicmV0dXJuXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gbW92ZUFsbCh7IGluY2x1ZGVNaXNjOiB0cnVlIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJSZWZyZXNoXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5Sb3RhdGVDbG9ja3dpc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCJdLCBrZXk6IFwiclwiIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXtyZWZyZXNofVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzU2hvd2luZ0RldGFpbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIkhpZGUgRGV0YWlsIFBhbmVsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJTaG93IERldGFpbCBQYW5lbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5TaWRlYmFyfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcImRcIiB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gc2V0SXNTaG93aW5nRGV0YWlsKCh2KSA9PiAhdil9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEFjdGlvbi5TaG93SW5GaW5kZXIgcGF0aD17ZmlsZS5mdWxsUGF0aH0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb24uT3BlblxuICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIk9wZW4gRmlsZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD17ZmlsZS5mdWxsUGF0aH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5FeWV9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAge3Jlc29sdmVkICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEFjdGlvbi5PcGVuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJPcGVuIFByb3Bvc2VkIEZvbGRlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0PXtwYXRoLmpvaW4oZmlsZS5zY2FuUm9vdCwgcmVzb2x2ZWQucmVsUGF0aCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5Gb2xkZXJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvQWN0aW9uUGFuZWw+XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICA8L0xpc3QuU2VjdGlvbj5cbiAgICAgICAgICApKX1cbiAgICA8L0xpc3Q+XG4gICk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxnQkFBZTtBQUNmLGtCQUFpQjtBQUVqQixpQkFXTztBQUNQLG1CQUFrRTtBQXFCbEUsSUFBTSx1QkFBdUIsb0JBQUksSUFBSTtBQUFBLEVBQ25DO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGLENBQUM7QUFFRCxTQUFTLFlBQVksVUFBMEI7QUFDN0MsTUFBSSxTQUFTLFdBQVcsSUFBSSxHQUFHO0FBQzdCLFdBQU8sWUFBQUEsUUFBSyxLQUFLLFFBQVEsSUFBSSxRQUFRLElBQUksU0FBUyxNQUFNLENBQUMsQ0FBQztBQUFBLEVBQzVEO0FBQ0EsU0FBTztBQUNUO0FBRUEsU0FBUyxZQUFZLE9BQXVCO0FBQzFDLE1BQUksUUFBUSxLQUFNLFFBQU8sR0FBRyxLQUFLO0FBQ2pDLE1BQUksUUFBUSxPQUFPLEtBQU0sUUFBTyxJQUFJLFFBQVEsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUM1RCxTQUFPLElBQUksU0FBUyxPQUFPLE9BQU8sUUFBUSxDQUFDLENBQUM7QUFDOUM7QUFFQSxTQUFTLGdCQUFnQixLQUFzQztBQUM3RCxRQUFNLFFBQVEsT0FBTywyQkFDbEIsTUFBTSxHQUFHLEVBQ1QsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLFFBQVEsT0FBTyxFQUFFLENBQUMsRUFDcEQsT0FBTyxPQUFPO0FBQ2pCLFNBQU8s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
