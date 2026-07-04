"use strict";
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

// src/network-history.tsx
var network_history_exports = {};
__export(network_history_exports, {
  default: () => Command
});
module.exports = __toCommonJS(network_history_exports);
var import_api4 = require("@raycast/api");
var import_react2 = require("react");
var import_node_path2 = __toESM(require("node:path"));

// src/hooks/useHistory.ts
var import_react = require("react");

// src/storage/historyStore.ts
var import_api = require("@raycast/api");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));
var HISTORY_FILENAME = "history.jsonl";
function createHistoryStore() {
  const filePath = import_node_path.default.join(import_api.environment.supportPath, HISTORY_FILENAME);
  return {
    async append(entry) {
      await import_node_fs.promises.mkdir(import_node_path.default.dirname(filePath), { recursive: true });
      await import_node_fs.promises.appendFile(filePath, JSON.stringify(entry) + "\n", "utf8");
    },
    async readAll() {
      let contents;
      try {
        contents = await import_node_fs.promises.readFile(filePath, "utf8");
      } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
      }
      const entries = [];
      for (const line of contents.split("\n")) {
        if (!line.trim()) continue;
        try {
          entries.push(JSON.parse(line));
        } catch {
        }
      }
      return entries.sort((a, b) => b.finishedAt - a.finishedAt);
    },
    async clear() {
      try {
        await import_node_fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    },
    filePath() {
      return filePath;
    }
  };
}

// src/hooks/useHistory.ts
function useHistory(store) {
  const storeRef = (0, import_react.useRef)(store ?? createHistoryStore());
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)(null);
  const reload = (0, import_react.useCallback)(async () => {
    setIsLoading(true);
    try {
      const all = await storeRef.current.readAll();
      setEntries(all);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read history");
    } finally {
      setIsLoading(false);
    }
  }, []);
  const clear = (0, import_react.useCallback)(async () => {
    await storeRef.current.clear();
    await reload();
  }, [reload]);
  (0, import_react.useEffect)(() => {
    void reload();
  }, [reload]);
  return {
    entries,
    isLoading,
    error,
    reload,
    clear,
    filePath: storeRef.current.filePath()
  };
}

// src/views/HistoryEntryDetail.tsx
var import_api3 = require("@raycast/api");

// src/lib/format.ts
function formatThroughput(bitsPerSec) {
  if (bitsPerSec === null) return "\u2014";
  const mbps = bitsPerSec / 1e6;
  if (mbps >= 1e3) return `${(mbps / 1e3).toFixed(2)} Gbps`;
  if (mbps >= 100) return `${mbps.toFixed(0)} Mbps`;
  if (mbps >= 10) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(2)} Mbps`;
}
function formatLatency(ms) {
  if (ms === null) return "\u2014";
  return ms >= 10 ? `${ms.toFixed(0)} ms` : `${ms.toFixed(1)} ms`;
}
function modeLabel(mode) {
  switch (mode) {
    case "parallel":
      return "Parallel (down + up)";
    case "sequential":
      return "Sequential";
    case "download":
      return "Download only";
    case "upload":
      return "Upload only";
  }
}
function formatResponsiveness(rpm, tier) {
  if (rpm === null || tier === null) return "\u2014";
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `${label} (${rpm.toFixed(0)} RPM)`;
}
function formatElapsed(ms) {
  const seconds = ms / 1e3;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}
function formatRelativeTime(ts, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ts) / 1e3));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// src/lib/speed.ts
var TIER_THRESHOLDS_MBPS = [
  { tier: "excellent", min: 1e3 },
  { tier: "great", min: 200 },
  { tier: "good", min: 50 },
  { tier: "ok", min: 10 },
  { tier: "poor", min: 0 }
];
function classifySpeed(bps) {
  const mbps = bps / 1e6;
  return TIER_THRESHOLDS_MBPS.find((t) => mbps >= t.min).tier;
}
function speedTierLabel(tier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
function downloadContext(tier) {
  switch (tier) {
    case "poor":
      return "may struggle with HD video";
    case "ok":
      return "HD streaming, video calls fine";
    case "good":
      return "4K streaming, multi-device";
    case "great":
      return "multi-4K, fast large downloads";
    case "excellent":
      return "gigabit-class connection";
  }
}
function uploadContext(tier) {
  switch (tier) {
    case "poor":
      return "video calls may stutter";
    case "ok":
      return "HD video calls OK";
    case "good":
      return "high-quality live streaming";
    case "great":
      return "professional streaming, large uploads";
    case "excellent":
      return "symmetric gigabit";
  }
}
var METER_WIDTH = 28;
var LOG_MIN = 0;
var LOG_MAX = 4;
function renderLogMeter(bps) {
  const mbps = Math.max(0.1, bps / 1e6);
  const logVal = Math.log10(mbps);
  const fraction = Math.max(
    0,
    Math.min(1, (logVal - LOG_MIN) / (LOG_MAX - LOG_MIN))
  );
  const position = Math.round(fraction * (METER_WIDTH - 1));
  let bar = "";
  for (let i = 0; i < METER_WIDTH; i++) {
    if (i === position) bar += "\u25BC";
    else if (i % 7 === 0)
      bar += "\u250A";
    else bar += "\u2500";
  }
  const axis = layoutAxis([
    { col: 0, text: "1M" },
    { col: 7, text: "10M" },
    { col: 14, text: "100M" },
    { col: 21, text: "1G" },
    { col: 27, text: "10G" }
  ]);
  return `${bar}
${axis}`;
}
function layoutAxis(labels) {
  const line = Array(METER_WIDTH + 3).fill(" ");
  for (const { col, text } of labels) {
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (c < line.length) line[c] = text[i];
    }
  }
  return line.join("").trimEnd();
}

// src/lib/summary.ts
function generateSummary(result) {
  const dlTier = result.downloadBps !== null ? classifySpeed(result.downloadBps) : null;
  const ulTier = result.uploadBps !== null ? classifySpeed(result.uploadBps) : null;
  const respLow = result.responsivenessTier === "low";
  if (dlTier === null && ulTier === null) {
    return "Couldn't measure throughput. Connection may be unstable.";
  }
  if (dlTier === null) return verdictUpload(ulTier, respLow);
  if (ulTier === null) return verdictDownload(dlTier, respLow);
  const min = minTier(dlTier, ulTier);
  let verdict;
  switch (min) {
    case "poor":
      verdict = "Slow connection \u2014 basic browsing only, expect issues with video calls.";
      break;
    case "ok":
      verdict = "Decent connection \u2014 HD streaming and one-on-one video calls should work.";
      break;
    case "good":
      verdict = "Solid connection \u2014 handles 4K streaming and most video work comfortably.";
      break;
    case "great":
      verdict = "Fast connection \u2014 plenty of headroom for streaming, calls, and large transfers.";
      break;
    case "excellent":
      verdict = "Excellent connection \u2014 gigabit-class, no practical bottlenecks.";
      break;
  }
  if (respLow) {
    verdict += " Responsiveness is low though \u2014 video calls and gaming may stutter under load (bufferbloat).";
  }
  return verdict;
}
function verdictDownload(tier, respLow) {
  const base = {
    poor: "Download is slow \u2014 HD streaming will struggle.",
    ok: "Download is OK for HD streaming and basic use.",
    good: "Download is solid \u2014 4K streaming works comfortably.",
    great: "Download is fast \u2014 plenty of headroom for heavy use.",
    excellent: "Download is gigabit-class."
  }[tier];
  return respLow ? `${base} Responsiveness is low (bufferbloat).` : base;
}
function verdictUpload(tier, respLow) {
  const base = {
    poor: "Upload is slow \u2014 video calls and uploads will be painful.",
    ok: "Upload handles HD video calls.",
    good: "Upload is solid \u2014 fine for live streaming.",
    great: "Upload is fast \u2014 professional streaming and large uploads work well.",
    excellent: "Upload is gigabit-class \u2014 symmetric connection."
  }[tier];
  return respLow ? `${base} Responsiveness is low (bufferbloat).` : base;
}
function minTier(a, b) {
  const order = ["poor", "ok", "good", "great", "excellent"];
  return order.indexOf(a) < order.indexOf(b) ? a : b;
}

// src/services/interfaces.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
function displayName(iface) {
  const portLabel = portShortLabel(iface);
  if (iface.ssid) return `${portLabel} \xB7 ${iface.ssid}`;
  if (iface.isHotspot && iface.ipv4) return `${portLabel} \xB7 ${iface.ipv4}`;
  if (iface.type === "wifi" && iface.active)
    return `${portLabel} \xB7 (name unavailable)`;
  return `${portLabel} \xB7 ${iface.name}`;
}
function portShortLabel(iface) {
  if (iface.isHotspot) return "Hotspot";
  switch (iface.type) {
    case "wifi":
      return "Wi-Fi";
    case "ethernet":
      return "Ethernet";
    case "thunderbolt":
      return "Thunderbolt";
    case "usb":
      return /iphone/i.test(iface.hardwarePort) ? "iPhone USB" : "USB";
    case "bluetooth":
      return "Bluetooth";
    case "other":
      return iface.hardwarePort;
  }
}
function isSSIDPermissionMissing(iface) {
  return iface.active && iface.type === "wifi" && iface.ssid === null;
}

// src/views/NetworkBadge.tsx
var import_api2 = require("@raycast/api");
var import_jsx_runtime = require("react/jsx-runtime");
function NetworkContextMetadata({ iface }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api2.Detail.Metadata.Label,
      {
        title: "Network",
        text: displayName(iface),
        icon: iconFor(iface)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api2.Detail.Metadata.Label, { title: "Interface", text: iface.name }),
    iface.ipv4 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api2.Detail.Metadata.Label, { title: "Local IP", text: iface.ipv4 }),
    iface.isDefault && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api2.Detail.Metadata.Label, { title: "Default route", text: "Yes" }),
    isSSIDPermissionMissing(iface) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api2.Detail.Metadata.Label,
      {
        title: "Network name",
        text: "Grant Location Services to read SSID",
        icon: { source: import_api2.Icon.Info, tintColor: import_api2.Color.Yellow }
      }
    )
  ] });
}
function iconFor(iface) {
  if (iface.isHotspot) return import_api2.Icon.Mobile;
  switch (iface.type) {
    case "wifi":
      return import_api2.Icon.Wifi;
    case "ethernet":
      return import_api2.Icon.Plug;
    case "thunderbolt":
      return import_api2.Icon.Bolt;
    case "usb":
      return import_api2.Icon.Mobile;
    case "bluetooth":
      return import_api2.Icon.Bluetooth;
    case "other":
      return import_api2.Icon.Network;
  }
}

// src/views/HistoryEntryDetail.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function HistoryEntryDetail({ entry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_api3.Detail,
    {
      markdown: renderMarkdown(entry),
      metadata: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_api3.Detail.Metadata, { children: [
        entry.result?.downloadBps != null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.Detail.Metadata.TagList, { title: "Download", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.TagList.Item,
          {
            text: `${formatThroughput(entry.result.downloadBps)} \xB7 ${speedTierLabel(classifySpeed(entry.result.downloadBps))}`,
            color: speedTierColor(classifySpeed(entry.result.downloadBps)),
            icon: import_api3.Icon.ArrowDown
          }
        ) }),
        entry.result?.uploadBps != null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.Detail.Metadata.TagList, { title: "Upload", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.TagList.Item,
          {
            text: `${formatThroughput(entry.result.uploadBps)} \xB7 ${speedTierLabel(classifySpeed(entry.result.uploadBps))}`,
            color: speedTierColor(classifySpeed(entry.result.uploadBps)),
            icon: import_api3.Icon.ArrowUp
          }
        ) }),
        entry.result && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.Label,
          {
            title: "Latency",
            text: formatLatency(entry.result.baseRttMs),
            icon: import_api3.Icon.Gauge
          }
        ),
        entry.result?.responsivenessRpm != null && entry.result.responsivenessTier && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.Detail.Metadata.TagList, { title: "Responsiveness", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.TagList.Item,
          {
            text: formatResponsiveness(
              entry.result.responsivenessRpm,
              entry.result.responsivenessTier
            ),
            color: responsivenessColor(entry.result.responsivenessTier)
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.Detail.Metadata.Separator, {}),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NetworkContextMetadata, { iface: entry.interface }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.Detail.Metadata.Label, { title: "Mode", text: modeLabel(entry.mode) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.Label,
          {
            title: "Run duration",
            text: formatElapsed(entry.durationMs)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.Label,
          {
            title: "When",
            text: formatRelativeTime(entry.finishedAt)
          }
        ),
        entry.compareRunId && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api3.Detail.Metadata.Label,
          {
            title: "Compare run",
            text: entry.compareRunId.slice(0, 8)
          }
        )
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api3.ActionPanel, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_api3.Action.CopyToClipboard,
        {
          title: "Copy Entry as JSON",
          content: JSON.stringify(entry, null, 2)
        }
      ) })
    }
  );
}
function renderMarkdown(entry) {
  const lines = [];
  lines.push(`# ${displayName(entry.interface)}`);
  lines.push("");
  lines.push(
    `*${formatRelativeTime(entry.finishedAt)} \xB7 ${modeLabel(entry.mode)}*`
  );
  lines.push("");
  if (entry.error) {
    lines.push("```");
    lines.push(entry.error);
    lines.push("```");
    return lines.join("\n");
  }
  if (!entry.result) return lines.join("\n");
  lines.push(`> ${generateSummary(entry.result)}`);
  lines.push("");
  if (entry.result.downloadBps !== null) {
    const t = classifySpeed(entry.result.downloadBps);
    lines.push(
      `### \u2193 Download  ${formatThroughput(entry.result.downloadBps)}  \xB7  ${speedTierLabel(t)} \u2014 ${downloadContext(t)}`
    );
    lines.push("```");
    lines.push(renderLogMeter(entry.result.downloadBps));
    lines.push("```");
    lines.push("");
  }
  if (entry.result.uploadBps !== null) {
    const t = classifySpeed(entry.result.uploadBps);
    lines.push(
      `### \u2191 Upload  ${formatThroughput(entry.result.uploadBps)}  \xB7  ${speedTierLabel(t)} \u2014 ${uploadContext(t)}`
    );
    lines.push("```");
    lines.push(renderLogMeter(entry.result.uploadBps));
    lines.push("```");
    lines.push("");
  }
  lines.push(
    `**Latency**  ${formatLatency(entry.result.baseRttMs)}` + (entry.result.responsivenessRpm !== null ? `  \xB7  **Responsiveness**  ${formatResponsiveness(entry.result.responsivenessRpm, entry.result.responsivenessTier)}` : "")
  );
  return lines.join("\n");
}
function responsivenessColor(tier) {
  switch (tier) {
    case "high":
      return import_api3.Color.Green;
    case "medium":
      return import_api3.Color.Yellow;
    case "low":
      return import_api3.Color.Red;
  }
}
function speedTierColor(tier) {
  switch (tier) {
    case "poor":
      return import_api3.Color.Red;
    case "ok":
      return import_api3.Color.Orange;
    case "good":
      return import_api3.Color.Yellow;
    case "great":
      return import_api3.Color.Green;
    case "excellent":
      return import_api3.Color.Blue;
  }
}

