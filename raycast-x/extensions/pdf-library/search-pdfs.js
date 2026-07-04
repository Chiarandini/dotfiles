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

// src/search-pdfs.tsx
var search_pdfs_exports = {};
__export(search_pdfs_exports, {
  default: () => SearchPdfs
});
module.exports = __toCommonJS(search_pdfs_exports);
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_util = require("util");
var import_api = require("@raycast/api");
var import_react = require("react");
var execAsync = (0, import_util.promisify)(import_child_process.exec);
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
async function getPdfMetadata(filePath) {
  try {
    const { stdout } = await execAsync(
      `mdls -name kMDItemTitle -name kMDItemAuthors -name kMDItemComment -name kMDItemKeywords -name kMDItemCreator -name kMDItemNumberOfPages "${filePath}"`
    );
    const get = (key) => {
      const match = stdout.match(new RegExp(`${key}\\s*=\\s*(.+)`));
      if (!match) return void 0;
      const val = match[1].trim();
      if (val === "(null)") return void 0;
      return val.replace(/^"|"$/g, "");
    };
    const getList = (key) => {
      const match = stdout.match(
        new RegExp(`${key}\\s*=\\s*\\(([^)]+)\\)`, "s")
      );
      if (!match) return void 0;
      return match[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean).join(", ");
    };
    const pagesRaw = get("kMDItemNumberOfPages");
    const pageCount = pagesRaw ? parseInt(pagesRaw, 10) : void 0;
    return {
      title: get("kMDItemTitle"),
      author: getList("kMDItemAuthors"),
      subject: get("kMDItemComment"),
      keywords: getList("kMDItemKeywords"),
      creator: get("kMDItemCreator"),
      pageCount: isNaN(pageCount ?? NaN) ? void 0 : pageCount
    };
  } catch {
    return {};
  }
}
function findPdfs(dir) {
  const results = [];
  const walk = (current) => {
    let entries;
    try {
      entries = import_fs.default.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = import_path.default.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        try {
          const stat = import_fs.default.statSync(full);
          results.push({
            name: entry.name.replace(/\.pdf$/i, ""),
            fullPath: full,
            relativePath: import_path.default.relative(dir, full),
            sizeBytes: stat.size,
            modifiedAt: stat.mtime
          });
        } catch {
        }
      }
    }
  };
  walk(dir);
  return results;
}
function fuzzyScore(query, target) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      const boundary = ti === 0 || " /_-".includes(t[ti - 1]);
      score += 1 + consecutive + (boundary ? 5 : 0);
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : null;
}
function buildDetailMarkdown(pdf, meta) {
  const title = meta?.title && meta.title !== pdf.name ? meta.title : pdf.name;
  return [
    `# ${title}`,
    "",
    meta?.author ? `**Author:** ${meta.author}` : null,
    meta?.subject ? `**Subject:** ${meta.subject}` : null,
    meta?.keywords ? `**Keywords:** ${meta.keywords}` : null,
    meta?.creator ? `**Created with:** ${meta.creator}` : null,
    "",
    "---",
    "",
    `**File:** \`${pdf.relativePath}\``,
    `**Size:** ${formatBytes(pdf.sizeBytes)}`,
    meta?.pageCount ? `**Pages:** ${meta.pageCount}` : null,
    `**Modified:** ${pdf.modifiedAt.toLocaleDateString()} ${pdf.modifiedAt.toLocaleTimeString()}`
  ].filter((l) => l !== null).join("\n");
}
function SearchPdfs() {
  const { libraryPath } = (0, import_api.getPreferenceValues)();
  const resolvedPath = expandTilde(libraryPath);
  const [pdfs, setPdfs] = (0, import_react.useState)([]);
  const [metadata, setMetadata] = (0, import_react.useState)(/* @__PURE__ */ new Map());
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const [searchText, setSearchText] = (0, import_react.useState)("");
  const [isShowingDetail, setIsShowingDetail] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    if (!import_fs.default.existsSync(resolvedPath)) {
      (0, import_api.showToast)({
        style: import_api.Toast.Style.Failure,
        title: "Directory not found",
        message: resolvedPath
      });
      setIsLoading(false);
      return;
    }
    const found = findPdfs(resolvedPath);
    found.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    setPdfs(found);
    setIsLoading(false);
  }, [resolvedPath]);
  (0, import_react.useEffect)(() => {
    if (pdfs.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const pdf of pdfs) {
        if (cancelled) break;
        const meta = await getPdfMetadata(pdf.fullPath);
        if (!cancelled) {
          setMetadata((prev) => new Map(prev).set(pdf.fullPath, meta));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfs]);
  const filtered = searchText ? pdfs.map((p) => {
    const nameScore = fuzzyScore(searchText, p.name);
    const pathScore = fuzzyScore(searchText, p.relativePath);
    const best = nameScore !== null && pathScore !== null ? Math.max(nameScore * 2, pathScore) : nameScore !== null ? nameScore * 2 : pathScore !== null ? pathScore : null;
    return { pdf: p, score: best };
  }).filter((r) => r.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((r) => r.pdf) : pdfs;
  const groups = /* @__PURE__ */ new Map();
  if (!searchText) {
    for (const pdf of filtered) {
      const parts = pdf.relativePath.split(import_path.default.sep);
      const group = parts.length > 1 ? parts[0] : "(root)";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(pdf);
    }
  } else {
    groups.set("", filtered);
  }
  return /* @__PURE__ */ _jsx(
    import_api.List,
    {
      isLoading,
      onSearchTextChange: setSearchText,
      searchBarPlaceholder: "Search PDFs by name or path\u2026",
      isShowingDetail,
      throttle: true
    },
    [...groups.entries()].map(([group, items]) => /* @__PURE__ */ _jsx(
      import_api.List.Section,
      {
        key: group,
        title: group,
        subtitle: group ? `${items.length} PDF${items.length !== 1 ? "s" : ""}` : void 0
      },
      items.map((pdf) => {
        const meta = metadata.get(pdf.fullPath);
        const texPath = pdf.fullPath.replace(/\.pdf$/i, ".tex");
        const hasTexFile = import_fs.default.existsSync(texPath);
        const dir = import_path.default.dirname(pdf.fullPath);
        return /* @__PURE__ */ _jsx(
          import_api.List.Item,
          {
            key: pdf.fullPath,
            icon: import_api.Icon.Document,
            title: pdf.name,
            subtitle: import_path.default.dirname(pdf.relativePath) === "." ? void 0 : import_path.default.dirname(pdf.relativePath),
            accessories: [
              ...meta?.pageCount ? [{ text: `${meta.pageCount}p`, tooltip: "Pages" }] : [],
              { text: formatBytes(pdf.sizeBytes), tooltip: "File size" }
            ],
            detail: /* @__PURE__ */ _jsx(
              import_api.List.Item.Detail,
              {
                isLoading: meta === void 0,
                markdown: buildDetailMarkdown(pdf, meta)
              }
            ),
            actions: /* @__PURE__ */ _jsx(import_api.ActionPanel, null, /* @__PURE__ */ _jsx(
              import_api.Action.Open,
              {
                title: "Open PDF",
                target: pdf.fullPath,
                icon: import_api.Icon.Document
              }
            ), hasTexFile ? /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: "Copy .tex Path",
                icon: import_api.Icon.Clipboard,
                shortcut: { modifiers: ["cmd"], key: "return" },
                onAction: async () => {
                  await import_api.Clipboard.copy(texPath);
                  await (0, import_api.showHUD)(`Copied: ${import_path.default.basename(texPath)}`);
                }
              }
            ) : /* @__PURE__ */ _jsx(
              import_api.Action.Open,
              {
                title: "Open Containing Folder",
                target: dir,
                icon: import_api.Icon.Folder,
                shortcut: { modifiers: ["cmd"], key: "return" }
              }
            ), /* @__PURE__ */ _jsx(import_api.Action.ShowInFinder, { path: pdf.fullPath }), /* @__PURE__ */ _jsx(
              import_api.Action.CopyToClipboard,
              {
                title: "Copy PDF Path",
                content: pdf.fullPath,
                icon: import_api.Icon.Clipboard
              }
            ), /* @__PURE__ */ _jsx(
              import_api.Action,
              {
                title: isShowingDetail ? "Hide Detail Panel" : "Show Detail Panel",
                icon: import_api.Icon.Sidebar,
                shortcut: { modifiers: ["cmd"], key: "d" },
                onAction: () => setIsShowingDetail((v) => !v)
              }
            ))
          }
        );
      })
    ))
  );
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvcGRmLWxpYnJhcnkvc3JjL3NlYXJjaC1wZGZzLnRzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSBcInV0aWxcIjtcblxuaW1wb3J0IHtcbiAgQWN0aW9uLFxuICBBY3Rpb25QYW5lbCxcbiAgQ2xpcGJvYXJkLFxuICBnZXRQcmVmZXJlbmNlVmFsdWVzLFxuICBJY29uLFxuICBMaXN0LFxuICBzaG93SFVELFxuICBzaG93VG9hc3QsXG4gIFRvYXN0LFxufSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSBcInJlYWN0XCI7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuaW50ZXJmYWNlIFByZWZlcmVuY2VzIHtcbiAgbGlicmFyeVBhdGg6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFBkZkZpbGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIGZ1bGxQYXRoOiBzdHJpbmc7XG4gIHJlbGF0aXZlUGF0aDogc3RyaW5nO1xuICBzaXplQnl0ZXM6IG51bWJlcjtcbiAgbW9kaWZpZWRBdDogRGF0ZTtcbn1cblxuaW50ZXJmYWNlIFBkZk1ldGFkYXRhIHtcbiAgcGFnZUNvdW50PzogbnVtYmVyO1xuICB0aXRsZT86IHN0cmluZztcbiAgYXV0aG9yPzogc3RyaW5nO1xuICBzdWJqZWN0Pzogc3RyaW5nO1xuICBrZXl3b3Jkcz86IHN0cmluZztcbiAgY3JlYXRvcj86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gZXhwYW5kVGlsZGUoZmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChmaWxlUGF0aC5zdGFydHNXaXRoKFwifi9cIikpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHByb2Nlc3MuZW52LkhPTUUgPz8gXCJcIiwgZmlsZVBhdGguc2xpY2UoMikpO1xuICB9XG4gIHJldHVybiBmaWxlUGF0aDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0Qnl0ZXMoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChieXRlcyA8IDEwMjQpIHJldHVybiBgJHtieXRlc30gQmA7XG4gIGlmIChieXRlcyA8IDEwMjQgKiAxMDI0KSByZXR1cm4gYCR7KGJ5dGVzIC8gMTAyNCkudG9GaXhlZCgxKX0gS0JgO1xuICByZXR1cm4gYCR7KGJ5dGVzIC8gKDEwMjQgKiAxMDI0KSkudG9GaXhlZCgxKX0gTUJgO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRQZGZNZXRhZGF0YShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxQZGZNZXRhZGF0YT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoXG4gICAgICBgbWRscyAtbmFtZSBrTURJdGVtVGl0bGUgLW5hbWUga01ESXRlbUF1dGhvcnMgLW5hbWUga01ESXRlbUNvbW1lbnQgLW5hbWUga01ESXRlbUtleXdvcmRzIC1uYW1lIGtNREl0ZW1DcmVhdG9yIC1uYW1lIGtNREl0ZW1OdW1iZXJPZlBhZ2VzIFwiJHtmaWxlUGF0aH1cImAsXG4gICAgKTtcblxuICAgIGNvbnN0IGdldCA9IChrZXk6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICBjb25zdCBtYXRjaCA9IHN0ZG91dC5tYXRjaChuZXcgUmVnRXhwKGAke2tleX1cXFxccyo9XFxcXHMqKC4rKWApKTtcbiAgICAgIGlmICghbWF0Y2gpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICBjb25zdCB2YWwgPSBtYXRjaFsxXS50cmltKCk7XG4gICAgICBpZiAodmFsID09PSBcIihudWxsKVwiKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgcmV0dXJuIHZhbC5yZXBsYWNlKC9eXCJ8XCIkL2csIFwiXCIpO1xuICAgIH07XG5cbiAgICBjb25zdCBnZXRMaXN0ID0gKGtleTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcbiAgICAgIGNvbnN0IG1hdGNoID0gc3Rkb3V0Lm1hdGNoKFxuICAgICAgICBuZXcgUmVnRXhwKGAke2tleX1cXFxccyo9XFxcXHMqXFxcXCgoW14pXSspXFxcXClgLCBcInNcIiksXG4gICAgICApO1xuICAgICAgaWYgKCFtYXRjaCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBtYXRjaFsxXVxuICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgIC5tYXAoKHMpID0+IHMudHJpbSgpLnJlcGxhY2UoL15cInxcIiQvZywgXCJcIikpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgLmpvaW4oXCIsIFwiKTtcbiAgICB9O1xuXG4gICAgY29uc3QgcGFnZXNSYXcgPSBnZXQoXCJrTURJdGVtTnVtYmVyT2ZQYWdlc1wiKTtcbiAgICBjb25zdCBwYWdlQ291bnQgPSBwYWdlc1JhdyA/IHBhcnNlSW50KHBhZ2VzUmF3LCAxMCkgOiB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdGl0bGU6IGdldChcImtNREl0ZW1UaXRsZVwiKSxcbiAgICAgIGF1dGhvcjogZ2V0TGlzdChcImtNREl0ZW1BdXRob3JzXCIpLFxuICAgICAgc3ViamVjdDogZ2V0KFwia01ESXRlbUNvbW1lbnRcIiksXG4gICAgICBrZXl3b3JkczogZ2V0TGlzdChcImtNREl0ZW1LZXl3b3Jkc1wiKSxcbiAgICAgIGNyZWF0b3I6IGdldChcImtNREl0ZW1DcmVhdG9yXCIpLFxuICAgICAgcGFnZUNvdW50OiBpc05hTihwYWdlQ291bnQgPz8gTmFOKSA/IHVuZGVmaW5lZCA6IHBhZ2VDb3VudCxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4ge307XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZFBkZnMoZGlyOiBzdHJpbmcpOiBQZGZGaWxlW10ge1xuICBjb25zdCByZXN1bHRzOiBQZGZGaWxlW10gPSBbXTtcblxuICBjb25zdCB3YWxrID0gKGN1cnJlbnQ6IHN0cmluZykgPT4ge1xuICAgIGxldCBlbnRyaWVzOiBmcy5EaXJlbnRbXTtcbiAgICB0cnkge1xuICAgICAgZW50cmllcyA9IGZzLnJlYWRkaXJTeW5jKGN1cnJlbnQsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICBjb25zdCBmdWxsID0gcGF0aC5qb2luKGN1cnJlbnQsIGVudHJ5Lm5hbWUpO1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgd2FsayhmdWxsKTtcbiAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkgJiYgZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwiLnBkZlwiKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsKTtcbiAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogZW50cnkubmFtZS5yZXBsYWNlKC9cXC5wZGYkL2ksIFwiXCIpLFxuICAgICAgICAgICAgZnVsbFBhdGg6IGZ1bGwsXG4gICAgICAgICAgICByZWxhdGl2ZVBhdGg6IHBhdGgucmVsYXRpdmUoZGlyLCBmdWxsKSxcbiAgICAgICAgICAgIHNpemVCeXRlczogc3RhdC5zaXplLFxuICAgICAgICAgICAgbW9kaWZpZWRBdDogc3RhdC5tdGltZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc2tpcCB1bnJlYWRhYmxlIGZpbGVzXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgd2FsayhkaXIpO1xuICByZXR1cm4gcmVzdWx0cztcbn1cblxuLy8gUmV0dXJucyBhIHNjb3JlID4gMCBpZiBldmVyeSBjaGFyYWN0ZXIgaW4gYHF1ZXJ5YCBhcHBlYXJzIGluIG9yZGVyIGluIGB0YXJnZXRgLCBlbHNlIG51bGwuXG4vLyBDb25zZWN1dGl2ZSBhbmQgd29yZC1ib3VuZGFyeSBtYXRjaGVzIHNjb3JlIGhpZ2hlci5cbmZ1bmN0aW9uIGZ1enp5U2NvcmUocXVlcnk6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgaWYgKCFxdWVyeSkgcmV0dXJuIDA7XG4gIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCB0ID0gdGFyZ2V0LnRvTG93ZXJDYXNlKCk7XG4gIGxldCBxaSA9IDA7XG4gIGxldCBzY29yZSA9IDA7XG4gIGxldCBjb25zZWN1dGl2ZSA9IDA7XG4gIGZvciAobGV0IHRpID0gMDsgdGkgPCB0Lmxlbmd0aCAmJiBxaSA8IHEubGVuZ3RoOyB0aSsrKSB7XG4gICAgaWYgKHRbdGldID09PSBxW3FpXSkge1xuICAgICAgLy8gYm9udXMgZm9yIGNvbnNlY3V0aXZlIGNoYXJzIGFuZCB3b3JkIGJvdW5kYXJpZXMgKGFmdGVyIHNwYWNlLCAvLCBfLCAtKVxuICAgICAgY29uc3QgYm91bmRhcnkgPSB0aSA9PT0gMCB8fCBcIiAvXy1cIi5pbmNsdWRlcyh0W3RpIC0gMV0pO1xuICAgICAgc2NvcmUgKz0gMSArIGNvbnNlY3V0aXZlICsgKGJvdW5kYXJ5ID8gNSA6IDApO1xuICAgICAgY29uc2VjdXRpdmUrKztcbiAgICAgIHFpKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNlY3V0aXZlID0gMDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHFpID09PSBxLmxlbmd0aCA/IHNjb3JlIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gYnVpbGREZXRhaWxNYXJrZG93bihcbiAgcGRmOiBQZGZGaWxlLFxuICBtZXRhOiBQZGZNZXRhZGF0YSB8IHVuZGVmaW5lZCxcbik6IHN0cmluZyB7XG4gIGNvbnN0IHRpdGxlID0gbWV0YT8udGl0bGUgJiYgbWV0YS50aXRsZSAhPT0gcGRmLm5hbWUgPyBtZXRhLnRpdGxlIDogcGRmLm5hbWU7XG4gIHJldHVybiBbXG4gICAgYCMgJHt0aXRsZX1gLFxuICAgIFwiXCIsXG4gICAgbWV0YT8uYXV0aG9yID8gYCoqQXV0aG9yOioqICR7bWV0YS5hdXRob3J9YCA6IG51bGwsXG4gICAgbWV0YT8uc3ViamVjdCA/IGAqKlN1YmplY3Q6KiogJHttZXRhLnN1YmplY3R9YCA6IG51bGwsXG4gICAgbWV0YT8ua2V5d29yZHMgPyBgKipLZXl3b3JkczoqKiAke21ldGEua2V5d29yZHN9YCA6IG51bGwsXG4gICAgbWV0YT8uY3JlYXRvciA/IGAqKkNyZWF0ZWQgd2l0aDoqKiAke21ldGEuY3JlYXRvcn1gIDogbnVsbCxcbiAgICBcIlwiLFxuICAgIFwiLS0tXCIsXG4gICAgXCJcIixcbiAgICBgKipGaWxlOioqIFxcYCR7cGRmLnJlbGF0aXZlUGF0aH1cXGBgLFxuICAgIGAqKlNpemU6KiogJHtmb3JtYXRCeXRlcyhwZGYuc2l6ZUJ5dGVzKX1gLFxuICAgIG1ldGE/LnBhZ2VDb3VudCA/IGAqKlBhZ2VzOioqICR7bWV0YS5wYWdlQ291bnR9YCA6IG51bGwsXG4gICAgYCoqTW9kaWZpZWQ6KiogJHtwZGYubW9kaWZpZWRBdC50b0xvY2FsZURhdGVTdHJpbmcoKX0gJHtwZGYubW9kaWZpZWRBdC50b0xvY2FsZVRpbWVTdHJpbmcoKX1gLFxuICBdXG4gICAgLmZpbHRlcigobCkgPT4gbCAhPT0gbnVsbClcbiAgICAuam9pbihcIlxcblwiKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gU2VhcmNoUGRmcygpIHtcbiAgY29uc3QgeyBsaWJyYXJ5UGF0aCB9ID0gZ2V0UHJlZmVyZW5jZVZhbHVlczxQcmVmZXJlbmNlcz4oKTtcbiAgY29uc3QgcmVzb2x2ZWRQYXRoID0gZXhwYW5kVGlsZGUobGlicmFyeVBhdGgpO1xuXG4gIGNvbnN0IFtwZGZzLCBzZXRQZGZzXSA9IHVzZVN0YXRlPFBkZkZpbGVbXT4oW10pO1xuICBjb25zdCBbbWV0YWRhdGEsIHNldE1ldGFkYXRhXSA9IHVzZVN0YXRlPE1hcDxzdHJpbmcsIFBkZk1ldGFkYXRhPj4obmV3IE1hcCgpKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbc2VhcmNoVGV4dCwgc2V0U2VhcmNoVGV4dF0gPSB1c2VTdGF0ZShcIlwiKTtcbiAgY29uc3QgW2lzU2hvd2luZ0RldGFpbCwgc2V0SXNTaG93aW5nRGV0YWlsXSA9IHVzZVN0YXRlKHRydWUpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgIHNob3dUb2FzdCh7XG4gICAgICAgIHN0eWxlOiBUb2FzdC5TdHlsZS5GYWlsdXJlLFxuICAgICAgICB0aXRsZTogXCJEaXJlY3Rvcnkgbm90IGZvdW5kXCIsXG4gICAgICAgIG1lc3NhZ2U6IHJlc29sdmVkUGF0aCxcbiAgICAgIH0pO1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgZm91bmQgPSBmaW5kUGRmcyhyZXNvbHZlZFBhdGgpO1xuICAgIGZvdW5kLnNvcnQoKGEsIGIpID0+IGIubW9kaWZpZWRBdC5nZXRUaW1lKCkgLSBhLm1vZGlmaWVkQXQuZ2V0VGltZSgpKTtcbiAgICBzZXRQZGZzKGZvdW5kKTtcbiAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICB9LCBbcmVzb2x2ZWRQYXRoXSk7XG5cbiAgLy8gTG9hZCBtZXRhZGF0YSBpbiB0aGUgYmFja2dyb3VuZCwgb25lIGF0IGEgdGltZSBzbyB3ZSBkb24ndCBzcGF3biBodW5kcmVkcyBvZiBwcm9jZXNzZXNcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocGRmcy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG5cbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBwZGYgb2YgcGRmcykge1xuICAgICAgICBpZiAoY2FuY2VsbGVkKSBicmVhaztcbiAgICAgICAgY29uc3QgbWV0YSA9IGF3YWl0IGdldFBkZk1ldGFkYXRhKHBkZi5mdWxsUGF0aCk7XG4gICAgICAgIGlmICghY2FuY2VsbGVkKSB7XG4gICAgICAgICAgc2V0TWV0YWRhdGEoKHByZXYpID0+IG5ldyBNYXAocHJldikuc2V0KHBkZi5mdWxsUGF0aCwgbWV0YSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkoKTtcblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgIH07XG4gIH0sIFtwZGZzXSk7XG5cbiAgLy8gV2hlbiBzZWFyY2hpbmc6IGZ1enp5LW1hdGNoIGFnYWluc3QgbmFtZSAod2VpZ2h0ZWQgMlx1MDBENykgYW5kIGZ1bGwgcGF0aCwgc29ydCBieSBzY29yZSBkZXNjZW5kaW5nLlxuICAvLyBXaGVuIG5vdCBzZWFyY2hpbmc6IGtlZXAgb3JpZ2luYWwgcmVjZW5jeSBvcmRlciwgZ3JvdXAgYnkgdG9wLWxldmVsIGRpcmVjdG9yeS5cbiAgY29uc3QgZmlsdGVyZWQ6IFBkZkZpbGVbXSA9IHNlYXJjaFRleHRcbiAgICA/IHBkZnNcbiAgICAgICAgLm1hcCgocCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5hbWVTY29yZSA9IGZ1enp5U2NvcmUoc2VhcmNoVGV4dCwgcC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBwYXRoU2NvcmUgPSBmdXp6eVNjb3JlKHNlYXJjaFRleHQsIHAucmVsYXRpdmVQYXRoKTtcbiAgICAgICAgICBjb25zdCBiZXN0ID1cbiAgICAgICAgICAgIG5hbWVTY29yZSAhPT0gbnVsbCAmJiBwYXRoU2NvcmUgIT09IG51bGxcbiAgICAgICAgICAgICAgPyBNYXRoLm1heChuYW1lU2NvcmUgKiAyLCBwYXRoU2NvcmUpXG4gICAgICAgICAgICAgIDogbmFtZVNjb3JlICE9PSBudWxsXG4gICAgICAgICAgICAgICAgPyBuYW1lU2NvcmUgKiAyXG4gICAgICAgICAgICAgICAgOiBwYXRoU2NvcmUgIT09IG51bGxcbiAgICAgICAgICAgICAgICAgID8gcGF0aFNjb3JlXG4gICAgICAgICAgICAgICAgICA6IG51bGw7XG4gICAgICAgICAgcmV0dXJuIHsgcGRmOiBwLCBzY29yZTogYmVzdCB9O1xuICAgICAgICB9KVxuICAgICAgICAuZmlsdGVyKChyKSA9PiByLnNjb3JlICE9PSBudWxsKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gKGIuc2NvcmUgPz8gMCkgLSAoYS5zY29yZSA/PyAwKSlcbiAgICAgICAgLm1hcCgocikgPT4gci5wZGYpXG4gICAgOiBwZGZzO1xuXG4gIC8vIEdyb3VwIG9ubHkgd2hlbiBub3Qgc2VhcmNoaW5nIChzZWFyY2ggcmVzdWx0cyBhcmUgcmFua2VkLCBncm91cGluZyB3b3VsZCBiZSBtaXNsZWFkaW5nKVxuICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgUGRmRmlsZVtdPigpO1xuICBpZiAoIXNlYXJjaFRleHQpIHtcbiAgICBmb3IgKGNvbnN0IHBkZiBvZiBmaWx0ZXJlZCkge1xuICAgICAgY29uc3QgcGFydHMgPSBwZGYucmVsYXRpdmVQYXRoLnNwbGl0KHBhdGguc2VwKTtcbiAgICAgIGNvbnN0IGdyb3VwID0gcGFydHMubGVuZ3RoID4gMSA/IHBhcnRzWzBdIDogXCIocm9vdClcIjtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhncm91cCkpIGdyb3Vwcy5zZXQoZ3JvdXAsIFtdKTtcbiAgICAgIGdyb3Vwcy5nZXQoZ3JvdXApIS5wdXNoKHBkZik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGdyb3Vwcy5zZXQoXCJcIiwgZmlsdGVyZWQpO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8TGlzdFxuICAgICAgaXNMb2FkaW5nPXtpc0xvYWRpbmd9XG4gICAgICBvblNlYXJjaFRleHRDaGFuZ2U9e3NldFNlYXJjaFRleHR9XG4gICAgICBzZWFyY2hCYXJQbGFjZWhvbGRlcj1cIlNlYXJjaCBQREZzIGJ5IG5hbWUgb3IgcGF0aFx1MjAyNlwiXG4gICAgICBpc1Nob3dpbmdEZXRhaWw9e2lzU2hvd2luZ0RldGFpbH1cbiAgICAgIHRocm90dGxlXG4gICAgPlxuICAgICAge1suLi5ncm91cHMuZW50cmllcygpXS5tYXAoKFtncm91cCwgaXRlbXNdKSA9PiAoXG4gICAgICAgIDxMaXN0LlNlY3Rpb25cbiAgICAgICAgICBrZXk9e2dyb3VwfVxuICAgICAgICAgIHRpdGxlPXtncm91cH1cbiAgICAgICAgICBzdWJ0aXRsZT17XG4gICAgICAgICAgICBncm91cFxuICAgICAgICAgICAgICA/IGAke2l0ZW1zLmxlbmd0aH0gUERGJHtpdGVtcy5sZW5ndGggIT09IDEgPyBcInNcIiA6IFwiXCJ9YFxuICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgIH1cbiAgICAgICAgPlxuICAgICAgICAgIHtpdGVtcy5tYXAoKHBkZikgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWV0YSA9IG1ldGFkYXRhLmdldChwZGYuZnVsbFBhdGgpO1xuICAgICAgICAgICAgY29uc3QgdGV4UGF0aCA9IHBkZi5mdWxsUGF0aC5yZXBsYWNlKC9cXC5wZGYkL2ksIFwiLnRleFwiKTtcbiAgICAgICAgICAgIGNvbnN0IGhhc1RleEZpbGUgPSBmcy5leGlzdHNTeW5jKHRleFBhdGgpO1xuICAgICAgICAgICAgY29uc3QgZGlyID0gcGF0aC5kaXJuYW1lKHBkZi5mdWxsUGF0aCk7XG5cbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICBrZXk9e3BkZi5mdWxsUGF0aH1cbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkRvY3VtZW50fVxuICAgICAgICAgICAgICAgIHRpdGxlPXtwZGYubmFtZX1cbiAgICAgICAgICAgICAgICBzdWJ0aXRsZT17XG4gICAgICAgICAgICAgICAgICBwYXRoLmRpcm5hbWUocGRmLnJlbGF0aXZlUGF0aCkgPT09IFwiLlwiXG4gICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIDogcGF0aC5kaXJuYW1lKHBkZi5yZWxhdGl2ZVBhdGgpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFjY2Vzc29yaWVzPXtbXG4gICAgICAgICAgICAgICAgICAuLi4obWV0YT8ucGFnZUNvdW50XG4gICAgICAgICAgICAgICAgICAgID8gW3sgdGV4dDogYCR7bWV0YS5wYWdlQ291bnR9cGAsIHRvb2x0aXA6IFwiUGFnZXNcIiB9XVxuICAgICAgICAgICAgICAgICAgICA6IFtdKSxcbiAgICAgICAgICAgICAgICAgIHsgdGV4dDogZm9ybWF0Qnl0ZXMocGRmLnNpemVCeXRlcyksIHRvb2x0aXA6IFwiRmlsZSBzaXplXCIgfSxcbiAgICAgICAgICAgICAgICBdfVxuICAgICAgICAgICAgICAgIGRldGFpbD17XG4gICAgICAgICAgICAgICAgICA8TGlzdC5JdGVtLkRldGFpbFxuICAgICAgICAgICAgICAgICAgICBpc0xvYWRpbmc9e21ldGEgPT09IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgICAgbWFya2Rvd249e2J1aWxkRGV0YWlsTWFya2Rvd24ocGRmLCBtZXRhKX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFjdGlvbnM9e1xuICAgICAgICAgICAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgICAgICAgICAgICA8QWN0aW9uLk9wZW5cbiAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIk9wZW4gUERGXCJcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ9e3BkZi5mdWxsUGF0aH1cbiAgICAgICAgICAgICAgICAgICAgICBpY29uPXtJY29uLkRvY3VtZW50fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICB7aGFzVGV4RmlsZSA/IChcbiAgICAgICAgICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkNvcHkgLnRleCBQYXRoXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGljb249e0ljb24uQ2xpcGJvYXJkfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIl0sIGtleTogXCJyZXR1cm5cIiB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgb25BY3Rpb249e2FzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgQ2xpcGJvYXJkLmNvcHkodGV4UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNob3dIVUQoYENvcGllZDogJHtwYXRoLmJhc2VuYW1lKHRleFBhdGgpfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgIDxBY3Rpb24uT3BlblxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJPcGVuIENvbnRhaW5pbmcgRm9sZGVyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldD17ZGlyfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5Gb2xkZXJ9XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcInJldHVyblwiIH19XG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPEFjdGlvbi5TaG93SW5GaW5kZXIgcGF0aD17cGRmLmZ1bGxQYXRofSAvPlxuICAgICAgICAgICAgICAgICAgICA8QWN0aW9uLkNvcHlUb0NsaXBib2FyZFxuICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiQ29weSBQREYgUGF0aFwiXG4gICAgICAgICAgICAgICAgICAgICAgY29udGVudD17cGRmLmZ1bGxQYXRofVxuICAgICAgICAgICAgICAgICAgICAgIGljb249e0ljb24uQ2xpcGJvYXJkfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgdGl0bGU9e1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNTaG93aW5nRGV0YWlsXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJIaWRlIERldGFpbCBQYW5lbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJTaG93IERldGFpbCBQYW5lbFwiXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGljb249e0ljb24uU2lkZWJhcn1cbiAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcImRcIiB9fVxuICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PiBzZXRJc1Nob3dpbmdEZXRhaWwoKHYpID0+ICF2KX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDwvQWN0aW9uUGFuZWw+XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9MaXN0LlNlY3Rpb24+XG4gICAgICApKX1cbiAgICA8L0xpc3Q+XG4gICk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBcUI7QUFDckIsZ0JBQWU7QUFDZixrQkFBaUI7QUFDakIs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QVMsWUFBWTtBQUFBLFlBQzNEO0FBQUEsWUFDQSxRQUNFO0FBQUEsY0FBQyxnQkFBSyxLQUFLO0FBQUEsY0FBVjtBQUFBLGdCQUNDLFdBQVcsU0FBUztBQUFBLGdCQUNwQixVQUFVLG9CQUFvQixLQUFLLElBQUk7QUFBQTtBQUFBLFlBQ3pDO0FBQUEsWUFFRixTQUNFLHFCQUFDLDhCQUNDO0FBQUEsY0FBQyxrQkFBTztBQUFBLGNBQVA7QUFBQSxnQkFDQyxPQUFNO0FBQUEsZ0JBQ04sUUFBUSxJQUFJO0FBQUEsZ0JBQ1osTUFBTSxnQkFBSztBQUFBO0FBQUEsWUFDYixHQUNDLGFBQ0M7QUFBQSxjQUFDO0FBQUE7QUFBQSxnQkFDQyxPQUFNO0FBQUEsZ0JBQ04sTUFBTSxnQkFBSztBQUFBLGdCQUNYLFVBQVUsRUFBRSxXQUFXLENBQUMsS0FBSyxHQUFHLEtBQUssU0FBUztBQUFBLGdCQUM5QyxVQUFVLFlBQVk7QUFDcEIsd0JBQU0scUJBQVUsS0FBSyxPQUFPO0FBQzVCLDRCQUFNLG9CQUFRLFdBQVcsWUFBQUEsUUFBSyxTQUFTLE9BQU8sQ0FBQyxFQUFFO0FBQUEsZ0JBQ25EO0FBQUE7QUFBQSxZQUNGLElBRUE7QUFBQSxjQUFDLGtCQUFPO0FBQUEsY0FBUDtBQUFBLGdCQUNDLE9BQU07QUFBQSxnQkFDTixRQUFRO0FBQUEsZ0JBQ1IsTUFBTSxnQkFBSztBQUFBLGdCQUNYLFVBQVUsRUFBRSxXQUFXLENBQUMsS0FBSyxHQUFHLEtBQUssU0FBUztBQUFBO0FBQUEsWUFDaEQsR0FFRixxQkFBQyxrQkFBTyxjQUFQLEVBQW9CLE1BQU0sSUFBSSxVQUFVLEdBQ3pDO0FBQUEsY0FBQyxrQkFBTztBQUFBLGNBQVA7QUFBQSxnQkFDQyxPQUFNO0FBQUEsZ0JBQ04sU0FBUyxJQUFJO0FBQUEsZ0JBQ2IsTUFBTSxnQkFBSztBQUFBO0FBQUEsWUFDYixHQUNBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsT0FDRSxrQkFDSSxzQkFDQTtBQUFBLGdCQUVOLE1BQU0sZ0JBQUs7QUFBQSxnQkFDWCxVQUFVLEVBQUUsV0FBVyxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUk7QUFBQSxnQkFDekMsVUFBVSxNQUFNLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQUE7QUFBQSxZQUM5QyxDQUNGO0FBQUE7QUFBQSxRQUVKO0FBQUEsTUFFSixDQUFDO0FBQUEsSUFDSCxDQUNEO0FBQUEsRUFDSDtBQUVKOyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImZzIl0KfQo=