// src/network-history.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function Command() {
  const { entries, isLoading, error, reload, clear, filePath } = useHistory();
  const [filter, setFilter] = (0, import_react2.useState)("all");
  const { push } = (0, import_api4.useNavigation)();
  const networks = (0, import_react2.useMemo)(() => uniqueNetworkKeys(entries), [entries]);
  const filtered = (0, import_react2.useMemo)(
    () => filter === "all" ? entries : entries.filter((e) => networkKey(e) === filter),
    [entries, filter]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    import_api4.List,
    {
      isLoading,
      searchBarPlaceholder: "Filter by network name...",
      searchBarAccessory: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        import_api4.List.Dropdown,
        {
          tooltip: "Filter by network",
          value: filter,
          onChange: setFilter,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api4.List.Dropdown.Item, { title: "All networks", value: "all" }),
            networks.map(({ key, label }) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api4.List.Dropdown.Item, { title: label, value: key }, key))
          ]
        }
      ),
      children: [
        error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api4.List.EmptyView,
          {
            title: "Failed to load history",
            description: error,
            icon: import_api4.Icon.ExclamationMark
          }
        ),
        !error && filtered.length === 0 && !isLoading && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api4.List.EmptyView,
          {
            title: "No history yet",
            description: "Run Test Network to start logging.",
            icon: import_api4.Icon.Clock
          }
        ),
        filtered.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api4.List.Item,
          {
            icon: iconFor(entry.interface),
            title: displayName(entry.interface),
            subtitle: subtitleFor(entry),
            accessories: accessoriesFor(entry),
            actions: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api4.ActionPanel, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_api4.Action,
                {
                  title: "Show Details",
                  icon: import_api4.Icon.Eye,
                  onAction: () => push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(HistoryEntryDetail, { entry }))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_api4.Action,
                {
                  title: "Re-Test This Network",
                  icon: import_api4.Icon.ArrowClockwise,
                  shortcut: { modifiers: ["cmd"], key: "r" },
                  onAction: () => (0, import_api4.launchCommand)({
                    name: "test-network",
                    type: import_api4.LaunchType.UserInitiated
                  })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_api4.Action.CopyToClipboard,
                {
                  title: "Copy Entry as JSON",
                  content: JSON.stringify(entry, null, 2),
                  shortcut: { modifiers: ["cmd"], key: "c" }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api4.ActionPanel.Section, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_api4.Action,
                  {
                    title: "Show Log File in Finder",
                    icon: import_api4.Icon.Finder,
                    shortcut: { modifiers: ["cmd", "shift"], key: "f" },
                    onAction: () => void (0, import_api4.open)(import_node_path2.default.dirname(filePath))
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_api4.Action,
                  {
                    title: "Reload",
                    icon: import_api4.Icon.RotateClockwise,
                    shortcut: { modifiers: ["cmd"], key: "u" },
                    onAction: () => void reload()
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  import_api4.Action,
                  {
                    title: "Clear All History",
                    icon: import_api4.Icon.Trash,
                    style: import_api4.Action.Style.Destructive,
                    shortcut: { modifiers: ["cmd", "shift"], key: "delete" },
                    onAction: () => void confirmAndClear(clear)
                  }
                )
              ] })
            ] })
          },
          entry.id
        ))
      ]
    }
  );
}
function subtitleFor(entry) {
  const time = formatRelativeTime(entry.finishedAt);
  return `${time} \xB7 ${modeLabel(entry.mode)}`;
}
function accessoriesFor(entry) {
  if (entry.error) {
    return [
      {
        tag: { value: "error", color: import_api4.Color.Red },
        tooltip: entry.error
      }
    ];
  }
  if (!entry.result) return [];
  const accs = [];
  if (entry.result.downloadBps !== null) {
    const tier = classifySpeed(entry.result.downloadBps);
    accs.push({
      tag: {
        value: `\u2193 ${formatThroughput(entry.result.downloadBps)}`,
        color: speedTierColor2(tier)
      },
      tooltip: `Download \xB7 ${speedTierLabel(tier)}`
    });
  }
  if (entry.result.uploadBps !== null) {
    const tier = classifySpeed(entry.result.uploadBps);
    accs.push({
      tag: {
        value: `\u2191 ${formatThroughput(entry.result.uploadBps)}`,
        color: speedTierColor2(tier)
      },
      tooltip: `Upload \xB7 ${speedTierLabel(tier)}`
    });
  }
  if (entry.result.baseRttMs !== null) {
    accs.push({
      text: formatLatency(entry.result.baseRttMs),
      tooltip: "Latency"
    });
  }
  return accs;
}
function speedTierColor2(tier) {
  switch (tier) {
    case "poor":
      return import_api4.Color.Red;
    case "ok":
      return import_api4.Color.Orange;
    case "good":
      return import_api4.Color.Yellow;
    case "great":
      return import_api4.Color.Green;
    case "excellent":
      return import_api4.Color.Blue;
  }
}
function networkKey(entry) {
  return `${entry.interface.name}::${entry.interface.ssid ?? ""}`;
}
function uniqueNetworkKeys(entries) {
  const map = /* @__PURE__ */ new Map();
  for (const e of entries) {
    map.set(networkKey(e), displayName(e.interface));
  }
  return [...map.entries()].map(([key, label]) => ({ key, label }));
}
async function confirmAndClear(clear) {
  const ok = await (0, import_api4.confirmAlert)({
    title: "Clear all history?",
    message: "This deletes the local history.jsonl file. Cannot be undone.",
    primaryAction: { title: "Clear", style: import_api4.Alert.ActionStyle.Destructive }
  });
  if (!ok) return;
  await clear();
  await (0, import_api4.showToast)({ style: import_api4.Toast.Style.Success, title: "History cleared" });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9uZXR3b3JrLWhpc3RvcnkudHN4IiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvaG9va3MvdXNlSGlzdG9yeS50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3N0b3JhZ2UvaGlzdG9yeVN0b3JlLnRzIiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvdmlld3MvSGlzdG9yeUVudHJ5RGV0YWlsLnRzeCIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL2xpYi9mb3JtYXQudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9saWIvc3BlZWQudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9saWIvc3VtbWFyeS50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3NlcnZpY2VzL2ludGVyZmFjZXMudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy92aWV3cy9OZXR3b3JrQmFkZ2UudHN4Il0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQge1xuICBBY3Rpb24sXG4gIEFjdGlvblBhbmVsLFxuICBBbGVydCxcbiAgQ29sb3IsXG4gIGNvbmZpcm1BbGVydCxcbiAgSWNvbixcbiAgbGF1bmNoQ29tbWFuZCxcbiAgTGF1bmNoVHlwZSxcbiAgTGlzdCxcbiAgb3BlbixcbiAgc2hvd1RvYXN0LFxuICBUb2FzdCxcbiAgdXNlTmF2aWdhdGlvbixcbn0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHsgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IHVzZUhpc3RvcnkgfSBmcm9tIFwiLi9ob29rcy91c2VIaXN0b3J5XCI7XG5pbXBvcnQgeyBIaXN0b3J5RW50cnlEZXRhaWwgfSBmcm9tIFwiLi92aWV3cy9IaXN0b3J5RW50cnlEZXRhaWxcIjtcbmltcG9ydCB7IGljb25Gb3IgfSBmcm9tIFwiLi92aWV3cy9OZXR3b3JrQmFkZ2VcIjtcbmltcG9ydCB7IGRpc3BsYXlOYW1lIH0gZnJvbSBcIi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuaW1wb3J0IHtcbiAgZm9ybWF0TGF0ZW5jeSxcbiAgZm9ybWF0UmVsYXRpdmVUaW1lLFxuICBmb3JtYXRUaHJvdWdocHV0LFxuICBtb2RlTGFiZWwsXG59IGZyb20gXCIuL2xpYi9mb3JtYXRcIjtcbmltcG9ydCB7IGNsYXNzaWZ5U3BlZWQsIHNwZWVkVGllckxhYmVsIH0gZnJvbSBcIi4vbGliL3NwZWVkXCI7XG5pbXBvcnQgdHlwZSB7IEhpc3RvcnlFbnRyeSwgU3BlZWRUaWVyIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQ29tbWFuZCgpIHtcbiAgY29uc3QgeyBlbnRyaWVzLCBpc0xvYWRpbmcsIGVycm9yLCByZWxvYWQsIGNsZWFyLCBmaWxlUGF0aCB9ID0gdXNlSGlzdG9yeSgpO1xuICBjb25zdCBbZmlsdGVyLCBzZXRGaWx0ZXJdID0gdXNlU3RhdGU8c3RyaW5nPihcImFsbFwiKTtcbiAgY29uc3QgeyBwdXNoIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG5cbiAgY29uc3QgbmV0d29ya3MgPSB1c2VNZW1vKCgpID0+IHVuaXF1ZU5ldHdvcmtLZXlzKGVudHJpZXMpLCBbZW50cmllc10pO1xuICBjb25zdCBmaWx0ZXJlZCA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIGZpbHRlciA9PT0gXCJhbGxcIlxuICAgICAgICA/IGVudHJpZXNcbiAgICAgICAgOiBlbnRyaWVzLmZpbHRlcigoZSkgPT4gbmV0d29ya0tleShlKSA9PT0gZmlsdGVyKSxcbiAgICBbZW50cmllcywgZmlsdGVyXSxcbiAgKTtcblxuICByZXR1cm4gKFxuICAgIDxMaXN0XG4gICAgICBpc0xvYWRpbmc9e2lzTG9hZGluZ31cbiAgICAgIHNlYXJjaEJhclBsYWNlaG9sZGVyPVwiRmlsdGVyIGJ5IG5ldHdvcmsgbmFtZS4uLlwiXG4gICAgICBzZWFyY2hCYXJBY2Nlc3Nvcnk9e1xuICAgICAgICA8TGlzdC5Ecm9wZG93blxuICAgICAgICAgIHRvb2x0aXA9XCJGaWx0ZXIgYnkgbmV0d29ya1wiXG4gICAgICAgICAgdmFsdWU9e2ZpbHRlcn1cbiAgICAgICAgICBvbkNoYW5nZT17c2V0RmlsdGVyfVxuICAgICAgICA+XG4gICAgICAgICAgPExpc3QuRHJvcGRvd24uSXRlbSB0aXRsZT1cIkFsbCBuZXR3b3Jrc1wiIHZhbHVlPVwiYWxsXCIgLz5cbiAgICAgICAgICB7bmV0d29ya3MubWFwKCh7IGtleSwgbGFiZWwgfSkgPT4gKFxuICAgICAgICAgICAgPExpc3QuRHJvcGRvd24uSXRlbSBrZXk9e2tleX0gdGl0bGU9e2xhYmVsfSB2YWx1ZT17a2V5fSAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0xpc3QuRHJvcGRvd24+XG4gICAgICB9XG4gICAgPlxuICAgICAge2Vycm9yICYmIChcbiAgICAgICAgPExpc3QuRW1wdHlWaWV3XG4gICAgICAgICAgdGl0bGU9XCJGYWlsZWQgdG8gbG9hZCBoaXN0b3J5XCJcbiAgICAgICAgICBkZXNjcmlwdGlvbj17ZXJyb3J9XG4gICAgICAgICAgaWNvbj17SWNvbi5FeGNsYW1hdGlvbk1hcmt9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgICAgeyFlcnJvciAmJiBmaWx0ZXJlZC5sZW5ndGggPT09IDAgJiYgIWlzTG9hZGluZyAmJiAoXG4gICAgICAgIDxMaXN0LkVtcHR5Vmlld1xuICAgICAgICAgIHRpdGxlPVwiTm8gaGlzdG9yeSB5ZXRcIlxuICAgICAgICAgIGRlc2NyaXB0aW9uPVwiUnVuIFRlc3QgTmV0d29yayB0byBzdGFydCBsb2dnaW5nLlwiXG4gICAgICAgICAgaWNvbj17SWNvbi5DbG9ja31cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgICB7ZmlsdGVyZWQubWFwKChlbnRyeSkgPT4gKFxuICAgICAgICA8TGlzdC5JdGVtXG4gICAgICAgICAga2V5PXtlbnRyeS5pZH1cbiAgICAgICAgICBpY29uPXtpY29uRm9yKGVudHJ5LmludGVyZmFjZSl9XG4gICAgICAgICAgdGl0bGU9e2Rpc3BsYXlOYW1lKGVudHJ5LmludGVyZmFjZSl9XG4gICAgICAgICAgc3VidGl0bGU9e3N1YnRpdGxlRm9yKGVudHJ5KX1cbiAgICAgICAgICBhY2Nlc3Nvcmllcz17YWNjZXNzb3JpZXNGb3IoZW50cnkpfVxuICAgICAgICAgIGFjdGlvbnM9e1xuICAgICAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgdGl0bGU9XCJTaG93IERldGFpbHNcIlxuICAgICAgICAgICAgICAgIGljb249e0ljb24uRXllfVxuICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PiBwdXNoKDxIaXN0b3J5RW50cnlEZXRhaWwgZW50cnk9e2VudHJ5fSAvPil9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICB0aXRsZT1cIlJlLVRlc3QgVGhpcyBOZXR3b3JrXCJcbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93Q2xvY2t3aXNlfVxuICAgICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCJdLCBrZXk6IFwiclwiIH19XG4gICAgICAgICAgICAgICAgb25BY3Rpb249eygpID0+XG4gICAgICAgICAgICAgICAgICBsYXVuY2hDb21tYW5kKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJ0ZXN0LW5ldHdvcmtcIixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogTGF1bmNoVHlwZS5Vc2VySW5pdGlhdGVkLFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxBY3Rpb24uQ29weVRvQ2xpcGJvYXJkXG4gICAgICAgICAgICAgICAgdGl0bGU9XCJDb3B5IEVudHJ5IGFzIEpTT05cIlxuICAgICAgICAgICAgICAgIGNvbnRlbnQ9e0pTT04uc3RyaW5naWZ5KGVudHJ5LCBudWxsLCAyKX1cbiAgICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcImNcIiB9fVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8QWN0aW9uUGFuZWwuU2VjdGlvbj5cbiAgICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgICB0aXRsZT1cIlNob3cgTG9nIEZpbGUgaW4gRmluZGVyXCJcbiAgICAgICAgICAgICAgICAgIGljb249e0ljb24uRmluZGVyfVxuICAgICAgICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIiwgXCJzaGlmdFwiXSwga2V5OiBcImZcIiB9fVxuICAgICAgICAgICAgICAgICAgb25BY3Rpb249eygpID0+IHZvaWQgb3BlbihwYXRoLmRpcm5hbWUoZmlsZVBhdGgpKX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgIHRpdGxlPVwiUmVsb2FkXCJcbiAgICAgICAgICAgICAgICAgIGljb249e0ljb24uUm90YXRlQ2xvY2t3aXNlfVxuICAgICAgICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIl0sIGtleTogXCJ1XCIgfX1cbiAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PiB2b2lkIHJlbG9hZCgpfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgICAgICAgdGl0bGU9XCJDbGVhciBBbGwgSGlzdG9yeVwiXG4gICAgICAgICAgICAgICAgICBpY29uPXtJY29uLlRyYXNofVxuICAgICAgICAgICAgICAgICAgc3R5bGU9e0FjdGlvbi5TdHlsZS5EZXN0cnVjdGl2ZX1cbiAgICAgICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCIsIFwic2hpZnRcIl0sIGtleTogXCJkZWxldGVcIiB9fVxuICAgICAgICAgICAgICAgICAgb25BY3Rpb249eygpID0+IHZvaWQgY29uZmlybUFuZENsZWFyKGNsZWFyKX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L0FjdGlvblBhbmVsLlNlY3Rpb24+XG4gICAgICAgICAgICA8L0FjdGlvblBhbmVsPlxuICAgICAgICAgIH1cbiAgICAgICAgLz5cbiAgICAgICkpfVxuICAgIDwvTGlzdD5cbiAgKTtcbn1cblxuZnVuY3Rpb24gc3VidGl0bGVGb3IoZW50cnk6IEhpc3RvcnlFbnRyeSk6IHN0cmluZyB7XG4gIGNvbnN0IHRpbWUgPSBmb3JtYXRSZWxhdGl2ZVRpbWUoZW50cnkuZmluaXNoZWRBdCk7XG4gIHJldHVybiBgJHt0aW1lfSBcdTAwQjcgJHttb2RlTGFiZWwoZW50cnkubW9kZSl9YDtcbn1cblxuZnVuY3Rpb24gYWNjZXNzb3JpZXNGb3IoZW50cnk6IEhpc3RvcnlFbnRyeSk6IExpc3QuSXRlbS5BY2Nlc3NvcnlbXSB7XG4gIGlmIChlbnRyeS5lcnJvcikge1xuICAgIHJldHVybiBbXG4gICAgICB7XG4gICAgICAgIHRhZzogeyB2YWx1ZTogXCJlcnJvclwiLCBjb2xvcjogQ29sb3IuUmVkIH0sXG4gICAgICAgIHRvb2x0aXA6IGVudHJ5LmVycm9yLFxuICAgICAgfSxcbiAgICBdO1xuICB9XG4gIGlmICghZW50cnkucmVzdWx0KSByZXR1cm4gW107XG5cbiAgY29uc3QgYWNjczogTGlzdC5JdGVtLkFjY2Vzc29yeVtdID0gW107XG4gIGlmIChlbnRyeS5yZXN1bHQuZG93bmxvYWRCcHMgIT09IG51bGwpIHtcbiAgICBjb25zdCB0aWVyID0gY2xhc3NpZnlTcGVlZChlbnRyeS5yZXN1bHQuZG93bmxvYWRCcHMpO1xuICAgIGFjY3MucHVzaCh7XG4gICAgICB0YWc6IHtcbiAgICAgICAgdmFsdWU6IGBcdTIxOTMgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyl9YCxcbiAgICAgICAgY29sb3I6IHNwZWVkVGllckNvbG9yKHRpZXIpLFxuICAgICAgfSxcbiAgICAgIHRvb2x0aXA6IGBEb3dubG9hZCBcdTAwQjcgJHtzcGVlZFRpZXJMYWJlbCh0aWVyKX1gLFxuICAgIH0pO1xuICB9XG4gIGlmIChlbnRyeS5yZXN1bHQudXBsb2FkQnBzICE9PSBudWxsKSB7XG4gICAgY29uc3QgdGllciA9IGNsYXNzaWZ5U3BlZWQoZW50cnkucmVzdWx0LnVwbG9hZEJwcyk7XG4gICAgYWNjcy5wdXNoKHtcbiAgICAgIHRhZzoge1xuICAgICAgICB2YWx1ZTogYFx1MjE5MSAke2Zvcm1hdFRocm91Z2hwdXQoZW50cnkucmVzdWx0LnVwbG9hZEJwcyl9YCxcbiAgICAgICAgY29sb3I6IHNwZWVkVGllckNvbG9yKHRpZXIpLFxuICAgICAgfSxcbiAgICAgIHRvb2x0aXA6IGBVcGxvYWQgXHUwMEI3ICR7c3BlZWRUaWVyTGFiZWwodGllcil9YCxcbiAgICB9KTtcbiAgfVxuICBpZiAoZW50cnkucmVzdWx0LmJhc2VSdHRNcyAhPT0gbnVsbCkge1xuICAgIGFjY3MucHVzaCh7XG4gICAgICB0ZXh0OiBmb3JtYXRMYXRlbmN5KGVudHJ5LnJlc3VsdC5iYXNlUnR0TXMpLFxuICAgICAgdG9vbHRpcDogXCJMYXRlbmN5XCIsXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIGFjY3M7XG59XG5cbmZ1bmN0aW9uIHNwZWVkVGllckNvbG9yKHRpZXI6IFNwZWVkVGllcik6IENvbG9yIHtcbiAgc3dpdGNoICh0aWVyKSB7XG4gICAgY2FzZSBcInBvb3JcIjpcbiAgICAgIHJldHVybiBDb2xvci5SZWQ7XG4gICAgY2FzZSBcIm9rXCI6XG4gICAgICByZXR1cm4gQ29sb3IuT3JhbmdlO1xuICAgIGNhc2UgXCJnb29kXCI6XG4gICAgICByZXR1cm4gQ29sb3IuWWVsbG93O1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgcmV0dXJuIENvbG9yLkdyZWVuO1xuICAgIGNhc2UgXCJleGNlbGxlbnRcIjpcbiAgICAgIHJldHVybiBDb2xvci5CbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5ldHdvcmtLZXkoZW50cnk6IEhpc3RvcnlFbnRyeSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtlbnRyeS5pbnRlcmZhY2UubmFtZX06OiR7ZW50cnkuaW50ZXJmYWNlLnNzaWQgPz8gXCJcIn1gO1xufVxuXG5mdW5jdGlvbiB1bmlxdWVOZXR3b3JrS2V5cyhlbnRyaWVzOiBIaXN0b3J5RW50cnlbXSkge1xuICBjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IGUgb2YgZW50cmllcykge1xuICAgIG1hcC5zZXQobmV0d29ya0tleShlKSwgZGlzcGxheU5hbWUoZS5pbnRlcmZhY2UpKTtcbiAgfVxuICByZXR1cm4gWy4uLm1hcC5lbnRyaWVzKCldLm1hcCgoW2tleSwgbGFiZWxdKSA9PiAoeyBrZXksIGxhYmVsIH0pKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybUFuZENsZWFyKGNsZWFyOiAoKSA9PiBQcm9taXNlPHZvaWQ+KSB7XG4gIGNvbnN0IG9rID0gYXdhaXQgY29uZmlybUFsZXJ0KHtcbiAgICB0aXRsZTogXCJDbGVhciBhbGwgaGlzdG9yeT9cIixcbiAgICBtZXNzYWdlOiBcIlRoaXMgZGVsZXRlcyB0aGUgbG9jYWwgaGlzdG9yeS5qc29ubCBmaWxlLiBDYW5ub3QgYmUgdW5kb25lLlwiLFxuICAgIHByaW1hcnlBY3Rpb246IHsgdGl0bGU6IFwiQ2xlYXJcIiwgc3R5bGU6IEFsZXJ0LkFjdGlvblN0eWxlLkRlc3RydWN0aXZlIH0sXG4gIH0pO1xuICBpZiAoIW9rKSByZXR1cm47XG4gIGF3YWl0IGNsZWFyKCk7XG4gIGF3YWl0IHNob3dUb2FzdCh7IHN0eWxlOiBUb2FzdC5TdHlsZS5TdWNjZXNzLCB0aXRsZTogXCJIaXN0b3J5IGNsZWFyZWRcIiB9KTtcbn1cbiIsICJpbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyBjcmVhdGVIaXN0b3J5U3RvcmUsIHR5cGUgSGlzdG9yeVN0b3JlIH0gZnJvbSBcIi4uL3N0b3JhZ2UvaGlzdG9yeVN0b3JlXCI7XG5pbXBvcnQgdHlwZSB7IEhpc3RvcnlFbnRyeSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5pbnRlcmZhY2UgVXNlSGlzdG9yeVJldHVybiB7XG4gIGVudHJpZXM6IEhpc3RvcnlFbnRyeVtdO1xuICBpc0xvYWRpbmc6IGJvb2xlYW47XG4gIGVycm9yOiBzdHJpbmcgfCBudWxsO1xuICByZWxvYWQ6ICgpID0+IFByb21pc2U8dm9pZD47XG4gIGNsZWFyOiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xuICBmaWxlUGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlSGlzdG9yeShzdG9yZT86IEhpc3RvcnlTdG9yZSk6IFVzZUhpc3RvcnlSZXR1cm4ge1xuICBjb25zdCBzdG9yZVJlZiA9IHVzZVJlZjxIaXN0b3J5U3RvcmU+KHN0b3JlID8/IGNyZWF0ZUhpc3RvcnlTdG9yZSgpKTtcbiAgY29uc3QgW2VudHJpZXMsIHNldEVudHJpZXNdID0gdXNlU3RhdGU8SGlzdG9yeUVudHJ5W10+KFtdKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IHJlbG9hZCA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFsbCA9IGF3YWl0IHN0b3JlUmVmLmN1cnJlbnQucmVhZEFsbCgpO1xuICAgICAgc2V0RW50cmllcyhhbGwpO1xuICAgICAgc2V0RXJyb3IobnVsbCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRFcnJvcihlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogXCJGYWlsZWQgdG8gcmVhZCBoaXN0b3J5XCIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIGNvbnN0IGNsZWFyID0gdXNlQ2FsbGJhY2soYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHN0b3JlUmVmLmN1cnJlbnQuY2xlYXIoKTtcbiAgICBhd2FpdCByZWxvYWQoKTtcbiAgfSwgW3JlbG9hZF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgdm9pZCByZWxvYWQoKTtcbiAgfSwgW3JlbG9hZF0pO1xuXG4gIHJldHVybiB7XG4gICAgZW50cmllcyxcbiAgICBpc0xvYWRpbmcsXG4gICAgZXJyb3IsXG4gICAgcmVsb2FkLFxuICAgIGNsZWFyLFxuICAgIGZpbGVQYXRoOiBzdG9yZVJlZi5jdXJyZW50LmZpbGVQYXRoKCksXG4gIH07XG59XG4iLCAiaW1wb3J0IHsgZW52aXJvbm1lbnQgfSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgdHlwZSB7IEhpc3RvcnlFbnRyeSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5jb25zdCBISVNUT1JZX0ZJTEVOQU1FID0gXCJoaXN0b3J5Lmpzb25sXCI7XG5cbi8qKlxuICogQXBwZW5kLW9ubHkgSlNPTkwgaGlzdG9yeS4gV2UgdXNlIGEgZmlsZSAobm90IExvY2FsU3RvcmFnZSkgYmVjYXVzZTpcbiAqIC0gVXNlciBjYW4gaW5zcGVjdCAvIGdyZXAgLyBiYWNrIHVwIHRoZSBsb2dcbiAqIC0gSXQgZ3Jvd3MgbGluZWFybHkgYW5kIHdlIG5ldmVyIG5lZWQgdG8gcmVhZCBpdCBhbGwgdG8gd3JpdGVcbiAqIC0gXCJTaG93IGluIEZpbmRlclwiIGlzIGEgcmVhbCwgdXNlZnVsIGFmZm9yZGFuY2VcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBIaXN0b3J5U3RvcmUge1xuICBhcHBlbmQoZW50cnk6IEhpc3RvcnlFbnRyeSk6IFByb21pc2U8dm9pZD47XG4gIHJlYWRBbGwoKTogUHJvbWlzZTxIaXN0b3J5RW50cnlbXT47XG4gIGNsZWFyKCk6IFByb21pc2U8dm9pZD47XG4gIGZpbGVQYXRoKCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhpc3RvcnlTdG9yZSgpOiBIaXN0b3J5U3RvcmUge1xuICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihlbnZpcm9ubWVudC5zdXBwb3J0UGF0aCwgSElTVE9SWV9GSUxFTkFNRSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhc3luYyBhcHBlbmQoZW50cnkpIHtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKHBhdGguZGlybmFtZShmaWxlUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgYXdhaXQgZnMuYXBwZW5kRmlsZShmaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkoZW50cnkpICsgXCJcXG5cIiwgXCJ1dGY4XCIpO1xuICAgIH0sXG5cbiAgICBhc3luYyByZWFkQWxsKCkge1xuICAgICAgbGV0IGNvbnRlbnRzOiBzdHJpbmc7XG4gICAgICB0cnkge1xuICAgICAgICBjb250ZW50cyA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCBcInV0ZjhcIik7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKChlcnIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlID09PSBcIkVOT0VOVFwiKSByZXR1cm4gW107XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVudHJpZXM6IEhpc3RvcnlFbnRyeVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgY29udGVudHMuc3BsaXQoXCJcXG5cIikpIHtcbiAgICAgICAgaWYgKCFsaW5lLnRyaW0oKSkgY29udGludWU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZW50cmllcy5wdXNoKEpTT04ucGFyc2UobGluZSkgYXMgSGlzdG9yeUVudHJ5KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLy8gc2tpcCBtYWxmb3JtZWQgbGluZXMgcmF0aGVyIHRoYW4gZmFpbCB0aGUgd2hvbGUgbG9hZFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZW50cmllcy5zb3J0KChhLCBiKSA9PiBiLmZpbmlzaGVkQXQgLSBhLmZpbmlzaGVkQXQpO1xuICAgIH0sXG5cbiAgICBhc3luYyBjbGVhcigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGZzLnVubGluayhmaWxlUGF0aCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKChlcnIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlICE9PSBcIkVOT0VOVFwiKSB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGZpbGVQYXRoKCkge1xuICAgICAgcmV0dXJuIGZpbGVQYXRoO1xuICAgIH0sXG4gIH07XG59XG4iLCAiaW1wb3J0IHsgQWN0aW9uLCBBY3Rpb25QYW5lbCwgQ29sb3IsIERldGFpbCwgSWNvbiB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgSGlzdG9yeUVudHJ5LCBSZXNwb25zaXZlbmVzc1RpZXIsIFNwZWVkVGllciB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHtcbiAgZm9ybWF0RWxhcHNlZCxcbiAgZm9ybWF0TGF0ZW5jeSxcbiAgZm9ybWF0UmVsYXRpdmVUaW1lLFxuICBmb3JtYXRSZXNwb25zaXZlbmVzcyxcbiAgZm9ybWF0VGhyb3VnaHB1dCxcbiAgbW9kZUxhYmVsLFxufSBmcm9tIFwiLi4vbGliL2Zvcm1hdFwiO1xuaW1wb3J0IHtcbiAgY2xhc3NpZnlTcGVlZCxcbiAgZG93bmxvYWRDb250ZXh0LFxuICByZW5kZXJMb2dNZXRlcixcbiAgc3BlZWRUaWVyTGFiZWwsXG4gIHVwbG9hZENvbnRleHQsXG59IGZyb20gXCIuLi9saWIvc3BlZWRcIjtcbmltcG9ydCB7IGdlbmVyYXRlU3VtbWFyeSB9IGZyb20gXCIuLi9saWIvc3VtbWFyeVwiO1xuaW1wb3J0IHsgZGlzcGxheU5hbWUgfSBmcm9tIFwiLi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuaW1wb3J0IHsgTmV0d29ya0NvbnRleHRNZXRhZGF0YSB9IGZyb20gXCIuL05ldHdvcmtCYWRnZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gSGlzdG9yeUVudHJ5RGV0YWlsKHsgZW50cnkgfTogeyBlbnRyeTogSGlzdG9yeUVudHJ5IH0pIHtcbiAgcmV0dXJuIChcbiAgICA8RGV0YWlsXG4gICAgICBtYXJrZG93bj17cmVuZGVyTWFya2Rvd24oZW50cnkpfVxuICAgICAgbWV0YWRhdGE9e1xuICAgICAgICA8RGV0YWlsLk1ldGFkYXRhPlxuICAgICAgICAgIHtlbnRyeS5yZXN1bHQ/LmRvd25sb2FkQnBzICE9IG51bGwgJiYgKFxuICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0IHRpdGxlPVwiRG93bmxvYWRcIj5cbiAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICB0ZXh0PXtgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyl9IFx1MDBCNyAke3NwZWVkVGllckxhYmVsKGNsYXNzaWZ5U3BlZWQoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKSl9YH1cbiAgICAgICAgICAgICAgICBjb2xvcj17c3BlZWRUaWVyQ29sb3IoY2xhc3NpZnlTcGVlZChlbnRyeS5yZXN1bHQuZG93bmxvYWRCcHMpKX1cbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93RG93bn1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3Q+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7ZW50cnkucmVzdWx0Py51cGxvYWRCcHMgIT0gbnVsbCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3QgdGl0bGU9XCJVcGxvYWRcIj5cbiAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICB0ZXh0PXtgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpfSBcdTAwQjcgJHtzcGVlZFRpZXJMYWJlbChjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpKX1gfVxuICAgICAgICAgICAgICAgIGNvbG9yPXtzcGVlZFRpZXJDb2xvcihjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpKX1cbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93VXB9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0RldGFpbC5NZXRhZGF0YS5UYWdMaXN0PlxuICAgICAgICAgICl9XG4gICAgICAgICAge2VudHJ5LnJlc3VsdCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICAgIHRpdGxlPVwiTGF0ZW5jeVwiXG4gICAgICAgICAgICAgIHRleHQ9e2Zvcm1hdExhdGVuY3koZW50cnkucmVzdWx0LmJhc2VSdHRNcyl9XG4gICAgICAgICAgICAgIGljb249e0ljb24uR2F1Z2V9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAge2VudHJ5LnJlc3VsdD8ucmVzcG9uc2l2ZW5lc3NScG0gIT0gbnVsbCAmJlxuICAgICAgICAgICAgZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllciAmJiAoXG4gICAgICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuVGFnTGlzdCB0aXRsZT1cIlJlc3BvbnNpdmVuZXNzXCI+XG4gICAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICAgIHRleHQ9e2Zvcm1hdFJlc3BvbnNpdmVuZXNzKFxuICAgICAgICAgICAgICAgICAgICBlbnRyeS5yZXN1bHQucmVzcG9uc2l2ZW5lc3NScG0sXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5LnJlc3VsdC5yZXNwb25zaXZlbmVzc1RpZXIsXG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgY29sb3I9e3Jlc3BvbnNpdmVuZXNzQ29sb3IoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllcil9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9EZXRhaWwuTWV0YWRhdGEuVGFnTGlzdD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5TZXBhcmF0b3IgLz5cbiAgICAgICAgICA8TmV0d29ya0NvbnRleHRNZXRhZGF0YSBpZmFjZT17ZW50cnkuaW50ZXJmYWNlfSAvPlxuICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJNb2RlXCIgdGV4dD17bW9kZUxhYmVsKGVudHJ5Lm1vZGUpfSAvPlxuICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICAgIHRpdGxlPVwiUnVuIGR1cmF0aW9uXCJcbiAgICAgICAgICAgIHRleHQ9e2Zvcm1hdEVsYXBzZWQoZW50cnkuZHVyYXRpb25Ncyl9XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICB0aXRsZT1cIldoZW5cIlxuICAgICAgICAgICAgdGV4dD17Zm9ybWF0UmVsYXRpdmVUaW1lKGVudHJ5LmZpbmlzaGVkQXQpfVxuICAgICAgICAgIC8+XG4gICAgICAgICAge2VudHJ5LmNvbXBhcmVSdW5JZCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICAgIHRpdGxlPVwiQ29tcGFyZSBydW5cIlxuICAgICAgICAgICAgICB0ZXh0PXtlbnRyeS5jb21wYXJlUnVuSWQuc2xpY2UoMCwgOCl9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhPlxuICAgICAgfVxuICAgICAgYWN0aW9ucz17XG4gICAgICAgIDxBY3Rpb25QYW5lbD5cbiAgICAgICAgICA8QWN0aW9uLkNvcHlUb0NsaXBib2FyZFxuICAgICAgICAgICAgdGl0bGU9XCJDb3B5IEVudHJ5IGFzIEpTT05cIlxuICAgICAgICAgICAgY29udGVudD17SlNPTi5zdHJpbmdpZnkoZW50cnksIG51bGwsIDIpfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQWN0aW9uUGFuZWw+XG4gICAgICB9XG4gICAgLz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oZW50cnk6IEhpc3RvcnlFbnRyeSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBsaW5lcy5wdXNoKGAjICR7ZGlzcGxheU5hbWUoZW50cnkuaW50ZXJmYWNlKX1gKTtcbiAgbGluZXMucHVzaChcIlwiKTtcbiAgbGluZXMucHVzaChcbiAgICBgKiR7Zm9ybWF0UmVsYXRpdmVUaW1lKGVudHJ5LmZpbmlzaGVkQXQpfSBcdTAwQjcgJHttb2RlTGFiZWwoZW50cnkubW9kZSl9KmAsXG4gICk7XG4gIGxpbmVzLnB1c2goXCJcIik7XG5cbiAgaWYgKGVudHJ5LmVycm9yKSB7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKGVudHJ5LmVycm9yKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuICB9XG4gIGlmICghZW50cnkucmVzdWx0KSByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcblxuICBsaW5lcy5wdXNoKGA+ICR7Z2VuZXJhdGVTdW1tYXJ5KGVudHJ5LnJlc3VsdCl9YCk7XG4gIGxpbmVzLnB1c2goXCJcIik7XG5cbiAgaWYgKGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbCkge1xuICAgIGNvbnN0IHQgPSBjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyk7XG4gICAgbGluZXMucHVzaChcbiAgICAgIGAjIyMgXHUyMTkzIERvd25sb2FkICAke2Zvcm1hdFRocm91Z2hwdXQoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKX0gIFx1MDBCNyAgJHtzcGVlZFRpZXJMYWJlbCh0KX0gXHUyMDE0ICR7ZG93bmxvYWRDb250ZXh0KHQpfWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIGxpbmVzLnB1c2gocmVuZGVyTG9nTWV0ZXIoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKSk7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG4gIGlmIChlbnRyeS5yZXN1bHQudXBsb2FkQnBzICE9PSBudWxsKSB7XG4gICAgY29uc3QgdCA9IGNsYXNzaWZ5U3BlZWQoZW50cnkucmVzdWx0LnVwbG9hZEJwcyk7XG4gICAgbGluZXMucHVzaChcbiAgICAgIGAjIyMgXHUyMTkxIFVwbG9hZCAgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpfSAgXHUwMEI3ICAke3NwZWVkVGllckxhYmVsKHQpfSBcdTIwMTQgJHt1cGxvYWRDb250ZXh0KHQpfWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIGxpbmVzLnB1c2gocmVuZGVyTG9nTWV0ZXIoZW50cnkucmVzdWx0LnVwbG9hZEJwcykpO1xuICAgIGxpbmVzLnB1c2goXCJgYGBcIik7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuXG4gIGxpbmVzLnB1c2goXG4gICAgYCoqTGF0ZW5jeSoqICAke2Zvcm1hdExhdGVuY3koZW50cnkucmVzdWx0LmJhc2VSdHRNcyl9YCArXG4gICAgICAoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtICE9PSBudWxsXG4gICAgICAgID8gYCAgXHUwMEI3ICAqKlJlc3BvbnNpdmVuZXNzKiogICR7Zm9ybWF0UmVzcG9uc2l2ZW5lc3MoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtLCBlbnRyeS5yZXN1bHQucmVzcG9uc2l2ZW5lc3NUaWVyKX1gXG4gICAgICAgIDogXCJcIiksXG4gICk7XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIHJlc3BvbnNpdmVuZXNzQ29sb3IodGllcjogUmVzcG9uc2l2ZW5lc3NUaWVyKTogQ29sb3Ige1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwiaGlnaFwiOlxuICAgICAgcmV0dXJuIENvbG9yLkdyZWVuO1xuICAgIGNhc2UgXCJtZWRpdW1cIjpcbiAgICAgIHJldHVybiBDb2xvci5ZZWxsb3c7XG4gICAgY2FzZSBcImxvd1wiOlxuICAgICAgcmV0dXJuIENvbG9yLlJlZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBzcGVlZFRpZXJDb2xvcih0aWVyOiBTcGVlZFRpZXIpOiBDb2xvciB7XG4gIHN3aXRjaCAodGllcikge1xuICAgIGNhc2UgXCJwb29yXCI6XG4gICAgICByZXR1cm4gQ29sb3IuUmVkO1xuICAgIGNhc2UgXCJva1wiOlxuICAgICAgcmV0dXJuIENvbG9yLk9yYW5nZTtcbiAgICBjYXNlIFwiZ29vZFwiOlxuICAgICAgcmV0dXJuIENvbG9yLlllbGxvdztcbiAgICBjYXNlIFwiZ3JlYXRcIjpcbiAgICAgIHJldHVybiBDb2xvci5HcmVlbjtcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICByZXR1cm4gQ29sb3IuQmx1ZTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlIHsgUmVzcG9uc2l2ZW5lc3NUaWVyLCBUZXN0TW9kZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0VGhyb3VnaHB1dChiaXRzUGVyU2VjOiBudW1iZXIgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKGJpdHNQZXJTZWMgPT09IG51bGwpIHJldHVybiBcIlx1MjAxNFwiO1xuICBjb25zdCBtYnBzID0gYml0c1BlclNlYyAvIDFfMDAwXzAwMDtcbiAgaWYgKG1icHMgPj0gMTAwMCkgcmV0dXJuIGAkeyhtYnBzIC8gMTAwMCkudG9GaXhlZCgyKX0gR2Jwc2A7XG4gIGlmIChtYnBzID49IDEwMCkgcmV0dXJuIGAke21icHMudG9GaXhlZCgwKX0gTWJwc2A7XG4gIGlmIChtYnBzID49IDEwKSByZXR1cm4gYCR7bWJwcy50b0ZpeGVkKDEpfSBNYnBzYDtcbiAgcmV0dXJuIGAke21icHMudG9GaXhlZCgyKX0gTWJwc2A7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRMYXRlbmN5KG1zOiBudW1iZXIgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKG1zID09PSBudWxsKSByZXR1cm4gXCJcdTIwMTRcIjtcbiAgcmV0dXJuIG1zID49IDEwID8gYCR7bXMudG9GaXhlZCgwKX0gbXNgIDogYCR7bXMudG9GaXhlZCgxKX0gbXNgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9kZUxhYmVsKG1vZGU6IFRlc3RNb2RlKTogc3RyaW5nIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBcInBhcmFsbGVsXCI6XG4gICAgICByZXR1cm4gXCJQYXJhbGxlbCAoZG93biArIHVwKVwiO1xuICAgIGNhc2UgXCJzZXF1ZW50aWFsXCI6XG4gICAgICByZXR1cm4gXCJTZXF1ZW50aWFsXCI7XG4gICAgY2FzZSBcImRvd25sb2FkXCI6XG4gICAgICByZXR1cm4gXCJEb3dubG9hZCBvbmx5XCI7XG4gICAgY2FzZSBcInVwbG9hZFwiOlxuICAgICAgcmV0dXJuIFwiVXBsb2FkIG9ubHlcIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVzcG9uc2l2ZW5lc3MoXG4gIHJwbTogbnVtYmVyIHwgbnVsbCxcbiAgdGllcjogUmVzcG9uc2l2ZW5lc3NUaWVyIHwgbnVsbCxcbik6IHN0cmluZyB7XG4gIGlmIChycG0gPT09IG51bGwgfHwgdGllciA9PT0gbnVsbCkgcmV0dXJuIFwiXHUyMDE0XCI7XG4gIGNvbnN0IGxhYmVsID0gdGllci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHRpZXIuc2xpY2UoMSk7XG4gIHJldHVybiBgJHtsYWJlbH0gKCR7cnBtLnRvRml4ZWQoMCl9IFJQTSlgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RWxhcHNlZChtczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3Qgc2Vjb25kcyA9IG1zIC8gMTAwMDtcbiAgcmV0dXJuIHNlY29uZHMgPCAxMCA/IGAke3NlY29uZHMudG9GaXhlZCgxKX1zYCA6IGAke01hdGgucm91bmQoc2Vjb25kcyl9c2A7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJQcm9ncmVzc0JhcihmcmFjdGlvbjogbnVtYmVyLCB3aWR0aCA9IDI0KTogc3RyaW5nIHtcbiAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIGZyYWN0aW9uKSk7XG4gIGNvbnN0IGZpbGxlZCA9IE1hdGgucm91bmQoY2xhbXBlZCAqIHdpZHRoKTtcbiAgcmV0dXJuIFwiXHUyNTg4XCIucmVwZWF0KGZpbGxlZCkgKyBcIlx1MjU5MVwiLnJlcGVhdCh3aWR0aCAtIGZpbGxlZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRSZWxhdGl2ZVRpbWUoXG4gIHRzOiBudW1iZXIsXG4gIG5vdzogbnVtYmVyID0gRGF0ZS5ub3coKSxcbik6IHN0cmluZyB7XG4gIGNvbnN0IHNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLnJvdW5kKChub3cgLSB0cykgLyAxMDAwKSk7XG4gIGlmIChzZWNvbmRzIDwgNSkgcmV0dXJuIFwianVzdCBub3dcIjtcbiAgaWYgKHNlY29uZHMgPCA2MCkgcmV0dXJuIGAke3NlY29uZHN9cyBhZ29gO1xuICBjb25zdCBtaW51dGVzID0gTWF0aC5yb3VuZChzZWNvbmRzIC8gNjApO1xuICBpZiAobWludXRlcyA8IDYwKSByZXR1cm4gYCR7bWludXRlc31tIGFnb2A7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5yb3VuZChtaW51dGVzIC8gNjApO1xuICBpZiAoaG91cnMgPCAyNCkgcmV0dXJuIGAke2hvdXJzfWggYWdvYDtcbiAgY29uc3QgZGF5cyA9IE1hdGgucm91bmQoaG91cnMgLyAyNCk7XG4gIHJldHVybiBgJHtkYXlzfWQgYWdvYDtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFNwZWVkVGllciB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG4vKipcbiAqIFRpZXIgYm91bmRhcmllcyBpbiBNYnBzLiBDaG9zZW4gZm9yIDIwMjYgdHlwaWNhbC11c2VyIGNhbGlicmF0aW9uOlxuICogLSBwb29yOiBub3RpY2VhYmxlIGRlZ3JhZGF0aW9uIGZvciBldmVyeWRheSB1c2VcbiAqIC0gb2s6IGhhbmRsZXMgSEQgc3RyZWFtaW5nICsgdmlkZW8gY2FsbHNcbiAqIC0gZ29vZDogY29tZm9ydGFibGUgZm9yIDRLICsgbXVsdGktZGV2aWNlXG4gKiAtIGdyZWF0OiBwb3dlci11c2VyIC8gbXVsdGktNEsgdGVycml0b3J5XG4gKiAtIGV4Y2VsbGVudDogZ2lnYWJpdC1jbGFzc1xuICovXG5jb25zdCBUSUVSX1RIUkVTSE9MRFNfTUJQUzogQXJyYXk8eyB0aWVyOiBTcGVlZFRpZXI7IG1pbjogbnVtYmVyIH0+ID0gW1xuICB7IHRpZXI6IFwiZXhjZWxsZW50XCIsIG1pbjogMTAwMCB9LFxuICB7IHRpZXI6IFwiZ3JlYXRcIiwgbWluOiAyMDAgfSxcbiAgeyB0aWVyOiBcImdvb2RcIiwgbWluOiA1MCB9LFxuICB7IHRpZXI6IFwib2tcIiwgbWluOiAxMCB9LFxuICB7IHRpZXI6IFwicG9vclwiLCBtaW46IDAgfSxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc2lmeVNwZWVkKGJwczogbnVtYmVyKTogU3BlZWRUaWVyIHtcbiAgY29uc3QgbWJwcyA9IGJwcyAvIDFfMDAwXzAwMDtcbiAgcmV0dXJuIFRJRVJfVEhSRVNIT0xEU19NQlBTLmZpbmQoKHQpID0+IG1icHMgPj0gdC5taW4pIS50aWVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BlZWRUaWVyTGFiZWwodGllcjogU3BlZWRUaWVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRpZXIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0aWVyLnNsaWNlKDEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZG93bmxvYWRDb250ZXh0KHRpZXI6IFNwZWVkVGllcik6IHN0cmluZyB7XG4gIHN3aXRjaCAodGllcikge1xuICAgIGNhc2UgXCJwb29yXCI6XG4gICAgICByZXR1cm4gXCJtYXkgc3RydWdnbGUgd2l0aCBIRCB2aWRlb1wiO1xuICAgIGNhc2UgXCJva1wiOlxuICAgICAgcmV0dXJuIFwiSEQgc3RyZWFtaW5nLCB2aWRlbyBjYWxscyBmaW5lXCI7XG4gICAgY2FzZSBcImdvb2RcIjpcbiAgICAgIHJldHVybiBcIjRLIHN0cmVhbWluZywgbXVsdGktZGV2aWNlXCI7XG4gICAgY2FzZSBcImdyZWF0XCI6XG4gICAgICByZXR1cm4gXCJtdWx0aS00SywgZmFzdCBsYXJnZSBkb3dubG9hZHNcIjtcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICByZXR1cm4gXCJnaWdhYml0LWNsYXNzIGNvbm5lY3Rpb25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBsb2FkQ29udGV4dCh0aWVyOiBTcGVlZFRpZXIpOiBzdHJpbmcge1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgcmV0dXJuIFwidmlkZW8gY2FsbHMgbWF5IHN0dXR0ZXJcIjtcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHJldHVybiBcIkhEIHZpZGVvIGNhbGxzIE9LXCI7XG4gICAgY2FzZSBcImdvb2RcIjpcbiAgICAgIHJldHVybiBcImhpZ2gtcXVhbGl0eSBsaXZlIHN0cmVhbWluZ1wiO1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgcmV0dXJuIFwicHJvZmVzc2lvbmFsIHN0cmVhbWluZywgbGFyZ2UgdXBsb2Fkc1wiO1xuICAgIGNhc2UgXCJleGNlbGxlbnRcIjpcbiAgICAgIHJldHVybiBcInN5bW1ldHJpYyBnaWdhYml0XCI7XG4gIH1cbn1cblxuLyoqXG4gKiBSZW5kZXIgYSBsb2ctc2NhbGUgbWV0ZXIgZnJvbSAxIE1icHMgdG8gMTAgR2JwcyAoZm91ciBkZWNhZGVzKS5cbiAqIFJldHVybnMgYSBtdWx0aS1saW5lIGJsb2NrOiBiYXIgKyBheGlzIGxhYmVscywgbW9ub3NwYWNlLlxuICovXG5jb25zdCBNRVRFUl9XSURUSCA9IDI4O1xuY29uc3QgTE9HX01JTiA9IDA7IC8vIGxvZzEwKDEgTWJwcylcbmNvbnN0IExPR19NQVggPSA0OyAvLyBsb2cxMCgxMDAwMCBNYnBzID0gMTAgR2JwcylcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckxvZ01ldGVyKGJwczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgbWJwcyA9IE1hdGgubWF4KDAuMSwgYnBzIC8gMV8wMDBfMDAwKTtcbiAgY29uc3QgbG9nVmFsID0gTWF0aC5sb2cxMChtYnBzKTtcbiAgY29uc3QgZnJhY3Rpb24gPSBNYXRoLm1heChcbiAgICAwLFxuICAgIE1hdGgubWluKDEsIChsb2dWYWwgLSBMT0dfTUlOKSAvIChMT0dfTUFYIC0gTE9HX01JTikpLFxuICApO1xuICBjb25zdCBwb3NpdGlvbiA9IE1hdGgucm91bmQoZnJhY3Rpb24gKiAoTUVURVJfV0lEVEggLSAxKSk7XG5cbiAgbGV0IGJhciA9IFwiXCI7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgTUVURVJfV0lEVEg7IGkrKykge1xuICAgIGlmIChpID09PSBwb3NpdGlvbikgYmFyICs9IFwiXHUyNUJDXCI7XG4gICAgZWxzZSBpZiAoaSAlIDcgPT09IDApXG4gICAgICBiYXIgKz0gXCJcdTI1MEFcIjsgLy8gZGVjYWRlIHRpY2sgYXQgMCwgNywgMTQsIDIxXG4gICAgZWxzZSBiYXIgKz0gXCJcdTI1MDBcIjtcbiAgfVxuXG4gIC8vIEF4aXMgbGFiZWxzOiAxTSgwKSAgMTBNKDcpICAxMDBNKDE0KSAgMUcoMjEpICAxMEcoMjcpXG4gIGNvbnN0IGF4aXMgPSBsYXlvdXRBeGlzKFtcbiAgICB7IGNvbDogMCwgdGV4dDogXCIxTVwiIH0sXG4gICAgeyBjb2w6IDcsIHRleHQ6IFwiMTBNXCIgfSxcbiAgICB7IGNvbDogMTQsIHRleHQ6IFwiMTAwTVwiIH0sXG4gICAgeyBjb2w6IDIxLCB0ZXh0OiBcIjFHXCIgfSxcbiAgICB7IGNvbDogMjcsIHRleHQ6IFwiMTBHXCIgfSxcbiAgXSk7XG5cbiAgcmV0dXJuIGAke2Jhcn1cXG4ke2F4aXN9YDtcbn1cblxuZnVuY3Rpb24gbGF5b3V0QXhpcyhsYWJlbHM6IEFycmF5PHsgY29sOiBudW1iZXI7IHRleHQ6IHN0cmluZyB9Pik6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmU6IHN0cmluZ1tdID0gQXJyYXkoTUVURVJfV0lEVEggKyAzKS5maWxsKFwiIFwiKTtcbiAgZm9yIChjb25zdCB7IGNvbCwgdGV4dCB9IG9mIGxhYmVscykge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgYyA9IGNvbCArIGk7XG4gICAgICBpZiAoYyA8IGxpbmUubGVuZ3RoKSBsaW5lW2NdID0gdGV4dFtpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxpbmUuam9pbihcIlwiKS50cmltRW5kKCk7XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBOZXR3b3JrVGVzdFJlc3VsdCB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgY2xhc3NpZnlTcGVlZCB9IGZyb20gXCIuL3NwZWVkXCI7XG5cbi8qKlxuICogRGV0ZXJtaW5pc3RpYyBwbGFpbi1FbmdsaXNoIHZlcmRpY3QgZm9yIGEgcmVzdWx0LiBPbmUgc2VudGVuY2UuXG4gKiBEZXNpZ25lZCBmb3Igc29tZW9uZSB3aG8gZG9lc24ndCBrbm93IHdoYXQgUlBNIG1lYW5zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVTdW1tYXJ5KHJlc3VsdDogTmV0d29ya1Rlc3RSZXN1bHQpOiBzdHJpbmcge1xuICBjb25zdCBkbFRpZXIgPVxuICAgIHJlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbCA/IGNsYXNzaWZ5U3BlZWQocmVzdWx0LmRvd25sb2FkQnBzKSA6IG51bGw7XG4gIGNvbnN0IHVsVGllciA9XG4gICAgcmVzdWx0LnVwbG9hZEJwcyAhPT0gbnVsbCA/IGNsYXNzaWZ5U3BlZWQocmVzdWx0LnVwbG9hZEJwcykgOiBudWxsO1xuICBjb25zdCByZXNwTG93ID0gcmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllciA9PT0gXCJsb3dcIjtcblxuICAvLyBObyBtZWFzdXJlbWVudHMgYXQgYWxsIFx1MjAxNCBzaG91bGRuJ3QgcmVhbGx5IGhhcHBlblxuICBpZiAoZGxUaWVyID09PSBudWxsICYmIHVsVGllciA9PT0gbnVsbCkge1xuICAgIHJldHVybiBcIkNvdWxkbid0IG1lYXN1cmUgdGhyb3VnaHB1dC4gQ29ubmVjdGlvbiBtYXkgYmUgdW5zdGFibGUuXCI7XG4gIH1cblxuICAvLyBTaW5nbGUgZGlyZWN0aW9uIG9ubHlcbiAgaWYgKGRsVGllciA9PT0gbnVsbCkgcmV0dXJuIHZlcmRpY3RVcGxvYWQodWxUaWVyISwgcmVzcExvdyk7XG4gIGlmICh1bFRpZXIgPT09IG51bGwpIHJldHVybiB2ZXJkaWN0RG93bmxvYWQoZGxUaWVyLCByZXNwTG93KTtcblxuICAvLyBDb21iaW5lZCB2ZXJkaWN0XG4gIGNvbnN0IG1pbiA9IG1pblRpZXIoZGxUaWVyLCB1bFRpZXIpO1xuICBsZXQgdmVyZGljdDogc3RyaW5nO1xuICBzd2l0Y2ggKG1pbikge1xuICAgIGNhc2UgXCJwb29yXCI6XG4gICAgICB2ZXJkaWN0ID1cbiAgICAgICAgXCJTbG93IGNvbm5lY3Rpb24gXHUyMDE0IGJhc2ljIGJyb3dzaW5nIG9ubHksIGV4cGVjdCBpc3N1ZXMgd2l0aCB2aWRlbyBjYWxscy5cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJva1wiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiRGVjZW50IGNvbm5lY3Rpb24gXHUyMDE0IEhEIHN0cmVhbWluZyBhbmQgb25lLW9uLW9uZSB2aWRlbyBjYWxscyBzaG91bGQgd29yay5cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJnb29kXCI6XG4gICAgICB2ZXJkaWN0ID1cbiAgICAgICAgXCJTb2xpZCBjb25uZWN0aW9uIFx1MjAxNCBoYW5kbGVzIDRLIHN0cmVhbWluZyBhbmQgbW9zdCB2aWRlbyB3b3JrIGNvbWZvcnRhYmx5LlwiO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImdyZWF0XCI6XG4gICAgICB2ZXJkaWN0ID1cbiAgICAgICAgXCJGYXN0IGNvbm5lY3Rpb24gXHUyMDE0IHBsZW50eSBvZiBoZWFkcm9vbSBmb3Igc3RyZWFtaW5nLCBjYWxscywgYW5kIGxhcmdlIHRyYW5zZmVycy5cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJleGNlbGxlbnRcIjpcbiAgICAgIHZlcmRpY3QgPVxuICAgICAgICBcIkV4Y2VsbGVudCBjb25uZWN0aW9uIFx1MjAxNCBnaWdhYml0LWNsYXNzLCBubyBwcmFjdGljYWwgYm90dGxlbmVja3MuXCI7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIGlmIChyZXNwTG93KSB7XG4gICAgdmVyZGljdCArPVxuICAgICAgXCIgUmVzcG9uc2l2ZW5lc3MgaXMgbG93IHRob3VnaCBcdTIwMTQgdmlkZW8gY2FsbHMgYW5kIGdhbWluZyBtYXkgc3R1dHRlciB1bmRlciBsb2FkIChidWZmZXJibG9hdCkuXCI7XG4gIH1cbiAgcmV0dXJuIHZlcmRpY3Q7XG59XG5cbmZ1bmN0aW9uIHZlcmRpY3REb3dubG9hZChcbiAgdGllcjogTm9uTnVsbGFibGU8UmV0dXJuVHlwZTx0eXBlb2YgY2xhc3NpZnlTcGVlZD4+LFxuICByZXNwTG93OiBib29sZWFuLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgYmFzZSA9IHtcbiAgICBwb29yOiBcIkRvd25sb2FkIGlzIHNsb3cgXHUyMDE0IEhEIHN0cmVhbWluZyB3aWxsIHN0cnVnZ2xlLlwiLFxuICAgIG9rOiBcIkRvd25sb2FkIGlzIE9LIGZvciBIRCBzdHJlYW1pbmcgYW5kIGJhc2ljIHVzZS5cIixcbiAgICBnb29kOiBcIkRvd25sb2FkIGlzIHNvbGlkIFx1MjAxNCA0SyBzdHJlYW1pbmcgd29ya3MgY29tZm9ydGFibHkuXCIsXG4gICAgZ3JlYXQ6IFwiRG93bmxvYWQgaXMgZmFzdCBcdTIwMTQgcGxlbnR5IG9mIGhlYWRyb29tIGZvciBoZWF2eSB1c2UuXCIsXG4gICAgZXhjZWxsZW50OiBcIkRvd25sb2FkIGlzIGdpZ2FiaXQtY2xhc3MuXCIsXG4gIH1bdGllcl07XG4gIHJldHVybiByZXNwTG93ID8gYCR7YmFzZX0gUmVzcG9uc2l2ZW5lc3MgaXMgbG93IChidWZmZXJibG9hdCkuYCA6IGJhc2U7XG59XG5cbmZ1bmN0aW9uIHZlcmRpY3RVcGxvYWQoXG4gIHRpZXI6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PixcbiAgcmVzcExvdzogYm9vbGVhbixcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgcG9vcjogXCJVcGxvYWQgaXMgc2xvdyBcdTIwMTQgdmlkZW8gY2FsbHMgYW5kIHVwbG9hZHMgd2lsbCBiZSBwYWluZnVsLlwiLFxuICAgIG9rOiBcIlVwbG9hZCBoYW5kbGVzIEhEIHZpZGVvIGNhbGxzLlwiLFxuICAgIGdvb2Q6IFwiVXBsb2FkIGlzIHNvbGlkIFx1MjAxNCBmaW5lIGZvciBsaXZlIHN0cmVhbWluZy5cIixcbiAgICBncmVhdDpcbiAgICAgIFwiVXBsb2FkIGlzIGZhc3QgXHUyMDE0IHByb2Zlc3Npb25hbCBzdHJlYW1pbmcgYW5kIGxhcmdlIHVwbG9hZHMgd29yayB3ZWxsLlwiLFxuICAgIGV4Y2VsbGVudDogXCJVcGxvYWQgaXMgZ2lnYWJpdC1jbGFzcyBcdTIwMTQgc3ltbWV0cmljIGNvbm5lY3Rpb24uXCIsXG4gIH1bdGllcl07XG4gIHJldHVybiByZXNwTG93ID8gYCR7YmFzZX0gUmVzcG9uc2l2ZW5lc3MgaXMgbG93IChidWZmZXJibG9hdCkuYCA6IGJhc2U7XG59XG5cbmZ1bmN0aW9uIG1pblRpZXIoXG4gIGE6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PixcbiAgYjogTm9uTnVsbGFibGU8UmV0dXJuVHlwZTx0eXBlb2YgY2xhc3NpZnlTcGVlZD4+LFxuKTogTm9uTnVsbGFibGU8UmV0dXJuVHlwZTx0eXBlb2YgY2xhc3NpZnlTcGVlZD4+IHtcbiAgY29uc3Qgb3JkZXIgPSBbXCJwb29yXCIsIFwib2tcIiwgXCJnb29kXCIsIFwiZ3JlYXRcIiwgXCJleGNlbGxlbnRcIl0gYXMgY29uc3Q7XG4gIHJldHVybiBvcmRlci5pbmRleE9mKGEpIDwgb3JkZXIuaW5kZXhPZihiKSA/IGEgOiBiO1xufVxuIiwgImltcG9ydCB7IGV4ZWNGaWxlIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSBcIm5vZGU6dXRpbFwiO1xuaW1wb3J0IHR5cGUgeyBJbnRlcmZhY2VUeXBlLCBOZXR3b3JrSW50ZXJmYWNlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IGV4ZWNGaWxlQXN5bmMgPSBwcm9taXNpZnkoZXhlY0ZpbGUpO1xuXG5jb25zdCBDTURfVElNRU9VVF9NUyA9IDRfMDAwO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBldmVyeSBCU0QgbmV0d29yayBkZXZpY2UsIGRlY29yYXRlIHdpdGggc3RhdHVzLCBJUCwgU1NJRCwgdHlwZS5cbiAqIFNvcnRlZDogYWN0aXZlIGZpcnN0LCBkZWZhdWx0IHJvdXRlIGZpcnN0IHdpdGhpbiBhY3RpdmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0SW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICBjb25zdCBbcG9ydHMsIGRlZmF1bHRJZmFjZV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgbGlzdEhhcmR3YXJlUG9ydHMoKSxcbiAgICBnZXREZWZhdWx0SW50ZXJmYWNlKCksXG4gIF0pO1xuXG4gIGNvbnN0IGRlY29yYXRlZCA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIHBvcnRzLm1hcChhc3luYyAocCkgPT4ge1xuICAgICAgY29uc3QgW2FjdGl2ZSwgaXB2NF0gPSBhd2FpdCByZWFkSWZjb25maWcocC5kZXZpY2UpO1xuICAgICAgY29uc3QgdHlwZSA9IGNsYXNzaWZ5VHlwZShwLmhhcmR3YXJlUG9ydCk7XG4gICAgICBjb25zdCBzc2lkID0gdHlwZSA9PT0gXCJ3aWZpXCIgPyBhd2FpdCByZWFkU1NJRChwLmRldmljZSkgOiBudWxsO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogcC5kZXZpY2UsXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGhhcmR3YXJlUG9ydDogcC5oYXJkd2FyZVBvcnQsXG4gICAgICAgIHNzaWQsXG4gICAgICAgIGlwdjQsXG4gICAgICAgIGFjdGl2ZSxcbiAgICAgICAgaXNEZWZhdWx0OiBwLmRldmljZSA9PT0gZGVmYXVsdElmYWNlLFxuICAgICAgICBpc0hvdHNwb3Q6IHR5cGUgPT09IFwid2lmaVwiICYmIGlzSG90c3BvdElwKGlwdjQpLFxuICAgICAgfSBzYXRpc2ZpZXMgTmV0d29ya0ludGVyZmFjZTtcbiAgICB9KSxcbiAgKTtcblxuICByZXR1cm4gZGVjb3JhdGVkLnNvcnQoY29tcGFyZUludGVyZmFjZXMpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QWN0aXZlSW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICByZXR1cm4gKGF3YWl0IGxpc3RJbnRlcmZhY2VzKCkpLmZpbHRlcigoaSkgPT4gaS5hY3RpdmUpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGVmYXVsdEludGVyZmFjZURldGFpbHMoKTogUHJvbWlzZTxOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbD4ge1xuICBjb25zdCBhbGwgPSBhd2FpdCBsaXN0SW50ZXJmYWNlcygpO1xuICByZXR1cm4gYWxsLmZpbmQoKGkpID0+IGkuaXNEZWZhdWx0KSA/PyBhbGwuZmluZCgoaSkgPT4gaS5hY3RpdmUpID8/IG51bGw7XG59XG5cbi8qKiBQcmV0dHktcHJpbnQ6IFwiV2ktRmkgXHUwMEI3IEhvbWVOZXRcIiBvciBcIkhvdHNwb3QgXHUwMEI3IGlQaG9uZVwiICovXG5leHBvcnQgZnVuY3Rpb24gZGlzcGxheU5hbWUoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBzdHJpbmcge1xuICBjb25zdCBwb3J0TGFiZWwgPSBwb3J0U2hvcnRMYWJlbChpZmFjZSk7XG4gIGlmIChpZmFjZS5zc2lkKSByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5zc2lkfWA7XG4gIGlmIChpZmFjZS5pc0hvdHNwb3QgJiYgaWZhY2UuaXB2NCkgcmV0dXJuIGAke3BvcnRMYWJlbH0gXHUwMEI3ICR7aWZhY2UuaXB2NH1gO1xuICBpZiAoaWZhY2UudHlwZSA9PT0gXCJ3aWZpXCIgJiYgaWZhY2UuYWN0aXZlKVxuICAgIHJldHVybiBgJHtwb3J0TGFiZWx9IFx1MDBCNyAobmFtZSB1bmF2YWlsYWJsZSlgO1xuICByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5uYW1lfWA7XG59XG5cbmZ1bmN0aW9uIHBvcnRTaG9ydExhYmVsKGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlKTogc3RyaW5nIHtcbiAgaWYgKGlmYWNlLmlzSG90c3BvdCkgcmV0dXJuIFwiSG90c3BvdFwiO1xuICBzd2l0Y2ggKGlmYWNlLnR5cGUpIHtcbiAgICBjYXNlIFwid2lmaVwiOlxuICAgICAgcmV0dXJuIFwiV2ktRmlcIjtcbiAgICBjYXNlIFwiZXRoZXJuZXRcIjpcbiAgICAgIHJldHVybiBcIkV0aGVybmV0XCI7XG4gICAgY2FzZSBcInRodW5kZXJib2x0XCI6XG4gICAgICByZXR1cm4gXCJUaHVuZGVyYm9sdFwiO1xuICAgIGNhc2UgXCJ1c2JcIjpcbiAgICAgIHJldHVybiAvaXBob25lL2kudGVzdChpZmFjZS5oYXJkd2FyZVBvcnQpID8gXCJpUGhvbmUgVVNCXCIgOiBcIlVTQlwiO1xuICAgIGNhc2UgXCJibHVldG9vdGhcIjpcbiAgICAgIHJldHVybiBcIkJsdWV0b290aFwiO1xuICAgIGNhc2UgXCJvdGhlclwiOlxuICAgICAgcmV0dXJuIGlmYWNlLmhhcmR3YXJlUG9ydDtcbiAgfVxufVxuXG4vKipcbiAqIEtub3duIHRldGhlcmluZyAvIFBlcnNvbmFsIEhvdHNwb3Qgc3VibmV0cy4gaVBob25lIFBlcnNvbmFsIEhvdHNwb3QgdXNlc1xuICogMTcyLjIwLjEwLjAvMjg7IGNvbW1vbiBBbmRyb2lkIHRldGhlcmluZyByYW5nZXMgYXJlIDE5Mi4xNjguNDMueCBhbmRcbiAqIDE5Mi4xNjguNDkueC4gVGhlc2UgYXJlIGRldmljZSBkZWZhdWx0cyBcdTIwMTQgc2F2dnkgdXNlcnMgY2FuIGNoYW5nZSB0aGVtXG4gKiBidXQgdmlydHVhbGx5IG5vYm9keSBkb2VzLlxuICovXG5jb25zdCBIT1RTUE9UX1BSRUZJWEVTID0gW1wiMTcyLjIwLjEwLlwiLCBcIjE5Mi4xNjguNDMuXCIsIFwiMTkyLjE2OC40OS5cIl07XG5cbmZ1bmN0aW9uIGlzSG90c3BvdElwKGlwdjQ6IHN0cmluZyB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCFpcHY0KSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBIT1RTUE9UX1BSRUZJWEVTLnNvbWUoKHApID0+IGlwdjQuc3RhcnRzV2l0aChwKSk7XG59XG5cbi8vIC0tLS0gbG93LWxldmVsIGNvbW1hbmQgd3JhcHBlcnMgLS0tLVxuXG5pbnRlcmZhY2UgSGFyZHdhcmVQb3J0IHtcbiAgaGFyZHdhcmVQb3J0OiBzdHJpbmc7XG4gIGRldmljZTogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsaXN0SGFyZHdhcmVQb3J0cygpOiBQcm9taXNlPEhhcmR3YXJlUG9ydFtdPiB7XG4gIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgIFwiL3Vzci9zYmluL25ldHdvcmtzZXR1cFwiLFxuICAgIFtcIi1saXN0YWxsaGFyZHdhcmVwb3J0c1wiXSxcbiAgICB7IHRpbWVvdXQ6IENNRF9USU1FT1VUX01TIH0sXG4gICk7XG5cbiAgY29uc3QgcG9ydHM6IEhhcmR3YXJlUG9ydFtdID0gW107XG4gIGxldCBjdXJyZW50UG9ydDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgcmF3TGluZSBvZiBzdGRvdXQuc3BsaXQoXCJcXG5cIikpIHtcbiAgICBjb25zdCBsaW5lID0gcmF3TGluZS50cmltKCk7XG4gICAgY29uc3QgcG9ydE1hdGNoID0gbGluZS5tYXRjaCgvXkhhcmR3YXJlIFBvcnQ6XFxzKiguKykkLyk7XG4gICAgaWYgKHBvcnRNYXRjaCkge1xuICAgICAgY3VycmVudFBvcnQgPSBwb3J0TWF0Y2hbMV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZGV2aWNlTWF0Y2ggPSBsaW5lLm1hdGNoKC9eRGV2aWNlOlxccyooXFxTKykkLyk7XG4gICAgaWYgKGRldmljZU1hdGNoICYmIGN1cnJlbnRQb3J0KSB7XG4gICAgICBwb3J0cy5wdXNoKHsgaGFyZHdhcmVQb3J0OiBjdXJyZW50UG9ydCwgZGV2aWNlOiBkZXZpY2VNYXRjaFsxXSB9KTtcbiAgICAgIGN1cnJlbnRQb3J0ID0gbnVsbDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBvcnRzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXREZWZhdWx0SW50ZXJmYWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvc2Jpbi9yb3V0ZVwiLFxuICAgICAgW1wiLW5cIiwgXCJnZXRcIiwgXCJkZWZhdWx0XCJdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqaW50ZXJmYWNlOlxccyooXFxTKykvbSk7XG4gICAgcmV0dXJuIG1hdGNoPy5bMV0gPz8gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqIFJldHVybnMgW2FjdGl2ZSwgaXB2NE9yTnVsbF0uIEFjdGl2ZSA9IFwic3RhdHVzOiBhY3RpdmVcIiArIGhhcyBpbmV0IGxpbmUuICovXG5hc3luYyBmdW5jdGlvbiByZWFkSWZjb25maWcoZGV2aWNlOiBzdHJpbmcpOiBQcm9taXNlPFtib29sZWFuLCBzdHJpbmcgfCBudWxsXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFwiL3NiaW4vaWZjb25maWdcIiwgW2RldmljZV0sIHtcbiAgICAgIHRpbWVvdXQ6IENNRF9USU1FT1VUX01TLFxuICAgIH0pO1xuICAgIGNvbnN0IGlwdjRNYXRjaCA9IHN0ZG91dC5tYXRjaCgvXlxccyppbmV0XFxzKyhcXGQrXFwuXFxkK1xcLlxcZCtcXC5cXGQrKVxcYi9tKTtcbiAgICBjb25zdCBzdGF0dXNBY3RpdmUgPSAvXFxic3RhdHVzOlxccyphY3RpdmVcXGIvLnRlc3Qoc3Rkb3V0KTtcbiAgICBjb25zdCBhY3RpdmUgPSBzdGF0dXNBY3RpdmUgJiYgaXB2NE1hdGNoICE9PSBudWxsO1xuICAgIHJldHVybiBbYWN0aXZlLCBpcHY0TWF0Y2g/LlsxXSA/PyBudWxsXTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtmYWxzZSwgbnVsbF07XG4gIH1cbn1cblxuLyoqXG4gKiBTZW50aW5lbCBzdHJpbmdzIG1hY09TIHJldHVybnMgd2hlbiB0aGUgU1NJRCBleGlzdHMgYnV0IGlzbid0IHJlYWRhYmxlLlxuICogYDxyZWRhY3RlZD5gIGNvbWVzIGZyb20gYGlwY29uZmlnIGdldHN1bW1hcnlgIHdpdGhvdXQgTG9jYXRpb24gU2VydmljZXNcbiAqIHBlcm1pc3Npb24gKGludHJvZHVjZWQgaW4gbWFjT1MgU29ub21hKS4gYChudWxsKWAgaXMgdGhlIG9sZGVyIGZvcm0uXG4gKiBXZSB0cmVhdCBhbGwgb2YgdGhlc2UgYXMgXCJ1bmtub3duXCIgcmF0aGVyIHRoYW4gbGV0dGluZyB0aGUgbGl0ZXJhbCB0ZXh0XG4gKiBsZWFrIGludG8gdGhlIFVJLlxuICovXG5jb25zdCBVTlJFQURBQkxFX1NTSURfTUFSS0VSUyA9IG5ldyBTZXQoW1wiPHJlZGFjdGVkPlwiLCBcIihudWxsKVwiLCBcIlwiXSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRTU0lEKGRldmljZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgICBcIi91c3Ivc2Jpbi9pcGNvbmZpZ1wiLFxuICAgICAgW1wiZ2V0c3VtbWFyeVwiLCBkZXZpY2VdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqU1NJRFxccyo6XFxzKiguKz8pXFxzKiQvbSk7XG4gICAgY29uc3Qgc3NpZCA9IG1hdGNoPy5bMV0/LnRyaW0oKSA/PyBcIlwiO1xuICAgIGlmIChVTlJFQURBQkxFX1NTSURfTUFSS0VSUy5oYXMoc3NpZCkpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBzc2lkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRydWUgd2hlbiB0aGUgaW50ZXJmYWNlIGlzIFdpLUZpLWNsYXNzIGFuZCB3ZSBjb3VsZG4ndCByZWFkIGFuIFNTSUQsXG4gKiBhbG1vc3QgYWx3YXlzIGJlY2F1c2UgUmF5Y2FzdCBsYWNrcyBMb2NhdGlvbiBTZXJ2aWNlcyBwZXJtaXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTU0lEUGVybWlzc2lvbk1pc3NpbmcoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlmYWNlLmFjdGl2ZSAmJiBpZmFjZS50eXBlID09PSBcIndpZmlcIiAmJiBpZmFjZS5zc2lkID09PSBudWxsO1xufVxuXG4vLyAtLS0tIFdpLUZpIHN3aXRjaGluZyAodXNlZCBieSBjb21wYXJlLW5ldHdvcmtzKSAtLS0tXG5cbi8qKiBSZXR1cm5zIHRoZSBCU0QgbmFtZSAoZW4wLCBlbjIsIC4uLikgb2YgdGhlIHByaW1hcnkgV2ktRmkgYWRhcHRlciwgb3IgbnVsbC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXaWZpRGV2aWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBwb3J0cyA9IGF3YWl0IGxpc3RIYXJkd2FyZVBvcnRzKCk7XG4gIGNvbnN0IHdpZmkgPSBwb3J0cy5maW5kKChwKSA9PiAvd2ktZml8YWlycG9ydC9pLnRlc3QocC5oYXJkd2FyZVBvcnQpKTtcbiAgcmV0dXJuIHdpZmk/LmRldmljZSA/PyBudWxsO1xufVxuXG4vKiogUmVhZCBjdXJyZW50IFdpLUZpIFNTSUQgdmlhIGlwY29uZmlnIChyZXR1cm5zIG51bGwgaWYgbm8gcGVybXMgb3Igbm90IGNvbm5lY3RlZCkuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudFdpZmlTU0lEKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBkZXZpY2UgPSBhd2FpdCBnZXRXaWZpRGV2aWNlKCk7XG4gIGlmICghZGV2aWNlKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHJlYWRTU0lEKGRldmljZSk7XG59XG5cbi8qKlxuICogTGlzdCBzYXZlZCBXaS1GaSBuZXR3b3JrcyBvbiB0aGlzIE1hYy4gVGhlc2UgYXJlIGNhbmRpZGF0ZXMgZm9yIHN3aXRjaGluZyB0b1xuICogZHVyaW5nIGNvbXBhcmUgcnVucyBcdTIwMTQgbWFjT1Mgd2lsbCB1c2UgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZC5cbiAqXG4gKiBOb3RlOiB0aGlzIGlzICprbm93biogbmV0d29ya3MsIG5vdCAqaW4tcmFuZ2UqIG5ldHdvcmtzLiBBIHRydWUgaW4tcmFuZ2VcbiAqIHNjYW4gbmVlZHMgYHdkdXRpbCBzY2FuYCAoc3Vkbykgb3IgdGhlIHJlbW92ZWQgYGFpcnBvcnQgLXNgIGNvbW1hbmQuIFdpdGhvdXRcbiAqIHRob3NlLCB3ZSBhdHRlbXB0IHRoZSBzd2l0Y2ggYW5kIGxldCBpdCBmYWlsIGZhc3QgaWYgdGhlIG5ldHdvcmsgaXNuJ3QgYXJvdW5kLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdEtub3duV2lmaU5ldHdvcmtzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgZGV2aWNlID0gYXdhaXQgZ2V0V2lmaURldmljZSgpO1xuICBpZiAoIWRldmljZSkgcmV0dXJuIFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgICBbXCItbGlzdHByZWZlcnJlZHdpcmVsZXNzbmV0d29ya3NcIiwgZGV2aWNlXSxcbiAgICAgIHsgdGltZW91dDogQ01EX1RJTUVPVVRfTVMgfSxcbiAgICApO1xuICAgIC8vIE91dHB1dDpcbiAgICAvLyAgIFByZWZlcnJlZCBuZXR3b3JrcyBvbiBlbjA6XG4gICAgLy8gICBcXHROZXR3b3JrQVxuICAgIC8vICAgXFx0TmV0d29ya0JcbiAgICByZXR1cm4gc3Rkb3V0XG4gICAgICAuc3BsaXQoXCJcXG5cIilcbiAgICAgIC5zbGljZSgxKVxuICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKChsKSA9PiBsLmxlbmd0aCA+IDApO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiBTd2l0Y2ggV2ktRmkgdG8gdGhlIGdpdmVuIFNTSUQuIFVzZXMgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZCBpZiBrbm93bi5cbiAqIFRocm93cyBvbiBmYWlsdXJlIChuZXR3b3JrIG5vdCBpbiByYW5nZSwgYXV0aCBmYWlsZWQsIHVua25vd24gbmV0d29yaykuXG4gKlxuICogU3BlY2lhbCBjYXNlOiBpUGhvbmUvaVBhZCBQZXJzb25hbCBIb3RzcG90LiBUaGVzZSBvZnRlbiBhcHBlYXIgaW4gdGhlXG4gKiBwcmVmZXJyZWQtbmV0d29ya3MgbGlzdCBidXQgYXJlIGFjdGl2YXRlZCB2aWEgQmx1ZXRvb3RoL0NvbnRpbnVpdHksIG5vdFxuICogYSByZWFsIFdpLUZpIGJyb2FkY2FzdC4gYG5ldHdvcmtzZXR1cGAgY2FuJ3QgdHJpZ2dlciB0aGF0IGFjdGl2YXRpb24gXHUyMDE0XG4gKiB3ZSBzdXJmYWNlIGEgdGFpbG9yZWQgaGludCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBpbnN0ZWFkIG9mIHRoZSByYXdcbiAqIFwiQ291bGQgbm90IGZpbmQgbmV0d29ya1wiIG91dHB1dCwgd2hpY2ggaXMgY29uZnVzaW5nIGhlcmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzd2l0Y2hXaWZpVG8oXG4gIGRldmljZTogc3RyaW5nLFxuICBzc2lkOiBzdHJpbmcsXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgW1wiLXNldGFpcnBvcnRuZXR3b3JrXCIsIGRldmljZSwgc3NpZF0sXG4gICAgeyB0aW1lb3V0OiAyMF8wMDAsIHNpZ25hbCB9LFxuICApO1xuICBjb25zdCBjb21iaW5lZCA9IGAke3N0ZG91dH1cXG4ke3N0ZGVycn1gLnRvTG93ZXJDYXNlKCk7XG4gIC8vIG5ldHdvcmtzZXR1cCByZXR1cm5zIGV4aXQgMCBldmVuIG9uIGZhaWx1cmU7IGhhdmUgdG8gc2NhbiBvdXRwdXRcbiAgaWYgKFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZmFpbGVkXCIpIHx8XG4gICAgY29tYmluZWQuaW5jbHVkZXMoXCJjb3VsZCBub3QgZmluZFwiKSB8fFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZXJyb3JcIilcbiAgKSB7XG4gICAgaWYgKGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGAke3NzaWR9IGlzIGEgUGVyc29uYWwgSG90c3BvdCBcdTIwMTQgYWN0aXZhdGUgaXQgdmlhIHRoZSBXaS1GaSBtZW51IGJhciAoQ29udGludWl0eSksIHRoZW4gcmUtcnVuLiBuZXR3b3Jrc2V0dXAgY2FuJ3QgdHJpZ2dlciBDb250aW51aXR5LmAsXG4gICAgICApO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgJHtzc2lkfSBub3QgaW4gcmFuZ2Ugb3IgdW5yZWFjaGFibGUgKHJhdzogJHtzdGRvdXQudHJpbSgpIHx8IHN0ZGVyci50cmltKCkgfHwgXCJubyBvdXRwdXRcIn0pYCxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogSGV1cmlzdGljOiBpcyB0aGlzIFNTSUQgbGlrZWx5IGFuIGlQaG9uZS9pUGFkIFBlcnNvbmFsIEhvdHNwb3Qgcm91dGVkXG4gKiB0aHJvdWdoIENvbnRpbnVpdHk/IFRoZXNlIG5lZWQgbWFudWFsIGFjdGl2YXRpb24gdmlhIHRoZSBXaS1GaSBtZW51IFx1MjAxNFxuICogbm8gQ0xJIHRvb2wgY2FuIHRyaWdnZXIgdGhlbS5cbiAqXG4gKiBQYXR0ZXJuOiBtYWNPUyBkZWZhdWx0cyBQZXJzb25hbCBIb3RzcG90IFNTSUQgdG8gdGhlIGRldmljZSBuYW1lLCB3aGljaFxuICogYnkgZGVmYXVsdCBpcyBcIjxGaXJzdCBuYW1lPidzIGlQaG9uZVwiIG9yIFwiPEZpcnN0IG5hbWU+J3MgaVBhZFwiLiBVc2Vyc1xuICogY2FuIHJlbmFtZSB0aGVpciBkZXZpY2VzLCBidXQgdGhlIGlQaG9uZS9pUGFkIGtleXdvcmQgdXN1YWxseSBzdXJ2aXZlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1xcYihpcGhvbmV8aXBhZClcXGIvaS50ZXN0KHNzaWQpO1xufVxuXG4vKipcbiAqIFBvbGwgaWZjb25maWcgdW50aWwgdGhlIGRldmljZSBpcyB1cCB3aXRoIGFuIGluZXQgYWRkcmVzcywgb3IgdGltZW91dC5cbiAqIElmIGV4cGVjdGVkU1NJRCBpcyBwcm92aWRlZCBhbmQgd2UgY2FuIHJlYWQgU1NJRHMsIGFsc28gd2FpdCB1bnRpbCBpdCBtYXRjaGVzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvcldpZmlSZWFkeShcbiAgZGV2aWNlOiBzdHJpbmcsXG4gIGV4cGVjdGVkU1NJRDogc3RyaW5nIHwgbnVsbCxcbiAgdGltZW91dE1zID0gMjBfMDAwLFxuICBzaWduYWw/OiBBYm9ydFNpZ25hbCxcbik6IFByb21pc2U8eyBhY3RpdmU6IGJvb2xlYW47IHNzaWQ6IHN0cmluZyB8IG51bGwgfT4ge1xuICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQgPCB0aW1lb3V0TXMpIHtcbiAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSByZXR1cm4geyBhY3RpdmU6IGZhbHNlLCBzc2lkOiBudWxsIH07XG4gICAgY29uc3QgW2FjdGl2ZV0gPSBhd2FpdCByZWFkSWZjb25maWcoZGV2aWNlKTtcbiAgICBpZiAoYWN0aXZlKSB7XG4gICAgICBjb25zdCBzc2lkID0gYXdhaXQgcmVhZFNTSUQoZGV2aWNlKTtcbiAgICAgIC8vIElmIHdlIGNhbid0IHJlYWQgU1NJRCBhdCBhbGwgKG5vIExvY2F0aW9uIHBlcm1zKSwgdHJ1c3QgdGhlIHN3aXRjaC5cbiAgICAgIC8vIE90aGVyd2lzZSByZXF1aXJlIGl0IHRvIG1hdGNoIHdoYXQgd2UgYXNrZWQgZm9yLlxuICAgICAgaWYgKGV4cGVjdGVkU1NJRCA9PT0gbnVsbCB8fCBzc2lkID09PSBudWxsIHx8IHNzaWQgPT09IGV4cGVjdGVkU1NJRCkge1xuICAgICAgICByZXR1cm4geyBhY3RpdmU6IHRydWUsIHNzaWQgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXdhaXQgc2xlZXAoNTAwLCBzaWduYWwpO1xuICB9XG4gIHJldHVybiB7IGFjdGl2ZTogZmFsc2UsIHNzaWQ6IG51bGwgfTtcbn1cblxuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlciwgc2lnbmFsPzogQWJvcnRTaWduYWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3QgdCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgIFwiYWJvcnRcIixcbiAgICAgICgpID0+IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHQpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9LFxuICAgICAgeyBvbmNlOiB0cnVlIH0sXG4gICAgKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5VHlwZShoYXJkd2FyZVBvcnQ6IHN0cmluZyk6IEludGVyZmFjZVR5cGUge1xuICBjb25zdCBwID0gaGFyZHdhcmVQb3J0LnRvTG93ZXJDYXNlKCk7XG4gIGlmIChwLmluY2x1ZGVzKFwid2ktZmlcIikgfHwgcC5pbmNsdWRlcyhcImFpcnBvcnRcIikpIHJldHVybiBcIndpZmlcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJ0aHVuZGVyYm9sdFwiKSB8fCBwLmluY2x1ZGVzKFwiYnJpZGdlXCIpKSByZXR1cm4gXCJ0aHVuZGVyYm9sdFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImlwaG9uZVwiKSB8fCBwLmluY2x1ZGVzKFwiaXBhZFwiKSkgcmV0dXJuIFwidXNiXCI7XG4gIGlmIChwLmluY2x1ZGVzKFwidXNiXCIpKSByZXR1cm4gXCJ1c2JcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJibHVldG9vdGhcIikpIHJldHVybiBcImJsdWV0b290aFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImV0aGVybmV0XCIpIHx8IHAuaW5jbHVkZXMoXCJsYW5cIikpIHJldHVybiBcImV0aGVybmV0XCI7XG4gIHJldHVybiBcIm90aGVyXCI7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVJbnRlcmZhY2VzKGE6IE5ldHdvcmtJbnRlcmZhY2UsIGI6IE5ldHdvcmtJbnRlcmZhY2UpOiBudW1iZXIge1xuICBpZiAoYS5hY3RpdmUgIT09IGIuYWN0aXZlKSByZXR1cm4gYS5hY3RpdmUgPyAtMSA6IDE7XG4gIGlmIChhLmlzRGVmYXVsdCAhPT0gYi5pc0RlZmF1bHQpIHJldHVybiBhLmlzRGVmYXVsdCA/IC0xIDogMTtcbiAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59XG4iLCAiaW1wb3J0IHsgQ29sb3IsIERldGFpbCwgSWNvbiB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgTmV0d29ya0ludGVyZmFjZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgZGlzcGxheU5hbWUsIGlzU1NJRFBlcm1pc3Npb25NaXNzaW5nIH0gZnJvbSBcIi4uL3NlcnZpY2VzL2ludGVyZmFjZXNcIjtcblxuLyoqXG4gKiBTdGFuZGFyZCBzZXQgb2YgbWV0YWRhdGEgcm93cyBkZXNjcmliaW5nIHRoZSBuZXR3b3JrIGFuIGFjdGl2ZS9jb21wbGV0ZWRcbiAqIHRlc3Qgd2FzIHJ1biBvbi4gRHJvcCBpbnNpZGUgYSA8RGV0YWlsLk1ldGFkYXRhPi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIE5ldHdvcmtDb250ZXh0TWV0YWRhdGEoeyBpZmFjZSB9OiB7IGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlIH0pIHtcbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbFxuICAgICAgICB0aXRsZT1cIk5ldHdvcmtcIlxuICAgICAgICB0ZXh0PXtkaXNwbGF5TmFtZShpZmFjZSl9XG4gICAgICAgIGljb249e2ljb25Gb3IoaWZhY2UpfVxuICAgICAgLz5cbiAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJJbnRlcmZhY2VcIiB0ZXh0PXtpZmFjZS5uYW1lfSAvPlxuICAgICAge2lmYWNlLmlwdjQgJiYgKFxuICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsIHRpdGxlPVwiTG9jYWwgSVBcIiB0ZXh0PXtpZmFjZS5pcHY0fSAvPlxuICAgICAgKX1cbiAgICAgIHtpZmFjZS5pc0RlZmF1bHQgJiYgKFxuICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsIHRpdGxlPVwiRGVmYXVsdCByb3V0ZVwiIHRleHQ9XCJZZXNcIiAvPlxuICAgICAgKX1cbiAgICAgIHtpc1NTSURQZXJtaXNzaW9uTWlzc2luZyhpZmFjZSkgJiYgKFxuICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgdGl0bGU9XCJOZXR3b3JrIG5hbWVcIlxuICAgICAgICAgIHRleHQ9XCJHcmFudCBMb2NhdGlvbiBTZXJ2aWNlcyB0byByZWFkIFNTSURcIlxuICAgICAgICAgIGljb249e3sgc291cmNlOiBJY29uLkluZm8sIHRpbnRDb2xvcjogQ29sb3IuWWVsbG93IH19XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgIDwvPlxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaWNvbkZvcihpZmFjZTogTmV0d29ya0ludGVyZmFjZSk6IEljb24ge1xuICBpZiAoaWZhY2UuaXNIb3RzcG90KSByZXR1cm4gSWNvbi5Nb2JpbGU7XG4gIHN3aXRjaCAoaWZhY2UudHlwZSkge1xuICAgIGNhc2UgXCJ3aWZpXCI6XG4gICAgICByZXR1cm4gSWNvbi5XaWZpO1xuICAgIGNhc2UgXCJldGhlcm5ldFwiOlxuICAgICAgcmV0dXJuIEljb24uUGx1ZztcbiAgICBjYXNlIFwidGh1bmRlcmJvbHRcIjpcbiAgICAgIHJldHVybiBJY29uLkJvbHQ7XG4gICAgY2FzZSBcInVzYlwiOlxuICAgICAgcmV0dXJuIEljb24uTW9iaWxlO1xuICAgIGNhc2UgXCJibHVldG9vdGhcIjpcbiAgICAgIHJldHVybiBJY29uLkJsdWV0b290aDtcbiAgICBjYXNlIFwib3RoZXJcIjpcbiAgICAgIHJldHVybiBJY29uLk5ldHdvcms7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxjQWNPO0FBQ1AsSUFBQUMsZ0JBQWtDO0FBQ2xDLElBQUFDLG9CQUFpQjs7O0FDaEJqQixtQkFBeUQ7OztBQ0F6RCxpQkFBNEI7QUFDNUIscUJBQStCO0FBQy9CLHVCQUFpQjtBQUdqQixJQUFNLG1CQUFtQjtBQWVsQixTQUFTLHFCQUFtQztBQUNqRCxRQUFNLFdBQVcsaUJBQUFDLFFBQUssS0FBSyx1QkFBWSxhQUFhLGdCQUFnQjtBQUVwRSxTQUFPO0FBQUEsSUFDTCxNQUFNLE9BQU8sT0FBTztBQUNsQixZQUFNLGVBQUFDLFNBQUcsTUFBTSxpQkFBQUQsUUFBSyxRQUFRLFFBQVEsR0FBRyxFQUFFLFdBQVcsS0FBSyxDQUFD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QUFDSCxhQUFPLGtCQUFNO0FBQUEsSUFDZixLQUFLO0FBQ0gsYUFBTyxrQkFBTTtBQUFBLElBQ2YsS0FBSztBQUNILGFBQU8sa0JBQU07QUFBQSxJQUNmLEtBQUs7QUFDSCxhQUFPLGtCQUFNO0FBQUEsRUFDakI7QUFDRjtBQUVBLFNBQVMsV0FBVyxPQUE2QjtBQUMvQyxTQUFPLEdBQUcsTUFBTSxVQUFVLElBQUksS0FBSyxNQUFNLFVBQVUsUUFBUSxFQUFFO0FBQy9EO0FBRUEsU0FBUyxrQkFBa0IsU0FBeUI7QUFDbEQsUUFBTSxNQUFNLG9CQUFJLElBQW9CO0FBQ3BDLGFBQVcsS0FBSyxTQUFTO0FBQ3ZCLFFBQUksSUFBSSxXQUFXLENBQUMsR0FBRyxZQUFZLEVBQUUsU0FBUyxDQUFDO0FBQUEsRUFDakQ7QUFDQSxTQUFPLENBQUMsR0FBRyxJQUFJLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxPQUFPLEVBQUUsS0FBSyxNQUFNLEVBQUU7QUFDbEU7QUFFQSxlQUFlLGdCQUFnQixPQUE0QjtBQUN6RCxRQUFNLEtBQUssVUFBTSwwQkFBYTtBQUFBLElBQzVCLE9BQU87QUFBQSxJQUNQLFNBQVM7QUFBQSxJQUNULGVBQWUsRUFBRSxPQUFPLFNBQVMsT0FBTyxrQkFBTSxZQUFZLFlBQVk7QUFBQSxFQUN4RSxDQUFDO0FBQ0QsTUFBSSxDQUFDLEdBQUk7QUFDVCxRQUFNLE1BQU07QUFDWixZQUFNLHVCQUFVLEVBQUUsT0FBTyxrQkFBTSxNQUFNLFNBQVMsT0FBTyxrQkFBa0IsQ0FBQztBQUMxRTsiLAogICJuYW1lcyI6IFsiaW1wb3J0X2FwaSIsICJpbXBvcnRfcmVhY3QiLCAiaW1wb3J0X25vZGVfcGF0aCIsICJwYXRoIiwgImZzIiwgImltcG9ydF9hcGkiLCAiaW1wb3J0X2FwaSIsICJpbXBvcnRfanN4X3J1bnRpbWUiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgInBhdGgiLCAic3BlZWRUaWVyQ29sb3IiXQp9Cg==
