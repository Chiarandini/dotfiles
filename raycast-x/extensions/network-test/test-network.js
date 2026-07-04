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

// src/test-network.tsx
var test_network_exports = {};
__export(test_network_exports, {
  default: () => Command
});
module.exports = __toCommonJS(test_network_exports);
var import_api9 = require("@raycast/api");

// src/hooks/useNetworkTest.ts
var import_node_crypto = require("node:crypto");
var import_react = require("react");

// src/services/networkQuality.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
var NETWORKQUALITY_BIN = "/usr/bin/networkquality";
var TEST_TIMEOUT_MS = 18e4;
var NetworkTestError = class extends Error {
  constructor(message, cause, diagnostics) {
    super(message);
    this.cause = cause;
    this.diagnostics = diagnostics;
    this.name = "NetworkTestError";
  }
  cause;
  diagnostics;
};
var TRANSIENT_ERROR_MARKERS = [
  "no usable measurements",
  "could not parse"
];
function isTransientError(err) {
  if (!(err instanceof NetworkTestError)) return false;
  const msg = err.message.toLowerCase();
  return TRANSIENT_ERROR_MARKERS.some((m) => msg.includes(m));
}
async function runNetworkTest(mode, options = {}) {
  const args = buildArgs(mode, options.interfaceName);
  let stdout;
  let stderr;
  try {
    const result = await execFileAsync(NETWORKQUALITY_BIN, args, {
      timeout: TEST_TIMEOUT_MS,
      signal: options.signal,
      maxBuffer: 4 * 1024 * 1024
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err) {
    const e = err;
    throw new NetworkTestError(
      "networkquality failed to run. Requires macOS 12+.",
      err,
      { stdout: e.stdout, stderr: e.stderr, args }
    );
  }
  return parseNetworkQualityOutput(stdout, mode, { stderr, args });
}
function buildArgs(mode, interfaceName) {
  const args = ["-c"];
  switch (mode) {
    case "parallel":
      break;
    case "sequential":
      args.push("-s");
      break;
    case "download":
      args.push("-u");
      break;
    case "upload":
      args.push("-d");
      break;
  }
  if (interfaceName) args.push("-I", interfaceName);
  return args;
}
function parseNetworkQualityOutput(stdout, mode, diagnostics) {
  let raw;
  try {
    raw = JSON.parse(stdout);
  } catch (err) {
    throw new NetworkTestError("Could not parse networkquality output", err, {
      stdout,
      ...diagnostics
    });
  }
  const downloadBps = toNumberOrNull(raw.dl_throughput);
  const uploadBps = toNumberOrNull(raw.ul_throughput);
  const responsivenessRpm = toNumberOrNull(raw.responsiveness) ?? toNumberOrNull(raw.dl_responsiveness) ?? toNumberOrNull(raw.ul_responsiveness);
  const baseRttMs = toNumberOrNull(raw.base_rtt);
  if (downloadBps === null && uploadBps === null && baseRttMs === null) {
    throw new NetworkTestError(
      "networkquality returned no usable measurements",
      void 0,
      { stdout, ...diagnostics }
    );
  }
  return {
    mode,
    downloadBps,
    uploadBps,
    responsivenessRpm,
    responsivenessTier: responsivenessRpm === null ? null : classifyResponsiveness(responsivenessRpm),
    baseRttMs,
    interfaceName: raw.interface_name ?? "unknown",
    testEndpoint: raw.test_endpoint ?? "unknown",
    finishedAt: parseEndDate(raw.end_date)
  };
}
function toNumberOrNull(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}
function classifyResponsiveness(rpm) {
  if (rpm >= 1e3) return "high";
  if (rpm >= 100) return "medium";
  return "low";
}
function parseEndDate(value) {
  if (!value) return Date.now();
  const isoish = value.replace(" ", "T") + "Z";
  const ts = Date.parse(isoish);
  return Number.isNaN(ts) ? Date.now() : ts;
}

// src/services/interfaces.ts
var import_node_child_process2 = require("node:child_process");
var import_node_util2 = require("node:util");
var execFileAsync2 = (0, import_node_util2.promisify)(import_node_child_process2.execFile);
var CMD_TIMEOUT_MS = 4e3;
async function listInterfaces() {
  const [ports, defaultIface] = await Promise.all([
    listHardwarePorts(),
    getDefaultInterface()
  ]);
  const decorated = await Promise.all(
    ports.map(async (p) => {
      const [active, ipv4] = await readIfconfig(p.device);
      const type = classifyType(p.hardwarePort);
      const ssid = type === "wifi" ? await readSSID(p.device) : null;
      return {
        name: p.device,
        type,
        hardwarePort: p.hardwarePort,
        ssid,
        ipv4,
        active,
        isDefault: p.device === defaultIface,
        isHotspot: type === "wifi" && isHotspotIp(ipv4)
      };
    })
  );
  return decorated.sort(compareInterfaces);
}
async function getDefaultInterfaceDetails() {
  const all = await listInterfaces();
  return all.find((i) => i.isDefault) ?? all.find((i) => i.active) ?? null;
}
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
var HOTSPOT_PREFIXES = ["172.20.10.", "192.168.43.", "192.168.49."];
function isHotspotIp(ipv4) {
  if (!ipv4) return false;
  return HOTSPOT_PREFIXES.some((p) => ipv4.startsWith(p));
}
async function listHardwarePorts() {
  const { stdout } = await execFileAsync2(
    "/usr/sbin/networksetup",
    ["-listallhardwareports"],
    { timeout: CMD_TIMEOUT_MS }
  );
  const ports = [];
  let currentPort = null;
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    const portMatch = line.match(/^Hardware Port:\s*(.+)$/);
    if (portMatch) {
      currentPort = portMatch[1];
      continue;
    }
    const deviceMatch = line.match(/^Device:\s*(\S+)$/);
    if (deviceMatch && currentPort) {
      ports.push({ hardwarePort: currentPort, device: deviceMatch[1] });
      currentPort = null;
    }
  }
  return ports;
}
async function getDefaultInterface() {
  try {
    const { stdout } = await execFileAsync2(
      "/sbin/route",
      ["-n", "get", "default"],
      { timeout: CMD_TIMEOUT_MS }
    );
    const match = stdout.match(/^\s*interface:\s*(\S+)/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
async function readIfconfig(device) {
  try {
    const { stdout } = await execFileAsync2("/sbin/ifconfig", [device], {
      timeout: CMD_TIMEOUT_MS
    });
    const ipv4Match = stdout.match(/^\s*inet\s+(\d+\.\d+\.\d+\.\d+)\b/m);
    const statusActive = /\bstatus:\s*active\b/.test(stdout);
    const active = statusActive && ipv4Match !== null;
    return [active, ipv4Match?.[1] ?? null];
  } catch {
    return [false, null];
  }
}
var UNREADABLE_SSID_MARKERS = /* @__PURE__ */ new Set(["<redacted>", "(null)", ""]);
async function readSSID(device) {
  try {
    const { stdout } = await execFileAsync2(
      "/usr/sbin/ipconfig",
      ["getsummary", device],
      { timeout: CMD_TIMEOUT_MS }
    );
    const match = stdout.match(/^\s*SSID\s*:\s*(.+?)\s*$/m);
    const ssid = match?.[1]?.trim() ?? "";
    if (UNREADABLE_SSID_MARKERS.has(ssid)) return null;
    return ssid;
  } catch {
    return null;
  }
}
function isSSIDPermissionMissing(iface) {
  return iface.active && iface.type === "wifi" && iface.ssid === null;
}
function classifyType(hardwarePort) {
  const p = hardwarePort.toLowerCase();
  if (p.includes("wi-fi") || p.includes("airport")) return "wifi";
  if (p.includes("thunderbolt") || p.includes("bridge")) return "thunderbolt";
  if (p.includes("iphone") || p.includes("ipad")) return "usb";
  if (p.includes("usb")) return "usb";
  if (p.includes("bluetooth")) return "bluetooth";
  if (p.includes("ethernet") || p.includes("lan")) return "ethernet";
  return "other";
}
function compareInterfaces(a, b) {
  if (a.active !== b.active) return a.active ? -1 : 1;
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  return a.name.localeCompare(b.name);
}

// src/storage/resultCache.ts
var import_api = require("@raycast/api");
var CACHE_KEY = "lastResult";
function createResultCache() {
  const cache = new import_api.Cache({ namespace: "network-test" });
  return {
    read() {
      const raw = cache.get(CACHE_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        cache.remove(CACHE_KEY);
        return null;
      }
    },
    write(payload) {
      cache.set(CACHE_KEY, JSON.stringify(payload));
    },
    clear() {
      cache.remove(CACHE_KEY);
    }
  };
}

// src/storage/historyStore.ts
var import_api2 = require("@raycast/api");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));
var HISTORY_FILENAME = "history.jsonl";
function createHistoryStore() {
  const filePath = import_node_path.default.join(import_api2.environment.supportPath, HISTORY_FILENAME);
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

// src/storage/durationStats.ts
var import_api3 = require("@raycast/api");
var KEY_PREFIX = "duration:";
var SAMPLE_LIMIT = 10;
var FALLBACK_ESTIMATE_MS = {
  parallel: 3e4,
  sequential: 55e3,
  download: 18e3,
  upload: 18e3
};
function createDurationStats() {
  return {
    async estimate(mode, interfaceName) {
      const samples = await loadSamples(mode, interfaceName);
      if (samples.length === 0) return FALLBACK_ESTIMATE_MS[mode];
      return median(samples);
    },
    async record(mode, interfaceName, durationMs) {
      const samples = await loadSamples(mode, interfaceName);
      samples.push(durationMs);
      const trimmed = samples.slice(-SAMPLE_LIMIT);
      await import_api3.LocalStorage.setItem(
        keyFor(mode, interfaceName),
        JSON.stringify(trimmed)
      );
    }
  };
}
function keyFor(mode, interfaceName) {
  return `${KEY_PREFIX}${mode}:${interfaceName}`;
}
async function loadSamples(mode, interfaceName) {
  const raw = await import_api3.LocalStorage.getItem(keyFor(mode, interfaceName));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// src/hooks/useNetworkTest.ts
var PROGRESS_TICK_MS = 200;
var TRANSIENT_RETRY_DELAY_MS = 1500;
function useNetworkTest(options = {}) {
  const { autoStart = true, defaultMode = "parallel" } = options;
  const storeRef = (0, import_react.useRef)(options.store ?? createResultCache());
  const historyRef = (0, import_react.useRef)(
    options.history ?? createHistoryStore()
  );
  const statsRef = (0, import_react.useRef)(
    options.durationStats ?? createDurationStats()
  );
  const abortRef = (0, import_react.useRef)(null);
  const timerRef = (0, import_react.useRef)(null);
  const [state, setState] = (0, import_react.useState)(() => {
    const cached = storeRef.current.read();
    return {
      status: "idle",
      current: cached?.result ?? null,
      currentInterface: cached?.interface ?? null,
      currentIsStale: cached !== null,
      error: null,
      progress: null,
      runningMode: null,
      runningInterface: null
    };
  });
  const stopTimer = (0, import_react.useCallback)(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const startTimer = (0, import_react.useCallback)(
    (estimatedMs) => {
      stopTimer();
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setState(
          (prev) => prev.status === "running" ? { ...prev, progress: computeProgress(elapsed, estimatedMs) } : prev
        );
      }, PROGRESS_TICK_MS);
    },
    [stopTimer]
  );
  const cancel = (0, import_react.useCallback)(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();
    setState((prev) => ({
      ...prev,
      status: "cancelled",
      progress: null,
      runningMode: null,
      runningInterface: null
    }));
  }, [stopTimer]);
  const runTest = (0, import_react.useCallback)(
    async (mode = defaultMode, iface) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const resolvedIface = iface ?? await getDefaultInterfaceDetails();
      if (controller.signal.aborted) return;
      const ifaceName = resolvedIface?.name ?? "unknown";
      const estimatedMs = await statsRef.current.estimate(mode, ifaceName);
      if (controller.signal.aborted) return;
      const startedAt = Date.now();
      const entryId = (0, import_node_crypto.randomUUID)();
      setState((prev) => ({
        ...prev,
        status: "running",
        error: null,
        progress: computeProgress(0, estimatedMs),
        runningMode: mode,
        runningInterface: resolvedIface
      }));
      startTimer(estimatedMs);
      let attempt = 0;
      let lastError = null;
      while (attempt < 2) {
        try {
          const result = await runNetworkTest(mode, {
            interfaceName: iface ? iface.name : void 0,
            signal: controller.signal
          });
          if (controller.signal.aborted) return;
          stopTimer();
          const finishedAt = Date.now();
          const durationMs = finishedAt - startedAt;
          if (resolvedIface) {
            storeRef.current.write({ result, interface: resolvedIface });
            await statsRef.current.record(mode, ifaceName, durationMs);
          }
          await persistHistory(historyRef.current, {
            id: entryId,
            startedAt,
            finishedAt,
            durationMs,
            mode,
            interface: resolvedIface ?? unknownInterface(ifaceName),
            result,
            error: null,
            compareRunId: null
          });
          setState({
            status: "idle",
            current: result,
            currentInterface: resolvedIface,
            currentIsStale: false,
            error: null,
            progress: null,
            runningMode: null,
            runningInterface: null
          });
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          lastError = err;
          attempt += 1;
          if (attempt < 2 && isTransientError(err)) {
            await sleep(TRANSIENT_RETRY_DELAY_MS, controller.signal);
            if (controller.signal.aborted) return;
            continue;
          }
          break;
        }
      }
      stopTimer();
      const errDetails = describeError(lastError, attempt > 1);
      await persistHistory(historyRef.current, {
        id: entryId,
        startedAt,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        mode,
        interface: resolvedIface ?? unknownInterface(ifaceName),
        result: null,
        error: errDetails.message,
        compareRunId: null
      });
      setState((prev) => ({
        ...prev,
        status: "error",
        error: errDetails,
        progress: null,
        runningMode: null,
        runningInterface: null
      }));
    },
    [defaultMode, startTimer, stopTimer]
  );
  (0, import_react.useEffect)(() => {
    if (autoStart) void runTest();
    return () => {
      abortRef.current?.abort();
      stopTimer();
    };
  }, []);
  return { state, runTest, cancel };
}
function computeProgress(elapsedMs, estimatedTotalMs) {
  const rawFraction = elapsedMs / Math.max(1, estimatedTotalMs);
  const overrun = rawFraction >= 1;
  const fraction = overrun ? 0.97 : Math.min(0.97, rawFraction);
  return {
    phase: phaseFor(rawFraction, overrun),
    elapsedMs,
    estimatedTotalMs,
    fraction,
    overrun
  };
}
function phaseFor(rawFraction, overrun) {
  if (overrun) return "overrun";
  if (rawFraction < 0.12) return "warmup";
  if (rawFraction < 0.9) return "measuring";
  return "finalizing";
}
async function persistHistory(store, entry) {
  try {
    await store.append(entry);
  } catch {
  }
}
function unknownInterface(name) {
  return {
    name,
    type: "other",
    hardwarePort: "Unknown",
    ssid: null,
    ipv4: null,
    active: false,
    isDefault: false,
    isHotspot: false
  };
}
function describeError(err, wasRetried) {
  if (err instanceof NetworkTestError) {
    return {
      message: err.message,
      rawOutput: err.diagnostics?.stdout,
      rawStderr: err.diagnostics?.stderr,
      args: err.diagnostics?.args,
      wasRetried
    };
  }
  if (err instanceof Error) {
    return { message: err.message, wasRetried };
  }
  return { message: "Unknown error", wasRetried };
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// src/views/ResultDetail.tsx
var import_api6 = require("@raycast/api");

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
function renderProgressBar(fraction, width = 24) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(clamped * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
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

// src/views/NetworkBadge.tsx
var import_api4 = require("@raycast/api");
var import_jsx_runtime = require("react/jsx-runtime");
function NetworkContextMetadata({ iface }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api4.Detail.Metadata.Label,
      {
        title: "Network",
        text: displayName(iface),
        icon: iconFor(iface)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api4.Detail.Metadata.Label, { title: "Interface", text: iface.name }),
    iface.ipv4 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api4.Detail.Metadata.Label, { title: "Local IP", text: iface.ipv4 }),
    iface.isDefault && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api4.Detail.Metadata.Label, { title: "Default route", text: "Yes" }),
    isSSIDPermissionMissing(iface) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api4.Detail.Metadata.Label,
      {
        title: "Network name",
        text: "Grant Location Services to read SSID",
        icon: { source: import_api4.Icon.Info, tintColor: import_api4.Color.Yellow }
      }
    )
  ] });
}
function iconFor(iface) {
  if (iface.isHotspot) return import_api4.Icon.Mobile;
  switch (iface.type) {
    case "wifi":
      return import_api4.Icon.Wifi;
    case "ethernet":
      return import_api4.Icon.Plug;
    case "thunderbolt":
      return import_api4.Icon.Bolt;
    case "usb":
      return import_api4.Icon.Mobile;
    case "bluetooth":
      return import_api4.Icon.Bluetooth;
    case "other":
      return import_api4.Icon.Network;
  }
}

// src/views/RunTestActions.tsx
var import_api5 = require("@raycast/api");
var import_jsx_runtime2 = require("react/jsx-runtime");
var MODES = ["parallel", "sequential", "download", "upload"];
function RunTestActions({
  status,
  defaultMode,
  interfaces,
  currentInterface,
  onRun,
  onCancel
}) {
  if (status === "running") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_api5.Action,
      {
        title: "Cancel Test",
        icon: import_api5.Icon.Stop,
        onAction: () => onCancel?.()
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_api5.Action,
      {
        title: "Run Test",
        icon: import_api5.Icon.Play,
        onAction: () => onRun(defaultMode, currentInterface ?? void 0)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_api5.ActionPanel.Submenu,
      {
        title: "Run with Mode",
        icon: import_api5.Icon.Switch,
        shortcut: { modifiers: ["cmd"], key: "m" },
        children: MODES.map((m) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api5.Action,
          {
            title: modeLabel(m),
            icon: iconForMode(m),
            onAction: () => onRun(m, currentInterface ?? void 0)
          },
          m
        ))
      }
    ),
    interfaces && interfaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_api5.ActionPanel.Submenu,
      {
        title: "Run on Interface",
        icon: import_api5.Icon.Network,
        shortcut: { modifiers: ["cmd"], key: "i" },
        children: interfaces.map((iface) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api5.Action,
          {
            title: `${iface.name} \u2014 ${iface.ssid ?? iface.hardwarePort}`,
            icon: import_api5.Icon.Network,
            onAction: () => onRun(defaultMode, iface)
          },
          iface.name
        ))
      }
    )
  ] });
}
function iconForMode(mode) {
  switch (mode) {
    case "parallel":
      return import_api5.Icon.ArrowClockwise;
    case "sequential":
      return import_api5.Icon.List;
    case "download":
      return import_api5.Icon.ArrowDown;
    case "upload":
      return import_api5.Icon.ArrowUp;
  }
}

// src/views/ResultDetail.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function ResultDetail({
  result,
  iface,
  isStale,
  status,
  progress,
  runningMode,
  defaultMode,
  onRerun,
  onCancel
}) {
  const isRunning = status === "running";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_api6.Detail,
    {
      isLoading: isRunning,
      markdown: renderMarkdown(
        result,
        iface,
        isStale,
        isRunning,
        progress,
        runningMode
      ),
      metadata: renderMetadata(result, iface, isRunning, progress),
      actions: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api6.ActionPanel, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          RunTestActions,
          {
            status,
            defaultMode,
            currentInterface: iface,
            onRun: onRerun,
            onCancel
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api6.Action.CopyToClipboard,
          {
            title: "Copy Summary",
            content: renderClipboardSummary(result, iface),
            shortcut: { modifiers: ["cmd"], key: "c" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api6.Action,
          {
            title: "Open History",
            icon: import_api6.Icon.List,
            shortcut: { modifiers: ["cmd"], key: "h" },
            onAction: () => (0, import_api6.launchCommand)({
              name: "network-history",
              type: import_api6.LaunchType.UserInitiated
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_api6.Action,
          {
            title: "Compare Networks",
            icon: import_api6.Icon.TwoPeople,
            shortcut: { modifiers: ["cmd", "shift"], key: "c" },
            onAction: () => (0, import_api6.launchCommand)({
              name: "compare-networks",
              type: import_api6.LaunchType.UserInitiated
            })
          }
        )
      ] })
    }
  );
}
function renderMarkdown(result, iface, isStale, isRunning, progress, runningMode) {
  const lines = [];
  if (isRunning && progress) {
    lines.push(...renderRefreshHeader(progress, runningMode));
    lines.push("---");
    lines.push("");
    lines.push(
      `### Previous result \xB7 ${isStale ? formatRelativeTime(result.finishedAt) : "just now"}`
    );
    lines.push("");
  } else if (iface) {
    lines.push(`**${displayName(iface)}**`);
    lines.push("");
  }
  if (isRunning && iface) {
    lines.push(`*${displayName(iface)}*`);
    lines.push("");
  }
  lines.push(`> ${generateSummary(result)}`);
  lines.push("");
  if (iface && isSSIDPermissionMissing(iface)) {
    lines.push(
      "*Network name hidden \u2014 grant Raycast access in System Settings \u2192 Privacy & Security \u2192 Location Services to see the SSID.*"
    );
    lines.push("");
  }
  if (result.downloadBps !== null) {
    lines.push(
      ...renderDirection("\u2193 Download", result.downloadBps, "download")
    );
    lines.push("");
  }
  if (result.uploadBps !== null) {
    lines.push(...renderDirection("\u2191 Upload", result.uploadBps, "upload"));
    lines.push("");
  }
  lines.push(
    `**Latency**  ${formatLatency(result.baseRttMs)}` + (result.responsivenessRpm !== null ? `  \xB7  **Responsiveness**  ${formatResponsiveness(result.responsivenessRpm, result.responsivenessTier)}` : "")
  );
  return lines.join("\n");
}
function renderRefreshHeader(progress, runningMode) {
  const bar = renderProgressBar(progress.fraction);
  const pct = Math.round(progress.fraction * 100);
  const elapsedFragment = progress.overrun ? `${formatElapsed(progress.elapsedMs)} \xB7 taking longer than usual` : `${formatElapsed(progress.elapsedMs)} / ~${Math.round(progress.estimatedTotalMs / 1e3)}s`;
  const modeFragment = runningMode ? ` \xB7 ${modeLabel(runningMode)}` : "";
  return [
    `## Running new test${modeFragment}`,
    "",
    "```",
    `${bar}  ${pct}%   ${elapsedFragment}`,
    "```",
    ""
  ];
}
function renderDirection(heading, bps, direction) {
  const tier = classifySpeed(bps);
  const context = direction === "download" ? downloadContext(tier) : uploadContext(tier);
  return [
    `### ${heading}  ${formatThroughput(bps)}  \xB7  ${speedTierLabel(tier)} \u2014 ${context}`,
    "```",
    renderLogMeter(bps),
    "```"
  ];
}
function renderMetadata(result, iface, isRunning, progress) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api6.Detail.Metadata, { children: [
    isRunning && progress && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_api6.Detail.Metadata.Label,
        {
          title: "Status",
          text: progress.overrun ? `Overrun \xB7 ${formatElapsed(progress.elapsedMs)}` : `${Math.round(progress.fraction * 100)}% \xB7 ${formatElapsed(progress.elapsedMs)}`,
          icon: { source: import_api6.Icon.CircleProgress, tintColor: import_api6.Color.Blue }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.Separator, {})
    ] }),
    result.downloadBps !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.TagList, { title: "Download", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api6.Detail.Metadata.TagList.Item,
      {
        text: `${formatThroughput(result.downloadBps)} \xB7 ${speedTierLabel(classifySpeed(result.downloadBps))}`,
        color: speedTierColor(classifySpeed(result.downloadBps)),
        icon: import_api6.Icon.ArrowDown
      }
    ) }),
    result.uploadBps !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.TagList, { title: "Upload", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api6.Detail.Metadata.TagList.Item,
      {
        text: `${formatThroughput(result.uploadBps)} \xB7 ${speedTierLabel(classifySpeed(result.uploadBps))}`,
        color: speedTierColor(classifySpeed(result.uploadBps)),
        icon: import_api6.Icon.ArrowUp
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api6.Detail.Metadata.Label,
      {
        title: "Latency",
        text: formatLatency(result.baseRttMs),
        icon: import_api6.Icon.Gauge
      }
    ),
    result.responsivenessRpm !== null && result.responsivenessTier !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.TagList, { title: "Responsiveness", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api6.Detail.Metadata.TagList.Item,
      {
        text: formatResponsiveness(
          result.responsivenessRpm,
          result.responsivenessTier
        ),
        color: tierColor(result.responsivenessTier)
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.Separator, {}),
    iface && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(NetworkContextMetadata, { iface }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.Label, { title: "Mode", text: modeLabel(result.mode) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_api6.Detail.Metadata.Label, { title: "Endpoint", text: result.testEndpoint }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api6.Detail.Metadata.Label,
      {
        title: "Measured",
        text: formatRelativeTime(result.finishedAt)
      }
    )
  ] });
}
function tierColor(tier) {
  switch (tier) {
    case "high":
      return import_api6.Color.Green;
    case "medium":
      return import_api6.Color.Yellow;
    case "low":
      return import_api6.Color.Red;
  }
}
function speedTierColor(tier) {
  switch (tier) {
    case "poor":
      return import_api6.Color.Red;
    case "ok":
      return import_api6.Color.Orange;
    case "good":
      return import_api6.Color.Yellow;
    case "great":
      return import_api6.Color.Green;
    case "excellent":
      return import_api6.Color.Blue;
  }
}
function renderClipboardSummary(result, iface) {
  const parts = [];
  if (iface) parts.push(`Network: ${displayName(iface)} (${iface.name})`);
  if (result.downloadBps !== null)
    parts.push(`Download: ${formatThroughput(result.downloadBps)}`);
  if (result.uploadBps !== null)
    parts.push(`Upload: ${formatThroughput(result.uploadBps)}`);
  if (result.baseRttMs !== null)
    parts.push(`Latency: ${formatLatency(result.baseRttMs)}`);
  if (result.responsivenessRpm !== null && result.responsivenessTier !== null)
    parts.push(
      `Responsiveness: ${formatResponsiveness(result.responsivenessRpm, result.responsivenessTier)}`
    );
  return parts.join("\n");
}

// src/views/ErrorDetail.tsx
var import_api7 = require("@raycast/api");
var import_jsx_runtime4 = require("react/jsx-runtime");
function ErrorDetail({ error, defaultMode, onRetry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    import_api7.Detail,
    {
      markdown: renderMarkdown2(error),
      actions: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_api7.ActionPanel, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          RunTestActions,
          {
            status: "idle",
            defaultMode,
            onRun: onRetry
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          import_api7.Action.CopyToClipboard,
          {
            title: "Copy Debug Info",
            icon: import_api7.Icon.Clipboard,
            content: renderDebugInfo(error),
            shortcut: { modifiers: ["cmd"], key: "d" }
          }
        )
      ] })
    }
  );
}
function renderMarkdown2(error) {
  const lines = [];
  lines.push("# Network test failed");
  lines.push("");
  lines.push("```");
  lines.push(error.message);
  lines.push("```");
  lines.push("");
  if (error.wasRetried) {
    lines.push("*Retried once automatically before showing this error.*");
    lines.push("");
  }
  lines.push(
    "This is usually transient \u2014 the Apple test endpoint can refuse mid-run on flaky networks. Try again."
  );
  lines.push("");
  if (error.args && error.args.length > 0) {
    lines.push("### Command");
    lines.push("```");
    lines.push(`/usr/bin/networkquality ${error.args.join(" ")}`);
    lines.push("```");
    lines.push("");
  }
  if (error.rawOutput) {
    lines.push("### Raw stdout");
    lines.push("```json");
    lines.push(truncate(error.rawOutput, 1200));
    lines.push("```");
    lines.push("");
  }
  if (error.rawStderr && error.rawStderr.trim().length > 0) {
    lines.push("### stderr");
    lines.push("```");
    lines.push(truncate(error.rawStderr, 800));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
function renderDebugInfo(error) {
  return JSON.stringify(
    {
      message: error.message,
      wasRetried: error.wasRetried,
      args: error.args,
      stdout: error.rawOutput,
      stderr: error.rawStderr
    },
    null,
    2
  );
}
function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max) + `
... [truncated, ${s.length - max} more chars]`;
}

// src/views/RunningView.tsx
var import_api8 = require("@raycast/api");
var import_jsx_runtime5 = require("react/jsx-runtime");
function RunningView({
  progress,
  mode,
  iface,
  defaultMode,
  onRun,
  onCancel
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    import_api8.Detail,
    {
      isLoading: true,
      markdown: renderMarkdown3(progress, mode, iface),
      metadata: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_api8.Detail.Metadata, { children: [
        iface && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NetworkContextMetadata, { iface }),
        iface && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_api8.Detail.Metadata.Separator, {}),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_api8.Detail.Metadata.Label,
          {
            title: "Mode",
            text: modeLabel(mode),
            icon: import_api8.Icon.Switch
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_api8.Detail.Metadata.Label,
          {
            title: "Phase",
            text: phaseLabel(progress.phase),
            icon: phaseIcon(progress.phase)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_api8.Detail.Metadata.Label,
          {
            title: "Elapsed",
            text: formatElapsed(progress.elapsedMs)
          }
        ),
        !progress.overrun && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          import_api8.Detail.Metadata.Label,
          {
            title: "Estimated total",
            text: `~${Math.round(progress.estimatedTotalMs / 1e3)}s`
          }
        )
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_api8.ActionPanel, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        RunTestActions,
        {
          status: "running",
          defaultMode,
          onRun,
          onCancel
        }
      ) })
    }
  );
}
function renderMarkdown3(progress, mode, iface) {
  const bar = renderProgressBar(progress.fraction);
  const pct = Math.round(progress.fraction * 100);
  const heading = headingFor(progress.phase, mode);
  const detail = detailFor(progress.phase, mode);
  const elapsedLine = progress.overrun ? `**Elapsed**  ${formatElapsed(progress.elapsedMs)}  \xB7  taking longer than usual` : `**Elapsed**  ${formatElapsed(progress.elapsedMs)} / ~${Math.round(progress.estimatedTotalMs / 1e3)}s`;
  const ifaceLine = iface ? `Testing **${displayName(iface)}** (${iface.name})` : "";
  return [
    `# ${heading}`,
    "",
    ifaceLine,
    "",
    "```",
    `${bar}  ${pct}%`,
    "```",
    "",
    detail,
    "",
    elapsedLine
  ].filter((s, i) => s !== "" || i === 0).join("\n");
}
function headingFor(phase, mode) {
  if (phase === "warmup") return "Connecting to test server...";
  if (phase === "finalizing") return "Finalizing results...";
  if (phase === "overrun") return "Still measuring...";
  switch (mode) {
    case "parallel":
      return "Measuring download & upload";
    case "sequential":
      return "Measuring (one direction at a time)";
    case "download":
      return "Measuring download speed";
    case "upload":
      return "Measuring upload speed";
  }
}
function detailFor(phase, mode) {
  if (phase === "warmup")
    return "Negotiating with Apple's network quality endpoint.";
  if (phase === "finalizing") return "Computing throughput and responsiveness.";
  if (phase === "overrun")
    return "Slower than typical for this network, so the test needs more time. Results will still be accurate.";
  if (mode === "parallel")
    return "Saturating the link in both directions while sampling latency under load.";
  if (mode === "sequential")
    return "Measuring each direction separately for peak-speed accuracy.";
  return "Saturating one direction while sampling latency.";
}
function phaseLabel(phase) {
  if (phase === "overrun") return "Overrun (still running)";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
function phaseIcon(phase) {
  switch (phase) {
    case "warmup":
      return import_api8.Icon.Plug;
    case "measuring":
      return import_api8.Icon.BarChart;
    case "finalizing":
      return import_api8.Icon.CheckCircle;
    case "overrun":
      return import_api8.Icon.Hourglass;
  }
}

// src/test-network.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function Command() {
  const { defaultMode } = (0, import_api9.getPreferenceValues)();
  const { state, runTest, cancel } = useNetworkTest({ defaultMode });
  if (state.current) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ResultDetail,
      {
        result: state.current,
        iface: state.runningInterface ?? state.currentInterface,
        isStale: state.currentIsStale,
        status: state.status,
        progress: state.progress,
        runningMode: state.runningMode,
        defaultMode,
        onRerun: runTest,
        onCancel: cancel
      }
    );
  }
  if (state.status === "error" && state.error) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      ErrorDetail,
      {
        error: state.error,
        defaultMode,
        onRetry: runTest
      }
    );
  }
  if (state.progress && state.runningMode) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      RunningView,
      {
        progress: state.progress,
        mode: state.runningMode,
        iface: state.runningInterface,
        defaultMode,
        onRun: runTest,
        onCancel: cancel
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    RunningView,
    {
      progress: {
        phase: "warmup",
        elapsedMs: 0,
        estimatedTotalMs: 3e4,
        fraction: 0,
        overrun: false
      },
      mode: defaultMode,
      iface: null,
      defaultMode,
      onRun: runTest,
      onCancel: cancel
    }
  );
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy90ZXN0LW5ldHdvcmsudHN4IiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvaG9va3MvdXNlTmV0d29ya1Rlc3QudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9zZXJ2aWNlcy9uZXR3b3JrUXVhbGl0eS50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3NlcnZpY2VzL2ludGVyZmFjZXMudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9zdG9yYWdlL3Jlc3VsdENhY2hlLnRzIiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvc3RvcmFnZS9oaXN0b3J5U3RvcmUudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9zdG9yYWdlL2R1cmF0aW9uU3RhdHMudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy92aWV3cy9SZXN1bHREZXRhaWwudHN4IiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvbGliL2Zvcm1hdC50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL2xpYi9zcGVlZC50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL2xpYi9zdW1tYXJ5LnRzIiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvdmlld3MvTmV0d29ya0JhZGdlLnRzeCIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3ZpZXdzL1J1blRlc3RBY3Rpb25zLnRzeCIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3ZpZXdzL0Vycm9yRGV0YWlsLnRzeCIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3ZpZXdzL1J1bm5pbmdWaWV3LnRzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgZ2V0UHJlZmVyZW5jZVZhbHVlcyB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB7IHVzZU5ldHdvcmtUZXN0IH0gZnJvbSBcIi4vaG9va3MvdXNlTmV0d29ya1Rlc3RcIjtcbmltcG9ydCB7IFJlc3VsdERldGFpbCB9IGZyb20gXCIuL3ZpZXdzL1Jlc3VsdERldGFpbFwiO1xuaW1wb3J0IHsgRXJyb3JEZXRhaWwgfSBmcm9tIFwiLi92aWV3cy9FcnJvckRldGFpbFwiO1xuaW1wb3J0IHsgUnVubmluZ1ZpZXcgfSBmcm9tIFwiLi92aWV3cy9SdW5uaW5nVmlld1wiO1xuaW1wb3J0IHR5cGUgeyBUZXN0TW9kZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmludGVyZmFjZSBQcmVmZXJlbmNlcyB7XG4gIGRlZmF1bHRNb2RlOiBUZXN0TW9kZTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQ29tbWFuZCgpIHtcbiAgY29uc3QgeyBkZWZhdWx0TW9kZSB9ID0gZ2V0UHJlZmVyZW5jZVZhbHVlczxQcmVmZXJlbmNlcz4oKTtcbiAgY29uc3QgeyBzdGF0ZSwgcnVuVGVzdCwgY2FuY2VsIH0gPSB1c2VOZXR3b3JrVGVzdCh7IGRlZmF1bHRNb2RlIH0pO1xuXG4gIGlmIChzdGF0ZS5jdXJyZW50KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxSZXN1bHREZXRhaWxcbiAgICAgICAgcmVzdWx0PXtzdGF0ZS5jdXJyZW50fVxuICAgICAgICBpZmFjZT17c3RhdGUucnVubmluZ0ludGVyZmFjZSA/PyBzdGF0ZS5jdXJyZW50SW50ZXJmYWNlfVxuICAgICAgICBpc1N0YWxlPXtzdGF0ZS5jdXJyZW50SXNTdGFsZX1cbiAgICAgICAgc3RhdHVzPXtzdGF0ZS5zdGF0dXN9XG4gICAgICAgIHByb2dyZXNzPXtzdGF0ZS5wcm9ncmVzc31cbiAgICAgICAgcnVubmluZ01vZGU9e3N0YXRlLnJ1bm5pbmdNb2RlfVxuICAgICAgICBkZWZhdWx0TW9kZT17ZGVmYXVsdE1vZGV9XG4gICAgICAgIG9uUmVydW49e3J1blRlc3R9XG4gICAgICAgIG9uQ2FuY2VsPXtjYW5jZWx9XG4gICAgICAvPlxuICAgICk7XG4gIH1cblxuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcImVycm9yXCIgJiYgc3RhdGUuZXJyb3IpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEVycm9yRGV0YWlsXG4gICAgICAgIGVycm9yPXtzdGF0ZS5lcnJvcn1cbiAgICAgICAgZGVmYXVsdE1vZGU9e2RlZmF1bHRNb2RlfVxuICAgICAgICBvblJldHJ5PXtydW5UZXN0fVxuICAgICAgLz5cbiAgICApO1xuICB9XG5cbiAgaWYgKHN0YXRlLnByb2dyZXNzICYmIHN0YXRlLnJ1bm5pbmdNb2RlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxSdW5uaW5nVmlld1xuICAgICAgICBwcm9ncmVzcz17c3RhdGUucHJvZ3Jlc3N9XG4gICAgICAgIG1vZGU9e3N0YXRlLnJ1bm5pbmdNb2RlfVxuICAgICAgICBpZmFjZT17c3RhdGUucnVubmluZ0ludGVyZmFjZX1cbiAgICAgICAgZGVmYXVsdE1vZGU9e2RlZmF1bHRNb2RlfVxuICAgICAgICBvblJ1bj17cnVuVGVzdH1cbiAgICAgICAgb25DYW5jZWw9e2NhbmNlbH1cbiAgICAgIC8+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPFJ1bm5pbmdWaWV3XG4gICAgICBwcm9ncmVzcz17e1xuICAgICAgICBwaGFzZTogXCJ3YXJtdXBcIixcbiAgICAgICAgZWxhcHNlZE1zOiAwLFxuICAgICAgICBlc3RpbWF0ZWRUb3RhbE1zOiAzMF8wMDAsXG4gICAgICAgIGZyYWN0aW9uOiAwLFxuICAgICAgICBvdmVycnVuOiBmYWxzZSxcbiAgICAgIH19XG4gICAgICBtb2RlPXtkZWZhdWx0TW9kZX1cbiAgICAgIGlmYWNlPXtudWxsfVxuICAgICAgZGVmYXVsdE1vZGU9e2RlZmF1bHRNb2RlfVxuICAgICAgb25SdW49e3J1blRlc3R9XG4gICAgICBvbkNhbmNlbD17Y2FuY2VsfVxuICAgIC8+XG4gICk7XG59XG4iLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHtcbiAgaXNUcmFuc2llbnRFcnJvcixcbiAgTmV0d29ya1Rlc3RFcnJvcixcbiAgcnVuTmV0d29ya1Rlc3QsXG59IGZyb20gXCIuLi9zZXJ2aWNlcy9uZXR3b3JrUXVhbGl0eVwiO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEludGVyZmFjZURldGFpbHMgfSBmcm9tIFwiLi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuaW1wb3J0IHsgY3JlYXRlUmVzdWx0Q2FjaGUsIHR5cGUgUmVzdWx0U3RvcmUgfSBmcm9tIFwiLi4vc3RvcmFnZS9yZXN1bHRDYWNoZVwiO1xuaW1wb3J0IHsgY3JlYXRlSGlzdG9yeVN0b3JlLCB0eXBlIEhpc3RvcnlTdG9yZSB9IGZyb20gXCIuLi9zdG9yYWdlL2hpc3RvcnlTdG9yZVwiO1xuaW1wb3J0IHtcbiAgY3JlYXRlRHVyYXRpb25TdGF0cyxcbiAgRkFMTEJBQ0tfRVNUSU1BVEVfTVMsXG4gIHR5cGUgRHVyYXRpb25TdGF0cyxcbn0gZnJvbSBcIi4uL3N0b3JhZ2UvZHVyYXRpb25TdGF0c1wiO1xuaW1wb3J0IHR5cGUge1xuICBIaXN0b3J5RW50cnksXG4gIE5ldHdvcmtJbnRlcmZhY2UsXG4gIFRlc3RFcnJvckRldGFpbHMsXG4gIFRlc3RNb2RlLFxuICBUZXN0UGhhc2UsXG4gIFRlc3RQcm9ncmVzcyxcbiAgVGVzdFN0YXRlLFxufSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuaW50ZXJmYWNlIFVzZU5ldHdvcmtUZXN0T3B0aW9ucyB7XG4gIGF1dG9TdGFydD86IGJvb2xlYW47XG4gIGRlZmF1bHRNb2RlPzogVGVzdE1vZGU7XG4gIHN0b3JlPzogUmVzdWx0U3RvcmU7XG4gIGhpc3Rvcnk/OiBIaXN0b3J5U3RvcmU7XG4gIGR1cmF0aW9uU3RhdHM/OiBEdXJhdGlvblN0YXRzO1xufVxuXG5jb25zdCBQUk9HUkVTU19USUNLX01TID0gMjAwO1xuY29uc3QgVFJBTlNJRU5UX1JFVFJZX0RFTEFZX01TID0gMV81MDA7XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VOZXR3b3JrVGVzdChvcHRpb25zOiBVc2VOZXR3b3JrVGVzdE9wdGlvbnMgPSB7fSkge1xuICBjb25zdCB7IGF1dG9TdGFydCA9IHRydWUsIGRlZmF1bHRNb2RlID0gXCJwYXJhbGxlbFwiIH0gPSBvcHRpb25zO1xuICBjb25zdCBzdG9yZVJlZiA9IHVzZVJlZjxSZXN1bHRTdG9yZT4ob3B0aW9ucy5zdG9yZSA/PyBjcmVhdGVSZXN1bHRDYWNoZSgpKTtcbiAgY29uc3QgaGlzdG9yeVJlZiA9IHVzZVJlZjxIaXN0b3J5U3RvcmU+KFxuICAgIG9wdGlvbnMuaGlzdG9yeSA/PyBjcmVhdGVIaXN0b3J5U3RvcmUoKSxcbiAgKTtcbiAgY29uc3Qgc3RhdHNSZWYgPSB1c2VSZWY8RHVyYXRpb25TdGF0cz4oXG4gICAgb3B0aW9ucy5kdXJhdGlvblN0YXRzID8/IGNyZWF0ZUR1cmF0aW9uU3RhdHMoKSxcbiAgKTtcbiAgY29uc3QgYWJvcnRSZWYgPSB1c2VSZWY8QWJvcnRDb250cm9sbGVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHRpbWVyUmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IFtzdGF0ZSwgc2V0U3RhdGVdID0gdXNlU3RhdGU8VGVzdFN0YXRlPigoKSA9PiB7XG4gICAgY29uc3QgY2FjaGVkID0gc3RvcmVSZWYuY3VycmVudC5yZWFkKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogXCJpZGxlXCIsXG4gICAgICBjdXJyZW50OiBjYWNoZWQ/LnJlc3VsdCA/PyBudWxsLFxuICAgICAgY3VycmVudEludGVyZmFjZTogY2FjaGVkPy5pbnRlcmZhY2UgPz8gbnVsbCxcbiAgICAgIGN1cnJlbnRJc1N0YWxlOiBjYWNoZWQgIT09IG51bGwsXG4gICAgICBlcnJvcjogbnVsbCxcbiAgICAgIHByb2dyZXNzOiBudWxsLFxuICAgICAgcnVubmluZ01vZGU6IG51bGwsXG4gICAgICBydW5uaW5nSW50ZXJmYWNlOiBudWxsLFxuICAgIH07XG4gIH0pO1xuXG4gIGNvbnN0IHN0b3BUaW1lciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAodGltZXJSZWYuY3VycmVudCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lclJlZi5jdXJyZW50KTtcbiAgICAgIHRpbWVyUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIGNvbnN0IHN0YXJ0VGltZXIgPSB1c2VDYWxsYmFjayhcbiAgICAoZXN0aW1hdGVkTXM6IG51bWJlcikgPT4ge1xuICAgICAgc3RvcFRpbWVyKCk7XG4gICAgICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgICAgdGltZXJSZWYuY3VycmVudCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gICAgICAgIHNldFN0YXRlKChwcmV2KSA9PlxuICAgICAgICAgIHByZXYuc3RhdHVzID09PSBcInJ1bm5pbmdcIlxuICAgICAgICAgICAgPyB7IC4uLnByZXYsIHByb2dyZXNzOiBjb21wdXRlUHJvZ3Jlc3MoZWxhcHNlZCwgZXN0aW1hdGVkTXMpIH1cbiAgICAgICAgICAgIDogcHJldixcbiAgICAgICAgKTtcbiAgICAgIH0sIFBST0dSRVNTX1RJQ0tfTVMpO1xuICAgIH0sXG4gICAgW3N0b3BUaW1lcl0sXG4gICk7XG5cbiAgY29uc3QgY2FuY2VsID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGFib3J0UmVmLmN1cnJlbnQ/LmFib3J0KCk7XG4gICAgYWJvcnRSZWYuY3VycmVudCA9IG51bGw7XG4gICAgc3RvcFRpbWVyKCk7XG4gICAgc2V0U3RhdGUoKHByZXYpID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgc3RhdHVzOiBcImNhbmNlbGxlZFwiLFxuICAgICAgcHJvZ3Jlc3M6IG51bGwsXG4gICAgICBydW5uaW5nTW9kZTogbnVsbCxcbiAgICAgIHJ1bm5pbmdJbnRlcmZhY2U6IG51bGwsXG4gICAgfSkpO1xuICB9LCBbc3RvcFRpbWVyXSk7XG5cbiAgY29uc3QgcnVuVGVzdCA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChtb2RlOiBUZXN0TW9kZSA9IGRlZmF1bHRNb2RlLCBpZmFjZT86IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsKSA9PiB7XG4gICAgICBhYm9ydFJlZi5jdXJyZW50Py5hYm9ydCgpO1xuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGFib3J0UmVmLmN1cnJlbnQgPSBjb250cm9sbGVyO1xuXG4gICAgICBjb25zdCByZXNvbHZlZElmYWNlID0gaWZhY2UgPz8gKGF3YWl0IGdldERlZmF1bHRJbnRlcmZhY2VEZXRhaWxzKCkpO1xuICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgIGNvbnN0IGlmYWNlTmFtZSA9IHJlc29sdmVkSWZhY2U/Lm5hbWUgPz8gXCJ1bmtub3duXCI7XG4gICAgICBjb25zdCBlc3RpbWF0ZWRNcyA9IGF3YWl0IHN0YXRzUmVmLmN1cnJlbnQuZXN0aW1hdGUobW9kZSwgaWZhY2VOYW1lKTtcbiAgICAgIGlmIChjb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IHN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgICBjb25zdCBlbnRyeUlkID0gcmFuZG9tVVVJRCgpO1xuXG4gICAgICBzZXRTdGF0ZSgocHJldikgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgc3RhdHVzOiBcInJ1bm5pbmdcIixcbiAgICAgICAgZXJyb3I6IG51bGwsXG4gICAgICAgIHByb2dyZXNzOiBjb21wdXRlUHJvZ3Jlc3MoMCwgZXN0aW1hdGVkTXMpLFxuICAgICAgICBydW5uaW5nTW9kZTogbW9kZSxcbiAgICAgICAgcnVubmluZ0ludGVyZmFjZTogcmVzb2x2ZWRJZmFjZSxcbiAgICAgIH0pKTtcbiAgICAgIHN0YXJ0VGltZXIoZXN0aW1hdGVkTXMpO1xuXG4gICAgICBsZXQgYXR0ZW1wdCA9IDA7XG4gICAgICBsZXQgbGFzdEVycm9yOiB1bmtub3duID0gbnVsbDtcbiAgICAgIHdoaWxlIChhdHRlbXB0IDwgMikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bk5ldHdvcmtUZXN0KG1vZGUsIHtcbiAgICAgICAgICAgIGludGVyZmFjZU5hbWU6IGlmYWNlID8gaWZhY2UubmFtZSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgICAgICBzdG9wVGltZXIoKTtcbiAgICAgICAgICBjb25zdCBmaW5pc2hlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICBjb25zdCBkdXJhdGlvbk1zID0gZmluaXNoZWRBdCAtIHN0YXJ0ZWRBdDtcblxuICAgICAgICAgIGlmIChyZXNvbHZlZElmYWNlKSB7XG4gICAgICAgICAgICBzdG9yZVJlZi5jdXJyZW50LndyaXRlKHsgcmVzdWx0LCBpbnRlcmZhY2U6IHJlc29sdmVkSWZhY2UgfSk7XG4gICAgICAgICAgICBhd2FpdCBzdGF0c1JlZi5jdXJyZW50LnJlY29yZChtb2RlLCBpZmFjZU5hbWUsIGR1cmF0aW9uTXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBwZXJzaXN0SGlzdG9yeShoaXN0b3J5UmVmLmN1cnJlbnQsIHtcbiAgICAgICAgICAgIGlkOiBlbnRyeUlkLFxuICAgICAgICAgICAgc3RhcnRlZEF0LFxuICAgICAgICAgICAgZmluaXNoZWRBdCxcbiAgICAgICAgICAgIGR1cmF0aW9uTXMsXG4gICAgICAgICAgICBtb2RlLFxuICAgICAgICAgICAgaW50ZXJmYWNlOiByZXNvbHZlZElmYWNlID8/IHVua25vd25JbnRlcmZhY2UoaWZhY2VOYW1lKSxcbiAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgICAgY29tcGFyZVJ1bklkOiBudWxsLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgc2V0U3RhdGUoe1xuICAgICAgICAgICAgc3RhdHVzOiBcImlkbGVcIixcbiAgICAgICAgICAgIGN1cnJlbnQ6IHJlc3VsdCxcbiAgICAgICAgICAgIGN1cnJlbnRJbnRlcmZhY2U6IHJlc29sdmVkSWZhY2UsXG4gICAgICAgICAgICBjdXJyZW50SXNTdGFsZTogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogbnVsbCxcbiAgICAgICAgICAgIHByb2dyZXNzOiBudWxsLFxuICAgICAgICAgICAgcnVubmluZ01vZGU6IG51bGwsXG4gICAgICAgICAgICBydW5uaW5nSW50ZXJmYWNlOiBudWxsLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgICAgICBsYXN0RXJyb3IgPSBlcnI7XG4gICAgICAgICAgYXR0ZW1wdCArPSAxO1xuICAgICAgICAgIGlmIChhdHRlbXB0IDwgMiAmJiBpc1RyYW5zaWVudEVycm9yKGVycikpIHtcbiAgICAgICAgICAgIC8vIGJyaWVmIHBhdXNlIHRoZW4gcmV0cnkgb25jZSBzaWxlbnRseVxuICAgICAgICAgICAgYXdhaXQgc2xlZXAoVFJBTlNJRU5UX1JFVFJZX0RFTEFZX01TLCBjb250cm9sbGVyLnNpZ25hbCk7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgcmV0dXJuO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHN0b3BUaW1lcigpO1xuICAgICAgY29uc3QgZXJyRGV0YWlscyA9IGRlc2NyaWJlRXJyb3IobGFzdEVycm9yLCBhdHRlbXB0ID4gMSk7XG4gICAgICBhd2FpdCBwZXJzaXN0SGlzdG9yeShoaXN0b3J5UmVmLmN1cnJlbnQsIHtcbiAgICAgICAgaWQ6IGVudHJ5SWQsXG4gICAgICAgIHN0YXJ0ZWRBdCxcbiAgICAgICAgZmluaXNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgZHVyYXRpb25NczogRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdCxcbiAgICAgICAgbW9kZSxcbiAgICAgICAgaW50ZXJmYWNlOiByZXNvbHZlZElmYWNlID8/IHVua25vd25JbnRlcmZhY2UoaWZhY2VOYW1lKSxcbiAgICAgICAgcmVzdWx0OiBudWxsLFxuICAgICAgICBlcnJvcjogZXJyRGV0YWlscy5tZXNzYWdlLFxuICAgICAgICBjb21wYXJlUnVuSWQ6IG51bGwsXG4gICAgICB9KTtcbiAgICAgIHNldFN0YXRlKChwcmV2KSA9PiAoe1xuICAgICAgICAuLi5wcmV2LFxuICAgICAgICBzdGF0dXM6IFwiZXJyb3JcIixcbiAgICAgICAgZXJyb3I6IGVyckRldGFpbHMsXG4gICAgICAgIHByb2dyZXNzOiBudWxsLFxuICAgICAgICBydW5uaW5nTW9kZTogbnVsbCxcbiAgICAgICAgcnVubmluZ0ludGVyZmFjZTogbnVsbCxcbiAgICAgIH0pKTtcbiAgICB9LFxuICAgIFtkZWZhdWx0TW9kZSwgc3RhcnRUaW1lciwgc3RvcFRpbWVyXSxcbiAgKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChhdXRvU3RhcnQpIHZvaWQgcnVuVGVzdCgpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBhYm9ydFJlZi5jdXJyZW50Py5hYm9ydCgpO1xuICAgICAgc3RvcFRpbWVyKCk7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiB7IHN0YXRlLCBydW5UZXN0LCBjYW5jZWwgfTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb2dyZXNzKFxuICBlbGFwc2VkTXM6IG51bWJlcixcbiAgZXN0aW1hdGVkVG90YWxNczogbnVtYmVyLFxuKTogVGVzdFByb2dyZXNzIHtcbiAgY29uc3QgcmF3RnJhY3Rpb24gPSBlbGFwc2VkTXMgLyBNYXRoLm1heCgxLCBlc3RpbWF0ZWRUb3RhbE1zKTtcbiAgY29uc3Qgb3ZlcnJ1biA9IHJhd0ZyYWN0aW9uID49IDE7XG4gIGNvbnN0IGZyYWN0aW9uID0gb3ZlcnJ1biA/IDAuOTcgOiBNYXRoLm1pbigwLjk3LCByYXdGcmFjdGlvbik7XG4gIHJldHVybiB7XG4gICAgcGhhc2U6IHBoYXNlRm9yKHJhd0ZyYWN0aW9uLCBvdmVycnVuKSxcbiAgICBlbGFwc2VkTXMsXG4gICAgZXN0aW1hdGVkVG90YWxNcyxcbiAgICBmcmFjdGlvbixcbiAgICBvdmVycnVuLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwaGFzZUZvcihyYXdGcmFjdGlvbjogbnVtYmVyLCBvdmVycnVuOiBib29sZWFuKTogVGVzdFBoYXNlIHtcbiAgaWYgKG92ZXJydW4pIHJldHVybiBcIm92ZXJydW5cIjtcbiAgaWYgKHJhd0ZyYWN0aW9uIDwgMC4xMikgcmV0dXJuIFwid2FybXVwXCI7XG4gIGlmIChyYXdGcmFjdGlvbiA8IDAuOSkgcmV0dXJuIFwibWVhc3VyaW5nXCI7XG4gIHJldHVybiBcImZpbmFsaXppbmdcIjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcGVyc2lzdEhpc3Rvcnkoc3RvcmU6IEhpc3RvcnlTdG9yZSwgZW50cnk6IEhpc3RvcnlFbnRyeSkge1xuICB0cnkge1xuICAgIGF3YWl0IHN0b3JlLmFwcGVuZChlbnRyeSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIEhpc3RvcnkgcGVyc2lzdGVuY2UgbXVzdCBuZXZlciBicmVhayBhIHRlc3QgcnVuLlxuICB9XG59XG5cbmZ1bmN0aW9uIHVua25vd25JbnRlcmZhY2UobmFtZTogc3RyaW5nKTogTmV0d29ya0ludGVyZmFjZSB7XG4gIHJldHVybiB7XG4gICAgbmFtZSxcbiAgICB0eXBlOiBcIm90aGVyXCIsXG4gICAgaGFyZHdhcmVQb3J0OiBcIlVua25vd25cIixcbiAgICBzc2lkOiBudWxsLFxuICAgIGlwdjQ6IG51bGwsXG4gICAgYWN0aXZlOiBmYWxzZSxcbiAgICBpc0RlZmF1bHQ6IGZhbHNlLFxuICAgIGlzSG90c3BvdDogZmFsc2UsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlRXJyb3IoZXJyOiB1bmtub3duLCB3YXNSZXRyaWVkOiBib29sZWFuKTogVGVzdEVycm9yRGV0YWlscyB7XG4gIGlmIChlcnIgaW5zdGFuY2VvZiBOZXR3b3JrVGVzdEVycm9yKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgcmF3T3V0cHV0OiBlcnIuZGlhZ25vc3RpY3M/LnN0ZG91dCxcbiAgICAgIHJhd1N0ZGVycjogZXJyLmRpYWdub3N0aWNzPy5zdGRlcnIsXG4gICAgICBhcmdzOiBlcnIuZGlhZ25vc3RpY3M/LmFyZ3MsXG4gICAgICB3YXNSZXRyaWVkLFxuICAgIH07XG4gIH1cbiAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgcmV0dXJuIHsgbWVzc2FnZTogZXJyLm1lc3NhZ2UsIHdhc1JldHJpZWQgfTtcbiAgfVxuICByZXR1cm4geyBtZXNzYWdlOiBcIlVua25vd24gZXJyb3JcIiwgd2FzUmV0cmllZCB9O1xufVxuXG5mdW5jdGlvbiBzbGVlcChtczogbnVtYmVyLCBzaWduYWw6IEFib3J0U2lnbmFsKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKHNpZ25hbC5hYm9ydGVkKSB7XG4gICAgICByZWplY3QobmV3IEVycm9yKFwiYWJvcnRlZFwiKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIG9uQWJvcnQpO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0sIG1zKTtcbiAgICBjb25zdCBvbkFib3J0ID0gKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJhYm9ydGVkXCIpKTtcbiAgICB9O1xuICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgb25BYm9ydCwgeyBvbmNlOiB0cnVlIH0pO1xuICB9KTtcbn1cblxuZXhwb3J0IHsgRkFMTEJBQ0tfRVNUSU1BVEVfTVMgfTtcbiIsICJpbXBvcnQgeyBleGVjRmlsZSB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJub2RlOnV0aWxcIjtcbmltcG9ydCB0eXBlIHsgTmV0d29ya1Rlc3RSZXN1bHQsIFJlc3BvbnNpdmVuZXNzVGllciwgVGVzdE1vZGUgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuY29uc3QgZXhlY0ZpbGVBc3luYyA9IHByb21pc2lmeShleGVjRmlsZSk7XG5cbmNvbnN0IE5FVFdPUktRVUFMSVRZX0JJTiA9IFwiL3Vzci9iaW4vbmV0d29ya3F1YWxpdHlcIjtcbmNvbnN0IFRFU1RfVElNRU9VVF9NUyA9IDE4MF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBOZXR3b3JrVGVzdEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgcHVibGljIHJlYWRvbmx5IGNhdXNlPzogdW5rbm93bixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY3M/OiB7XG4gICAgICBzdGRvdXQ/OiBzdHJpbmc7XG4gICAgICBzdGRlcnI/OiBzdHJpbmc7XG4gICAgICBhcmdzPzogc3RyaW5nW107XG4gICAgfSxcbiAgKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJOZXR3b3JrVGVzdEVycm9yXCI7XG4gIH1cbn1cblxuLyoqXG4gKiBFcnJvcnMgdGhhdCBhcmUgbGlrZWx5IHRyYW5zaWVudCAobmV0d29yayBibGlwLCBzZXJ2ZXItc2lkZSByZWZ1c2FsKSB2cy5cbiAqIGRldGVybWluaXN0aWMgKG1pc3NpbmcgYmluYXJ5LCBiYWQgYXJnKS4gRHJpdmVzIHRoZSByZXRyeSBwb2xpY3kgaW4gdGhlIGhvb2suXG4gKi9cbmV4cG9ydCBjb25zdCBUUkFOU0lFTlRfRVJST1JfTUFSS0VSUyA9IFtcbiAgXCJubyB1c2FibGUgbWVhc3VyZW1lbnRzXCIsXG4gIFwiY291bGQgbm90IHBhcnNlXCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNUcmFuc2llbnRFcnJvcihlcnI6IHVua25vd24pOiBib29sZWFuIHtcbiAgaWYgKCEoZXJyIGluc3RhbmNlb2YgTmV0d29ya1Rlc3RFcnJvcikpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgbXNnID0gZXJyLm1lc3NhZ2UudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIFRSQU5TSUVOVF9FUlJPUl9NQVJLRVJTLnNvbWUoKG0pID0+IG1zZy5pbmNsdWRlcyhtKSk7XG59XG5cbmludGVyZmFjZSBSYXdOZXR3b3JrUXVhbGl0eUpzb24ge1xuICBkbF90aHJvdWdocHV0PzogbnVtYmVyO1xuICB1bF90aHJvdWdocHV0PzogbnVtYmVyO1xuICByZXNwb25zaXZlbmVzcz86IG51bWJlcjtcbiAgZGxfcmVzcG9uc2l2ZW5lc3M/OiBudW1iZXI7XG4gIHVsX3Jlc3BvbnNpdmVuZXNzPzogbnVtYmVyO1xuICBiYXNlX3J0dD86IG51bWJlcjtcbiAgaW50ZXJmYWNlX25hbWU/OiBzdHJpbmc7XG4gIHRlc3RfZW5kcG9pbnQ/OiBzdHJpbmc7XG4gIGVuZF9kYXRlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJ1blRlc3RPcHRpb25zIHtcbiAgLyoqIEJpbmQgbmV0d29ya3F1YWxpdHkgdG8gYSBzcGVjaWZpYyBpbnRlcmZhY2UgKC1JKS4gKi9cbiAgaW50ZXJmYWNlTmFtZT86IHN0cmluZztcbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5OZXR3b3JrVGVzdChcbiAgbW9kZTogVGVzdE1vZGUsXG4gIG9wdGlvbnM6IFJ1blRlc3RPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPE5ldHdvcmtUZXN0UmVzdWx0PiB7XG4gIGNvbnN0IGFyZ3MgPSBidWlsZEFyZ3MobW9kZSwgb3B0aW9ucy5pbnRlcmZhY2VOYW1lKTtcbiAgbGV0IHN0ZG91dDogc3RyaW5nO1xuICBsZXQgc3RkZXJyOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVBc3luYyhORVRXT1JLUVVBTElUWV9CSU4sIGFyZ3MsIHtcbiAgICAgIHRpbWVvdXQ6IFRFU1RfVElNRU9VVF9NUyxcbiAgICAgIHNpZ25hbDogb3B0aW9ucy5zaWduYWwsXG4gICAgICBtYXhCdWZmZXI6IDQgKiAxMDI0ICogMTAyNCxcbiAgICB9KTtcbiAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgIHN0ZGVyciA9IHJlc3VsdC5zdGRlcnI7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnN0IGUgPSBlcnIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uICYge1xuICAgICAgc3Rkb3V0Pzogc3RyaW5nO1xuICAgICAgc3RkZXJyPzogc3RyaW5nO1xuICAgIH07XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXG4gICAgICBcIm5ldHdvcmtxdWFsaXR5IGZhaWxlZCB0byBydW4uIFJlcXVpcmVzIG1hY09TIDEyKy5cIixcbiAgICAgIGVycixcbiAgICAgIHsgc3Rkb3V0OiBlLnN0ZG91dCwgc3RkZXJyOiBlLnN0ZGVyciwgYXJncyB9LFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcGFyc2VOZXR3b3JrUXVhbGl0eU91dHB1dChzdGRvdXQsIG1vZGUsIHsgc3RkZXJyLCBhcmdzIH0pO1xufVxuXG5mdW5jdGlvbiBidWlsZEFyZ3MobW9kZTogVGVzdE1vZGUsIGludGVyZmFjZU5hbWU/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGFyZ3M6IHN0cmluZ1tdID0gW1wiLWNcIl07XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgXCJwYXJhbGxlbFwiOlxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInNlcXVlbnRpYWxcIjpcbiAgICAgIGFyZ3MucHVzaChcIi1zXCIpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImRvd25sb2FkXCI6XG4gICAgICBhcmdzLnB1c2goXCItdVwiKTsgLy8gc2tpcCB1cGxvYWRcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJ1cGxvYWRcIjpcbiAgICAgIGFyZ3MucHVzaChcIi1kXCIpOyAvLyBza2lwIGRvd25sb2FkXG4gICAgICBicmVhaztcbiAgfVxuICBpZiAoaW50ZXJmYWNlTmFtZSkgYXJncy5wdXNoKFwiLUlcIiwgaW50ZXJmYWNlTmFtZSk7XG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VOZXR3b3JrUXVhbGl0eU91dHB1dChcbiAgc3Rkb3V0OiBzdHJpbmcsXG4gIG1vZGU6IFRlc3RNb2RlLFxuICBkaWFnbm9zdGljcz86IHsgc3RkZXJyPzogc3RyaW5nOyBhcmdzPzogc3RyaW5nW10gfSxcbik6IE5ldHdvcmtUZXN0UmVzdWx0IHtcbiAgbGV0IHJhdzogUmF3TmV0d29ya1F1YWxpdHlKc29uO1xuICB0cnkge1xuICAgIHJhdyA9IEpTT04ucGFyc2Uoc3Rkb3V0KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXCJDb3VsZCBub3QgcGFyc2UgbmV0d29ya3F1YWxpdHkgb3V0cHV0XCIsIGVyciwge1xuICAgICAgc3Rkb3V0LFxuICAgICAgLi4uZGlhZ25vc3RpY3MsXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb3dubG9hZEJwcyA9IHRvTnVtYmVyT3JOdWxsKHJhdy5kbF90aHJvdWdocHV0KTtcbiAgY29uc3QgdXBsb2FkQnBzID0gdG9OdW1iZXJPck51bGwocmF3LnVsX3Rocm91Z2hwdXQpO1xuICBjb25zdCByZXNwb25zaXZlbmVzc1JwbSA9XG4gICAgdG9OdW1iZXJPck51bGwocmF3LnJlc3BvbnNpdmVuZXNzKSA/P1xuICAgIHRvTnVtYmVyT3JOdWxsKHJhdy5kbF9yZXNwb25zaXZlbmVzcykgPz9cbiAgICB0b051bWJlck9yTnVsbChyYXcudWxfcmVzcG9uc2l2ZW5lc3MpO1xuICBjb25zdCBiYXNlUnR0TXMgPSB0b051bWJlck9yTnVsbChyYXcuYmFzZV9ydHQpO1xuXG4gIGlmIChkb3dubG9hZEJwcyA9PT0gbnVsbCAmJiB1cGxvYWRCcHMgPT09IG51bGwgJiYgYmFzZVJ0dE1zID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXG4gICAgICBcIm5ldHdvcmtxdWFsaXR5IHJldHVybmVkIG5vIHVzYWJsZSBtZWFzdXJlbWVudHNcIixcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIHsgc3Rkb3V0LCAuLi5kaWFnbm9zdGljcyB9LFxuICAgICk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGUsXG4gICAgZG93bmxvYWRCcHMsXG4gICAgdXBsb2FkQnBzLFxuICAgIHJlc3BvbnNpdmVuZXNzUnBtLFxuICAgIHJlc3BvbnNpdmVuZXNzVGllcjpcbiAgICAgIHJlc3BvbnNpdmVuZXNzUnBtID09PSBudWxsXG4gICAgICAgID8gbnVsbFxuICAgICAgICA6IGNsYXNzaWZ5UmVzcG9uc2l2ZW5lc3MocmVzcG9uc2l2ZW5lc3NScG0pLFxuICAgIGJhc2VSdHRNcyxcbiAgICBpbnRlcmZhY2VOYW1lOiByYXcuaW50ZXJmYWNlX25hbWUgPz8gXCJ1bmtub3duXCIsXG4gICAgdGVzdEVuZHBvaW50OiByYXcudGVzdF9lbmRwb2ludCA/PyBcInVua25vd25cIixcbiAgICBmaW5pc2hlZEF0OiBwYXJzZUVuZERhdGUocmF3LmVuZF9kYXRlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdG9OdW1iZXJPck51bGwodmFsdWU6IHVua25vd24pOiBudW1iZXIgfCBudWxsIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiAmJiAhTnVtYmVyLmlzTmFOKHZhbHVlKSA/IHZhbHVlIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gY2xhc3NpZnlSZXNwb25zaXZlbmVzcyhycG06IG51bWJlcik6IFJlc3BvbnNpdmVuZXNzVGllciB7XG4gIGlmIChycG0gPj0gMTAwMCkgcmV0dXJuIFwiaGlnaFwiO1xuICBpZiAocnBtID49IDEwMCkgcmV0dXJuIFwibWVkaXVtXCI7XG4gIHJldHVybiBcImxvd1wiO1xufVxuXG5mdW5jdGlvbiBwYXJzZUVuZERhdGUodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gIGlmICghdmFsdWUpIHJldHVybiBEYXRlLm5vdygpO1xuICBjb25zdCBpc29pc2ggPSB2YWx1ZS5yZXBsYWNlKFwiIFwiLCBcIlRcIikgKyBcIlpcIjtcbiAgY29uc3QgdHMgPSBEYXRlLnBhcnNlKGlzb2lzaCk7XG4gIHJldHVybiBOdW1iZXIuaXNOYU4odHMpID8gRGF0ZS5ub3coKSA6IHRzO1xufVxuIiwgImltcG9ydCB7IGV4ZWNGaWxlIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSBcIm5vZGU6dXRpbFwiO1xuaW1wb3J0IHR5cGUgeyBJbnRlcmZhY2VUeXBlLCBOZXR3b3JrSW50ZXJmYWNlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IGV4ZWNGaWxlQXN5bmMgPSBwcm9taXNpZnkoZXhlY0ZpbGUpO1xuXG5jb25zdCBDTURfVElNRU9VVF9NUyA9IDRfMDAwO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBldmVyeSBCU0QgbmV0d29yayBkZXZpY2UsIGRlY29yYXRlIHdpdGggc3RhdHVzLCBJUCwgU1NJRCwgdHlwZS5cbiAqIFNvcnRlZDogYWN0aXZlIGZpcnN0LCBkZWZhdWx0IHJvdXRlIGZpcnN0IHdpdGhpbiBhY3RpdmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0SW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICBjb25zdCBbcG9ydHMsIGRlZmF1bHRJZmFjZV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgbGlzdEhhcmR3YXJlUG9ydHMoKSxcbiAgICBnZXREZWZhdWx0SW50ZXJmYWNlKCksXG4gIF0pO1xuXG4gIGNvbnN0IGRlY29yYXRlZCA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIHBvcnRzLm1hcChhc3luYyAocCkgPT4ge1xuICAgICAgY29uc3QgW2FjdGl2ZSwgaXB2NF0gPSBhd2FpdCByZWFkSWZjb25maWcocC5kZXZpY2UpO1xuICAgICAgY29uc3QgdHlwZSA9IGNsYXNzaWZ5VHlwZShwLmhhcmR3YXJlUG9ydCk7XG4gICAgICBjb25zdCBzc2lkID0gdHlwZSA9PT0gXCJ3aWZpXCIgPyBhd2FpdCByZWFkU1NJRChwLmRldmljZSkgOiBudWxsO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogcC5kZXZpY2UsXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGhhcmR3YXJlUG9ydDogcC5oYXJkd2FyZVBvcnQsXG4gICAgICAgIHNzaWQsXG4gICAgICAgIGlwdjQsXG4gICAgICAgIGFjdGl2ZSxcbiAgICAgICAgaXNEZWZhdWx0OiBwLmRldmljZSA9PT0gZGVmYXVsdElmYWNlLFxuICAgICAgICBpc0hvdHNwb3Q6IHR5cGUgPT09IFwid2lmaVwiICYmIGlzSG90c3BvdElwKGlwdjQpLFxuICAgICAgfSBzYXRpc2ZpZXMgTmV0d29ya0ludGVyZmFjZTtcbiAgICB9KSxcbiAgKTtcblxuICByZXR1cm4gZGVjb3JhdGVkLnNvcnQoY29tcGFyZUludGVyZmFjZXMpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QWN0aXZlSW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICByZXR1cm4gKGF3YWl0IGxpc3RJbnRlcmZhY2VzKCkpLmZpbHRlcigoaSkgPT4gaS5hY3RpdmUpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGVmYXVsdEludGVyZmFjZURldGFpbHMoKTogUHJvbWlzZTxOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbD4ge1xuICBjb25zdCBhbGwgPSBhd2FpdCBsaXN0SW50ZXJmYWNlcygpO1xuICByZXR1cm4gYWxsLmZpbmQoKGkpID0+IGkuaXNEZWZhdWx0KSA/PyBhbGwuZmluZCgoaSkgPT4gaS5hY3RpdmUpID8/IG51bGw7XG59XG5cbi8qKiBQcmV0dHktcHJpbnQ6IFwiV2ktRmkgXHUwMEI3IEhvbWVOZXRcIiBvciBcIkhvdHNwb3QgXHUwMEI3IGlQaG9uZVwiICovXG5leHBvcnQgZnVuY3Rpb24gZGlzcGxheU5hbWUoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBzdHJpbmcge1xuICBjb25zdCBwb3J0TGFiZWwgPSBwb3J0U2hvcnRMYWJlbChpZmFjZSk7XG4gIGlmIChpZmFjZS5zc2lkKSByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5zc2lkfWA7XG4gIGlmIChpZmFjZS5pc0hvdHNwb3QgJiYgaWZhY2UuaXB2NCkgcmV0dXJuIGAke3BvcnRMYWJlbH0gXHUwMEI3ICR7aWZhY2UuaXB2NH1gO1xuICBpZiAoaWZhY2UudHlwZSA9PT0gXCJ3aWZpXCIgJiYgaWZhY2UuYWN0aXZlKVxuICAgIHJldHVybiBgJHtwb3J0TGFiZWx9IFx1MDBCNyAobmFtZSB1bmF2YWlsYWJsZSlgO1xuICByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5uYW1lfWA7XG59XG5cbmZ1bmN0aW9uIHBvcnRTaG9ydExhYmVsKGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlKTogc3RyaW5nIHtcbiAgaWYgKGlmYWNlLmlzSG90c3BvdCkgcmV0dXJuIFwiSG90c3BvdFwiO1xuICBzd2l0Y2ggKGlmYWNlLnR5cGUpIHtcbiAgICBjYXNlIFwid2lmaVwiOlxuICAgICAgcmV0dXJuIFwiV2ktRmlcIjtcbiAgICBjYXNlIFwiZXRoZXJuZXRcIjpcbiAgICAgIHJldHVybiBcIkV0aGVybmV0XCI7XG4gICAgY2FzZSBcInRodW5kZXJib2x0XCI6XG4gICAgICByZXR1cm4gXCJUaHVuZGVyYm9sdFwiO1xuICAgIGNhc2UgXCJ1c2JcIjpcbiAgICAgIHJldHVybiAvaXBob25lL2kudGVzdChpZmFjZS5oYXJkd2FyZVBvcnQpID8gXCJpUGhvbmUgVVNCXCIgOiBcIlVTQlwiO1xuICAgIGNhc2UgXCJibHVldG9vdGhcIjpcbiAgICAgIHJldHVybiBcIkJsdWV0b290aFwiO1xuICAgIGNhc2UgXCJvdGhlclwiOlxuICAgICAgcmV0dXJuIGlmYWNlLmhhcmR3YXJlUG9ydDtcbiAgfVxufVxuXG4vKipcbiAqIEtub3duIHRldGhlcmluZyAvIFBlcnNvbmFsIEhvdHNwb3Qgc3VibmV0cy4gaVBob25lIFBlcnNvbmFsIEhvdHNwb3QgdXNlc1xuICogMTcyLjIwLjEwLjAvMjg7IGNvbW1vbiBBbmRyb2lkIHRldGhlcmluZyByYW5nZXMgYXJlIDE5Mi4xNjguNDMueCBhbmRcbiAqIDE5Mi4xNjguNDkueC4gVGhlc2UgYXJlIGRldmljZSBkZWZhdWx0cyBcdTIwMTQgc2F2dnkgdXNlcnMgY2FuIGNoYW5nZSB0aGVtXG4gKiBidXQgdmlydHVhbGx5IG5vYm9keSBkb2VzLlxuICovXG5jb25zdCBIT1RTUE9UX1BSRUZJWEVTID0gW1wiMTcyLjIwLjEwLlwiLCBcIjE5Mi4xNjguNDMuXCIsIFwiMTkyLjE2OC40OS5cIl07XG5cbmZ1bmN0aW9uIGlzSG90c3BvdElwKGlwdjQ6IHN0cmluZyB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCFpcHY0KSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBIT1RTUE9UX1BSRUZJWEVTLnNvbWUoKHApID0+IGlwdjQuc3RhcnRzV2l0aChwKSk7XG59XG5cbi8vIC0tLS0gbG93LWxldmVsIGNvbW1hbmQgd3JhcHBlcnMgLS0tLVxuXG5pbnRlcmZhY2UgSGFyZHdhcmVQb3J0IHtcbiAgaGFyZHdhcmVQb3J0OiBzdHJpbmc7XG4gIGRldmljZTogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsaXN0SGFyZHdhcmVQb3J0cygpOiBQcm9taXNlPEhhcmR3YXJlUG9ydFtdPiB7XG4gIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgIFwiL3Vzci9zYmluL25ldHdvcmtzZXR1cFwiLFxuICAgIFtcIi1saXN0YWxsaGFyZHdhcmVwb3J0c1wiXSxcbiAgICB7IHRpbWVvdXQ6IENNRF9USU1FT1VUX01TIH0sXG4gICk7XG5cbiAgY29uc3QgcG9ydHM6IEhhcmR3YXJlUG9ydFtdID0gW107XG4gIGxldCBjdXJyZW50UG9ydDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgcmF3TGluZSBvZiBzdGRvdXQuc3BsaXQoXCJcXG5cIikpIHtcbiAgICBjb25zdCBsaW5lID0gcmF3TGluZS50cmltKCk7XG4gICAgY29uc3QgcG9ydE1hdGNoID0gbGluZS5tYXRjaCgvXkhhcmR3YXJlIFBvcnQ6XFxzKiguKykkLyk7XG4gICAgaWYgKHBvcnRNYXRjaCkge1xuICAgICAgY3VycmVudFBvcnQgPSBwb3J0TWF0Y2hbMV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZGV2aWNlTWF0Y2ggPSBsaW5lLm1hdGNoKC9eRGV2aWNlOlxccyooXFxTKykkLyk7XG4gICAgaWYgKGRldmljZU1hdGNoICYmIGN1cnJlbnRQb3J0KSB7XG4gICAgICBwb3J0cy5wdXNoKHsgaGFyZHdhcmVQb3J0OiBjdXJyZW50UG9ydCwgZGV2aWNlOiBkZXZpY2VNYXRjaFsxXSB9KTtcbiAgICAgIGN1cnJlbnRQb3J0ID0gbnVsbDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBvcnRzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXREZWZhdWx0SW50ZXJmYWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvc2Jpbi9yb3V0ZVwiLFxuICAgICAgW1wiLW5cIiwgXCJnZXRcIiwgXCJkZWZhdWx0XCJdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqaW50ZXJmYWNlOlxccyooXFxTKykvbSk7XG4gICAgcmV0dXJuIG1hdGNoPy5bMV0gPz8gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqIFJldHVybnMgW2FjdGl2ZSwgaXB2NE9yTnVsbF0uIEFjdGl2ZSA9IFwic3RhdHVzOiBhY3RpdmVcIiArIGhhcyBpbmV0IGxpbmUuICovXG5hc3luYyBmdW5jdGlvbiByZWFkSWZjb25maWcoZGV2aWNlOiBzdHJpbmcpOiBQcm9taXNlPFtib29sZWFuLCBzdHJpbmcgfCBudWxsXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFwiL3NiaW4vaWZjb25maWdcIiwgW2RldmljZV0sIHtcbiAgICAgIHRpbWVvdXQ6IENNRF9USU1FT1VUX01TLFxuICAgIH0pO1xuICAgIGNvbnN0IGlwdjRNYXRjaCA9IHN0ZG91dC5tYXRjaCgvXlxccyppbmV0XFxzKyhcXGQrXFwuXFxkK1xcLlxcZCtcXC5cXGQrKVxcYi9tKTtcbiAgICBjb25zdCBzdGF0dXNBY3RpdmUgPSAvXFxic3RhdHVzOlxccyphY3RpdmVcXGIvLnRlc3Qoc3Rkb3V0KTtcbiAgICBjb25zdCBhY3RpdmUgPSBzdGF0dXNBY3RpdmUgJiYgaXB2NE1hdGNoICE9PSBudWxsO1xuICAgIHJldHVybiBbYWN0aXZlLCBpcHY0TWF0Y2g/LlsxXSA/PyBudWxsXTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtmYWxzZSwgbnVsbF07XG4gIH1cbn1cblxuLyoqXG4gKiBTZW50aW5lbCBzdHJpbmdzIG1hY09TIHJldHVybnMgd2hlbiB0aGUgU1NJRCBleGlzdHMgYnV0IGlzbid0IHJlYWRhYmxlLlxuICogYDxyZWRhY3RlZD5gIGNvbWVzIGZyb20gYGlwY29uZmlnIGdldHN1bW1hcnlgIHdpdGhvdXQgTG9jYXRpb24gU2VydmljZXNcbiAqIHBlcm1pc3Npb24gKGludHJvZHVjZWQgaW4gbWFjT1MgU29ub21hKS4gYChudWxsKWAgaXMgdGhlIG9sZGVyIGZvcm0uXG4gKiBXZSB0cmVhdCBhbGwgb2YgdGhlc2UgYXMgXCJ1bmtub3duXCIgcmF0aGVyIHRoYW4gbGV0dGluZyB0aGUgbGl0ZXJhbCB0ZXh0XG4gKiBsZWFrIGludG8gdGhlIFVJLlxuICovXG5jb25zdCBVTlJFQURBQkxFX1NTSURfTUFSS0VSUyA9IG5ldyBTZXQoW1wiPHJlZGFjdGVkPlwiLCBcIihudWxsKVwiLCBcIlwiXSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRTU0lEKGRldmljZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgICBcIi91c3Ivc2Jpbi9pcGNvbmZpZ1wiLFxuICAgICAgW1wiZ2V0c3VtbWFyeVwiLCBkZXZpY2VdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqU1NJRFxccyo6XFxzKiguKz8pXFxzKiQvbSk7XG4gICAgY29uc3Qgc3NpZCA9IG1hdGNoPy5bMV0/LnRyaW0oKSA/PyBcIlwiO1xuICAgIGlmIChVTlJFQURBQkxFX1NTSURfTUFSS0VSUy5oYXMoc3NpZCkpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBzc2lkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRydWUgd2hlbiB0aGUgaW50ZXJmYWNlIGlzIFdpLUZpLWNsYXNzIGFuZCB3ZSBjb3VsZG4ndCByZWFkIGFuIFNTSUQsXG4gKiBhbG1vc3QgYWx3YXlzIGJlY2F1c2UgUmF5Y2FzdCBsYWNrcyBMb2NhdGlvbiBTZXJ2aWNlcyBwZXJtaXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTU0lEUGVybWlzc2lvbk1pc3NpbmcoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlmYWNlLmFjdGl2ZSAmJiBpZmFjZS50eXBlID09PSBcIndpZmlcIiAmJiBpZmFjZS5zc2lkID09PSBudWxsO1xufVxuXG4vLyAtLS0tIFdpLUZpIHN3aXRjaGluZyAodXNlZCBieSBjb21wYXJlLW5ldHdvcmtzKSAtLS0tXG5cbi8qKiBSZXR1cm5zIHRoZSBCU0QgbmFtZSAoZW4wLCBlbjIsIC4uLikgb2YgdGhlIHByaW1hcnkgV2ktRmkgYWRhcHRlciwgb3IgbnVsbC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXaWZpRGV2aWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBwb3J0cyA9IGF3YWl0IGxpc3RIYXJkd2FyZVBvcnRzKCk7XG4gIGNvbnN0IHdpZmkgPSBwb3J0cy5maW5kKChwKSA9PiAvd2ktZml8YWlycG9ydC9pLnRlc3QocC5oYXJkd2FyZVBvcnQpKTtcbiAgcmV0dXJuIHdpZmk/LmRldmljZSA/PyBudWxsO1xufVxuXG4vKiogUmVhZCBjdXJyZW50IFdpLUZpIFNTSUQgdmlhIGlwY29uZmlnIChyZXR1cm5zIG51bGwgaWYgbm8gcGVybXMgb3Igbm90IGNvbm5lY3RlZCkuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudFdpZmlTU0lEKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBkZXZpY2UgPSBhd2FpdCBnZXRXaWZpRGV2aWNlKCk7XG4gIGlmICghZGV2aWNlKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHJlYWRTU0lEKGRldmljZSk7XG59XG5cbi8qKlxuICogTGlzdCBzYXZlZCBXaS1GaSBuZXR3b3JrcyBvbiB0aGlzIE1hYy4gVGhlc2UgYXJlIGNhbmRpZGF0ZXMgZm9yIHN3aXRjaGluZyB0b1xuICogZHVyaW5nIGNvbXBhcmUgcnVucyBcdTIwMTQgbWFjT1Mgd2lsbCB1c2UgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZC5cbiAqXG4gKiBOb3RlOiB0aGlzIGlzICprbm93biogbmV0d29ya3MsIG5vdCAqaW4tcmFuZ2UqIG5ldHdvcmtzLiBBIHRydWUgaW4tcmFuZ2VcbiAqIHNjYW4gbmVlZHMgYHdkdXRpbCBzY2FuYCAoc3Vkbykgb3IgdGhlIHJlbW92ZWQgYGFpcnBvcnQgLXNgIGNvbW1hbmQuIFdpdGhvdXRcbiAqIHRob3NlLCB3ZSBhdHRlbXB0IHRoZSBzd2l0Y2ggYW5kIGxldCBpdCBmYWlsIGZhc3QgaWYgdGhlIG5ldHdvcmsgaXNuJ3QgYXJvdW5kLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdEtub3duV2lmaU5ldHdvcmtzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgZGV2aWNlID0gYXdhaXQgZ2V0V2lmaURldmljZSgpO1xuICBpZiAoIWRldmljZSkgcmV0dXJuIFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgICBbXCItbGlzdHByZWZlcnJlZHdpcmVsZXNzbmV0d29ya3NcIiwgZGV2aWNlXSxcbiAgICAgIHsgdGltZW91dDogQ01EX1RJTUVPVVRfTVMgfSxcbiAgICApO1xuICAgIC8vIE91dHB1dDpcbiAgICAvLyAgIFByZWZlcnJlZCBuZXR3b3JrcyBvbiBlbjA6XG4gICAgLy8gICBcXHROZXR3b3JrQVxuICAgIC8vICAgXFx0TmV0d29ya0JcbiAgICByZXR1cm4gc3Rkb3V0XG4gICAgICAuc3BsaXQoXCJcXG5cIilcbiAgICAgIC5zbGljZSgxKVxuICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKChsKSA9PiBsLmxlbmd0aCA+IDApO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiBTd2l0Y2ggV2ktRmkgdG8gdGhlIGdpdmVuIFNTSUQuIFVzZXMgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZCBpZiBrbm93bi5cbiAqIFRocm93cyBvbiBmYWlsdXJlIChuZXR3b3JrIG5vdCBpbiByYW5nZSwgYXV0aCBmYWlsZWQsIHVua25vd24gbmV0d29yaykuXG4gKlxuICogU3BlY2lhbCBjYXNlOiBpUGhvbmUvaVBhZCBQZXJzb25hbCBIb3RzcG90LiBUaGVzZSBvZnRlbiBhcHBlYXIgaW4gdGhlXG4gKiBwcmVmZXJyZWQtbmV0d29ya3MgbGlzdCBidXQgYXJlIGFjdGl2YXRlZCB2aWEgQmx1ZXRvb3RoL0NvbnRpbnVpdHksIG5vdFxuICogYSByZWFsIFdpLUZpIGJyb2FkY2FzdC4gYG5ldHdvcmtzZXR1cGAgY2FuJ3QgdHJpZ2dlciB0aGF0IGFjdGl2YXRpb24gXHUyMDE0XG4gKiB3ZSBzdXJmYWNlIGEgdGFpbG9yZWQgaGludCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBpbnN0ZWFkIG9mIHRoZSByYXdcbiAqIFwiQ291bGQgbm90IGZpbmQgbmV0d29ya1wiIG91dHB1dCwgd2hpY2ggaXMgY29uZnVzaW5nIGhlcmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzd2l0Y2hXaWZpVG8oXG4gIGRldmljZTogc3RyaW5nLFxuICBzc2lkOiBzdHJpbmcsXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgW1wiLXNldGFpcnBvcnRuZXR3b3JrXCIsIGRldmljZSwgc3NpZF0sXG4gICAgeyB0aW1lb3V0OiAyMF8wMDAsIHNpZ25hbCB9LFxuICApO1xuICBjb25zdCBjb21iaW5lZCA9IGAke3N0ZG91dH1cXG4ke3N0ZGVycn1gLnRvTG93ZXJDYXNlKCk7XG4gIC8vIG5ldHdvcmtzZXR1cCByZXR1cm5zIGV4aXQgMCBldmVuIG9uIGZhaWx1cmU7IGhhdmUgdG8gc2NhbiBvdXRwdXRcbiAgaWYgKFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZmFpbGVkXCIpIHx8XG4gICAgY29tYmluZWQuaW5jbHVkZXMoXCJjb3VsZCBub3QgZmluZFwiKSB8fFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZXJyb3JcIilcbiAgKSB7XG4gICAgaWYgKGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGAke3NzaWR9IGlzIGEgUGVyc29uYWwgSG90c3BvdCBcdTIwMTQgYWN0aXZhdGUgaXQgdmlhIHRoZSBXaS1GaSBtZW51IGJhciAoQ29udGludWl0eSksIHRoZW4gcmUtcnVuLiBuZXR3b3Jrc2V0dXAgY2FuJ3QgdHJpZ2dlciBDb250aW51aXR5LmAsXG4gICAgICApO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgJHtzc2lkfSBub3QgaW4gcmFuZ2Ugb3IgdW5yZWFjaGFibGUgKHJhdzogJHtzdGRvdXQudHJpbSgpIHx8IHN0ZGVyci50cmltKCkgfHwgXCJubyBvdXRwdXRcIn0pYCxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogSGV1cmlzdGljOiBpcyB0aGlzIFNTSUQgbGlrZWx5IGFuIGlQaG9uZS9pUGFkIFBlcnNvbmFsIEhvdHNwb3Qgcm91dGVkXG4gKiB0aHJvdWdoIENvbnRpbnVpdHk/IFRoZXNlIG5lZWQgbWFudWFsIGFjdGl2YXRpb24gdmlhIHRoZSBXaS1GaSBtZW51IFx1MjAxNFxuICogbm8gQ0xJIHRvb2wgY2FuIHRyaWdnZXIgdGhlbS5cbiAqXG4gKiBQYXR0ZXJuOiBtYWNPUyBkZWZhdWx0cyBQZXJzb25hbCBIb3RzcG90IFNTSUQgdG8gdGhlIGRldmljZSBuYW1lLCB3aGljaFxuICogYnkgZGVmYXVsdCBpcyBcIjxGaXJzdCBuYW1lPidzIGlQaG9uZVwiIG9yIFwiPEZpcnN0IG5hbWU+J3MgaVBhZFwiLiBVc2Vyc1xuICogY2FuIHJlbmFtZSB0aGVpciBkZXZpY2VzLCBidXQgdGhlIGlQaG9uZS9pUGFkIGtleXdvcmQgdXN1YWxseSBzdXJ2aXZlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1xcYihpcGhvbmV8aXBhZClcXGIvaS50ZXN0KHNzaWQpO1xufVxuXG4vKipcbiAqIFBvbGwgaWZjb25maWcgdW50aWwgdGhlIGRldmljZSBpcyB1cCB3aXRoIGFuIGluZXQgYWRkcmVzcywgb3IgdGltZW91dC5cbiAqIElmIGV4cGVjdGVkU1NJRCBpcyBwcm92aWRlZCBhbmQgd2UgY2FuIHJlYWQgU1NJRHMsIGFsc28gd2FpdCB1bnRpbCBpdCBtYXRjaGVzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvcldpZmlSZWFkeShcbiAgZGV2aWNlOiBzdHJpbmcsXG4gIGV4cGVjdGVkU1NJRDogc3RyaW5nIHwgbnVsbCxcbiAgdGltZW91dE1zID0gMjBfMDAwLFxuICBzaWduYWw/OiBBYm9ydFNpZ25hbCxcbik6IFByb21pc2U8eyBhY3RpdmU6IGJvb2xlYW47IHNzaWQ6IHN0cmluZyB8IG51bGwgfT4ge1xuICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQgPCB0aW1lb3V0TXMpIHtcbiAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSByZXR1cm4geyBhY3RpdmU6IGZhbHNlLCBzc2lkOiBudWxsIH07XG4gICAgY29uc3QgW2FjdGl2ZV0gPSBhd2FpdCByZWFkSWZjb25maWcoZGV2aWNlKTtcbiAgICBpZiAoYWN0aXZlKSB7XG4gICAgICBjb25zdCBzc2lkID0gYXdhaXQgcmVhZFNTSUQoZGV2aWNlKTtcbiAgICAgIC8vIElmIHdlIGNhbid0IHJlYWQgU1NJRCBhdCBhbGwgKG5vIExvY2F0aW9uIHBlcm1zKSwgdHJ1c3QgdGhlIHN3aXRjaC5cbiAgICAgIC8vIE90aGVyd2lzZSByZXF1aXJlIGl0IHRvIG1hdGNoIHdoYXQgd2UgYXNrZWQgZm9yLlxuICAgICAgaWYgKGV4cGVjdGVkU1NJRCA9PT0gbnVsbCB8fCBzc2lkID09PSBudWxsIHx8IHNzaWQgPT09IGV4cGVjdGVkU1NJRCkge1xuICAgICAgICByZXR1cm4geyBhY3RpdmU6IHRydWUsIHNzaWQgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXdhaXQgc2xlZXAoNTAwLCBzaWduYWwpO1xuICB9XG4gIHJldHVybiB7IGFjdGl2ZTogZmFsc2UsIHNzaWQ6IG51bGwgfTtcbn1cblxuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlciwgc2lnbmFsPzogQWJvcnRTaWduYWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3QgdCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgIFwiYWJvcnRcIixcbiAgICAgICgpID0+IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHQpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9LFxuICAgICAgeyBvbmNlOiB0cnVlIH0sXG4gICAgKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5VHlwZShoYXJkd2FyZVBvcnQ6IHN0cmluZyk6IEludGVyZmFjZVR5cGUge1xuICBjb25zdCBwID0gaGFyZHdhcmVQb3J0LnRvTG93ZXJDYXNlKCk7XG4gIGlmIChwLmluY2x1ZGVzKFwid2ktZmlcIikgfHwgcC5pbmNsdWRlcyhcImFpcnBvcnRcIikpIHJldHVybiBcIndpZmlcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJ0aHVuZGVyYm9sdFwiKSB8fCBwLmluY2x1ZGVzKFwiYnJpZGdlXCIpKSByZXR1cm4gXCJ0aHVuZGVyYm9sdFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImlwaG9uZVwiKSB8fCBwLmluY2x1ZGVzKFwiaXBhZFwiKSkgcmV0dXJuIFwidXNiXCI7XG4gIGlmIChwLmluY2x1ZGVzKFwidXNiXCIpKSByZXR1cm4gXCJ1c2JcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJibHVldG9vdGhcIikpIHJldHVybiBcImJsdWV0b290aFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImV0aGVybmV0XCIpIHx8IHAuaW5jbHVkZXMoXCJsYW5cIikpIHJldHVybiBcImV0aGVybmV0XCI7XG4gIHJldHVybiBcIm90aGVyXCI7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVJbnRlcmZhY2VzKGE6IE5ldHdvcmtJbnRlcmZhY2UsIGI6IE5ldHdvcmtJbnRlcmZhY2UpOiBudW1iZXIge1xuICBpZiAoYS5hY3RpdmUgIT09IGIuYWN0aXZlKSByZXR1cm4gYS5hY3RpdmUgPyAtMSA6IDE7XG4gIGlmIChhLmlzRGVmYXVsdCAhPT0gYi5pc0RlZmF1bHQpIHJldHVybiBhLmlzRGVmYXVsdCA/IC0xIDogMTtcbiAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59XG4iLCAiaW1wb3J0IHsgQ2FjaGUgfSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgdHlwZSB7IE5ldHdvcmtJbnRlcmZhY2UsIE5ldHdvcmtUZXN0UmVzdWx0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IENBQ0hFX0tFWSA9IFwibGFzdFJlc3VsdFwiO1xuXG5pbnRlcmZhY2UgQ2FjaGVkU2hhcGUge1xuICByZXN1bHQ6IE5ldHdvcmtUZXN0UmVzdWx0O1xuICBpbnRlcmZhY2U6IE5ldHdvcmtJbnRlcmZhY2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzdWx0U3RvcmUge1xuICByZWFkKCk6IENhY2hlZFNoYXBlIHwgbnVsbDtcbiAgd3JpdGUocGF5bG9hZDogQ2FjaGVkU2hhcGUpOiB2b2lkO1xuICBjbGVhcigpOiB2b2lkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVzdWx0Q2FjaGUoKTogUmVzdWx0U3RvcmUge1xuICBjb25zdCBjYWNoZSA9IG5ldyBDYWNoZSh7IG5hbWVzcGFjZTogXCJuZXR3b3JrLXRlc3RcIiB9KTtcblxuICByZXR1cm4ge1xuICAgIHJlYWQoKSB7XG4gICAgICBjb25zdCByYXcgPSBjYWNoZS5nZXQoQ0FDSEVfS0VZKTtcbiAgICAgIGlmICghcmF3KSByZXR1cm4gbnVsbDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHJhdykgYXMgQ2FjaGVkU2hhcGU7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgY2FjaGUucmVtb3ZlKENBQ0hFX0tFWSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sXG4gICAgd3JpdGUocGF5bG9hZCkge1xuICAgICAgY2FjaGUuc2V0KENBQ0hFX0tFWSwgSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xuICAgIH0sXG4gICAgY2xlYXIoKSB7XG4gICAgICBjYWNoZS5yZW1vdmUoQ0FDSEVfS0VZKTtcbiAgICB9LFxuICB9O1xufVxuIiwgImltcG9ydCB7IGVudmlyb25tZW50IH0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHR5cGUgeyBIaXN0b3J5RW50cnkgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuY29uc3QgSElTVE9SWV9GSUxFTkFNRSA9IFwiaGlzdG9yeS5qc29ubFwiO1xuXG4vKipcbiAqIEFwcGVuZC1vbmx5IEpTT05MIGhpc3RvcnkuIFdlIHVzZSBhIGZpbGUgKG5vdCBMb2NhbFN0b3JhZ2UpIGJlY2F1c2U6XG4gKiAtIFVzZXIgY2FuIGluc3BlY3QgLyBncmVwIC8gYmFjayB1cCB0aGUgbG9nXG4gKiAtIEl0IGdyb3dzIGxpbmVhcmx5IGFuZCB3ZSBuZXZlciBuZWVkIHRvIHJlYWQgaXQgYWxsIHRvIHdyaXRlXG4gKiAtIFwiU2hvdyBpbiBGaW5kZXJcIiBpcyBhIHJlYWwsIHVzZWZ1bCBhZmZvcmRhbmNlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSGlzdG9yeVN0b3JlIHtcbiAgYXBwZW5kKGVudHJ5OiBIaXN0b3J5RW50cnkpOiBQcm9taXNlPHZvaWQ+O1xuICByZWFkQWxsKCk6IFByb21pc2U8SGlzdG9yeUVudHJ5W10+O1xuICBjbGVhcigpOiBQcm9taXNlPHZvaWQ+O1xuICBmaWxlUGF0aCgpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIaXN0b3J5U3RvcmUoKTogSGlzdG9yeVN0b3JlIHtcbiAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4oZW52aXJvbm1lbnQuc3VwcG9ydFBhdGgsIEhJU1RPUllfRklMRU5BTUUpO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgYXBwZW5kKGVudHJ5KSB7XG4gICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmRpcm5hbWUoZmlsZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIGF3YWl0IGZzLmFwcGVuZEZpbGUoZmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KGVudHJ5KSArIFwiXFxuXCIsIFwidXRmOFwiKTtcbiAgICB9LFxuXG4gICAgYXN5bmMgcmVhZEFsbCgpIHtcbiAgICAgIGxldCBjb250ZW50czogc3RyaW5nO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29udGVudHMgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgXCJ1dGY4XCIpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmICgoZXJyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSA9PT0gXCJFTk9FTlRcIikgcmV0dXJuIFtdO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgICBjb25zdCBlbnRyaWVzOiBIaXN0b3J5RW50cnlbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGNvbnRlbnRzLnNwbGl0KFwiXFxuXCIpKSB7XG4gICAgICAgIGlmICghbGluZS50cmltKCkpIGNvbnRpbnVlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGVudHJpZXMucHVzaChKU09OLnBhcnNlKGxpbmUpIGFzIEhpc3RvcnlFbnRyeSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIHNraXAgbWFsZm9ybWVkIGxpbmVzIHJhdGhlciB0aGFuIGZhaWwgdGhlIHdob2xlIGxvYWRcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGVudHJpZXMuc29ydCgoYSwgYikgPT4gYi5maW5pc2hlZEF0IC0gYS5maW5pc2hlZEF0KTtcbiAgICB9LFxuXG4gICAgYXN5bmMgY2xlYXIoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBmcy51bmxpbmsoZmlsZVBhdGgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmICgoZXJyIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSAhPT0gXCJFTk9FTlRcIikgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBmaWxlUGF0aCgpIHtcbiAgICAgIHJldHVybiBmaWxlUGF0aDtcbiAgICB9LFxuICB9O1xufVxuIiwgImltcG9ydCB7IExvY2FsU3RvcmFnZSB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgVGVzdE1vZGUgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuY29uc3QgS0VZX1BSRUZJWCA9IFwiZHVyYXRpb246XCI7XG5jb25zdCBTQU1QTEVfTElNSVQgPSAxMDtcblxuLyoqXG4gKiBIYXJkLWNvZGVkIGZhbGxiYWNrIGVzdGltYXRlcyBwZXIgbW9kZSwgdXNlZCB1bnRpbCB3ZSBoYXZlIGFueSBzYW1wbGVzLlxuICogQ2FsaWJyYXRlZCBmcm9tIG9ic2VydmVkIHJ1bnMgb24gdHlwaWNhbCBob21lIC8gaG90c3BvdCBjb25uZWN0aW9ucy5cbiAqL1xuZXhwb3J0IGNvbnN0IEZBTExCQUNLX0VTVElNQVRFX01TOiBSZWNvcmQ8VGVzdE1vZGUsIG51bWJlcj4gPSB7XG4gIHBhcmFsbGVsOiAzMF8wMDAsXG4gIHNlcXVlbnRpYWw6IDU1XzAwMCxcbiAgZG93bmxvYWQ6IDE4XzAwMCxcbiAgdXBsb2FkOiAxOF8wMDAsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIER1cmF0aW9uU3RhdHMge1xuICAvKiogUmV0dXJucyB0aGUgYmVzdCBlc3RpbWF0ZSBmb3IgbmV4dC1ydW4gZHVyYXRpb24gaW4gbXMuICovXG4gIGVzdGltYXRlKG1vZGU6IFRlc3RNb2RlLCBpbnRlcmZhY2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj47XG4gIC8qKiBSZWNvcmQgYSBjb21wbGV0ZWQgcnVuJ3MgZHVyYXRpb24uICovXG4gIHJlY29yZChcbiAgICBtb2RlOiBUZXN0TW9kZSxcbiAgICBpbnRlcmZhY2VOYW1lOiBzdHJpbmcsXG4gICAgZHVyYXRpb25NczogbnVtYmVyLFxuICApOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRHVyYXRpb25TdGF0cygpOiBEdXJhdGlvblN0YXRzIHtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyBlc3RpbWF0ZShtb2RlLCBpbnRlcmZhY2VOYW1lKSB7XG4gICAgICBjb25zdCBzYW1wbGVzID0gYXdhaXQgbG9hZFNhbXBsZXMobW9kZSwgaW50ZXJmYWNlTmFtZSk7XG4gICAgICBpZiAoc2FtcGxlcy5sZW5ndGggPT09IDApIHJldHVybiBGQUxMQkFDS19FU1RJTUFURV9NU1ttb2RlXTtcbiAgICAgIHJldHVybiBtZWRpYW4oc2FtcGxlcyk7XG4gICAgfSxcblxuICAgIGFzeW5jIHJlY29yZChtb2RlLCBpbnRlcmZhY2VOYW1lLCBkdXJhdGlvbk1zKSB7XG4gICAgICBjb25zdCBzYW1wbGVzID0gYXdhaXQgbG9hZFNhbXBsZXMobW9kZSwgaW50ZXJmYWNlTmFtZSk7XG4gICAgICBzYW1wbGVzLnB1c2goZHVyYXRpb25Ncyk7XG4gICAgICBjb25zdCB0cmltbWVkID0gc2FtcGxlcy5zbGljZSgtU0FNUExFX0xJTUlUKTtcbiAgICAgIGF3YWl0IExvY2FsU3RvcmFnZS5zZXRJdGVtKFxuICAgICAgICBrZXlGb3IobW9kZSwgaW50ZXJmYWNlTmFtZSksXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHRyaW1tZWQpLFxuICAgICAgKTtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBrZXlGb3IobW9kZTogVGVzdE1vZGUsIGludGVyZmFjZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtLRVlfUFJFRklYfSR7bW9kZX06JHtpbnRlcmZhY2VOYW1lfWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRTYW1wbGVzKFxuICBtb2RlOiBUZXN0TW9kZSxcbiAgaW50ZXJmYWNlTmFtZTogc3RyaW5nLFxuKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICBjb25zdCByYXcgPSBhd2FpdCBMb2NhbFN0b3JhZ2UuZ2V0SXRlbTxzdHJpbmc+KGtleUZvcihtb2RlLCBpbnRlcmZhY2VOYW1lKSk7XG4gIGlmICghcmF3KSByZXR1cm4gW107XG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShyYXcpO1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZClcbiAgICAgID8gcGFyc2VkLmZpbHRlcigobjogdW5rbm93bik6IG4gaXMgbnVtYmVyID0+IHR5cGVvZiBuID09PSBcIm51bWJlclwiKVxuICAgICAgOiBbXTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1lZGlhbih2YWx1ZXM6IG51bWJlcltdKTogbnVtYmVyIHtcbiAgY29uc3Qgc29ydGVkID0gWy4uLnZhbHVlc10uc29ydCgoYSwgYikgPT4gYSAtIGIpO1xuICBjb25zdCBtaWQgPSBNYXRoLmZsb29yKHNvcnRlZC5sZW5ndGggLyAyKTtcbiAgcmV0dXJuIHNvcnRlZC5sZW5ndGggJSAyID09PSAwXG4gICAgPyAoc29ydGVkW21pZCAtIDFdICsgc29ydGVkW21pZF0pIC8gMlxuICAgIDogc29ydGVkW21pZF07XG59XG4iLCAiaW1wb3J0IHtcbiAgQWN0aW9uLFxuICBBY3Rpb25QYW5lbCxcbiAgQ29sb3IsXG4gIERldGFpbCxcbiAgSWNvbixcbiAgbGF1bmNoQ29tbWFuZCxcbiAgTGF1bmNoVHlwZSxcbn0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHR5cGUge1xuICBOZXR3b3JrSW50ZXJmYWNlLFxuICBOZXR3b3JrVGVzdFJlc3VsdCxcbiAgUmVzcG9uc2l2ZW5lc3NUaWVyLFxuICBTcGVlZFRpZXIsXG4gIFRlc3RNb2RlLFxuICBUZXN0UHJvZ3Jlc3MsXG4gIFRlc3RTdGF0dXMsXG59IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHtcbiAgZm9ybWF0RWxhcHNlZCxcbiAgZm9ybWF0TGF0ZW5jeSxcbiAgZm9ybWF0UmVsYXRpdmVUaW1lLFxuICBmb3JtYXRSZXNwb25zaXZlbmVzcyxcbiAgZm9ybWF0VGhyb3VnaHB1dCxcbiAgbW9kZUxhYmVsLFxuICByZW5kZXJQcm9ncmVzc0Jhcixcbn0gZnJvbSBcIi4uL2xpYi9mb3JtYXRcIjtcbmltcG9ydCB7XG4gIGNsYXNzaWZ5U3BlZWQsXG4gIGRvd25sb2FkQ29udGV4dCxcbiAgcmVuZGVyTG9nTWV0ZXIsXG4gIHNwZWVkVGllckxhYmVsLFxuICB1cGxvYWRDb250ZXh0LFxufSBmcm9tIFwiLi4vbGliL3NwZWVkXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVN1bW1hcnkgfSBmcm9tIFwiLi4vbGliL3N1bW1hcnlcIjtcbmltcG9ydCB7IGRpc3BsYXlOYW1lLCBpc1NTSURQZXJtaXNzaW9uTWlzc2luZyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9pbnRlcmZhY2VzXCI7XG5pbXBvcnQgeyBOZXR3b3JrQ29udGV4dE1ldGFkYXRhIH0gZnJvbSBcIi4vTmV0d29ya0JhZGdlXCI7XG5pbXBvcnQgeyBSdW5UZXN0QWN0aW9ucyB9IGZyb20gXCIuL1J1blRlc3RBY3Rpb25zXCI7XG5cbmludGVyZmFjZSBSZXN1bHREZXRhaWxQcm9wcyB7XG4gIHJlc3VsdDogTmV0d29ya1Rlc3RSZXN1bHQ7XG4gIGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbDtcbiAgaXNTdGFsZTogYm9vbGVhbjtcbiAgc3RhdHVzOiBUZXN0U3RhdHVzO1xuICBwcm9ncmVzczogVGVzdFByb2dyZXNzIHwgbnVsbDtcbiAgcnVubmluZ01vZGU6IFRlc3RNb2RlIHwgbnVsbDtcbiAgZGVmYXVsdE1vZGU6IFRlc3RNb2RlO1xuICBvblJlcnVuOiAobW9kZTogVGVzdE1vZGUsIGlmYWNlPzogTmV0d29ya0ludGVyZmFjZSkgPT4gdm9pZDtcbiAgb25DYW5jZWw6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBSZXN1bHREZXRhaWwoe1xuICByZXN1bHQsXG4gIGlmYWNlLFxuICBpc1N0YWxlLFxuICBzdGF0dXMsXG4gIHByb2dyZXNzLFxuICBydW5uaW5nTW9kZSxcbiAgZGVmYXVsdE1vZGUsXG4gIG9uUmVydW4sXG4gIG9uQ2FuY2VsLFxufTogUmVzdWx0RGV0YWlsUHJvcHMpIHtcbiAgY29uc3QgaXNSdW5uaW5nID0gc3RhdHVzID09PSBcInJ1bm5pbmdcIjtcblxuICByZXR1cm4gKFxuICAgIDxEZXRhaWxcbiAgICAgIGlzTG9hZGluZz17aXNSdW5uaW5nfVxuICAgICAgbWFya2Rvd249e3JlbmRlck1hcmtkb3duKFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIGlmYWNlLFxuICAgICAgICBpc1N0YWxlLFxuICAgICAgICBpc1J1bm5pbmcsXG4gICAgICAgIHByb2dyZXNzLFxuICAgICAgICBydW5uaW5nTW9kZSxcbiAgICAgICl9XG4gICAgICBtZXRhZGF0YT17cmVuZGVyTWV0YWRhdGEocmVzdWx0LCBpZmFjZSwgaXNSdW5uaW5nLCBwcm9ncmVzcyl9XG4gICAgICBhY3Rpb25zPXtcbiAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgIDxSdW5UZXN0QWN0aW9uc1xuICAgICAgICAgICAgc3RhdHVzPXtzdGF0dXN9XG4gICAgICAgICAgICBkZWZhdWx0TW9kZT17ZGVmYXVsdE1vZGV9XG4gICAgICAgICAgICBjdXJyZW50SW50ZXJmYWNlPXtpZmFjZX1cbiAgICAgICAgICAgIG9uUnVuPXtvblJlcnVufVxuICAgICAgICAgICAgb25DYW5jZWw9e29uQ2FuY2VsfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEFjdGlvbi5Db3B5VG9DbGlwYm9hcmRcbiAgICAgICAgICAgIHRpdGxlPVwiQ29weSBTdW1tYXJ5XCJcbiAgICAgICAgICAgIGNvbnRlbnQ9e3JlbmRlckNsaXBib2FyZFN1bW1hcnkocmVzdWx0LCBpZmFjZSl9XG4gICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcImNcIiB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgdGl0bGU9XCJPcGVuIEhpc3RvcnlcIlxuICAgICAgICAgICAgaWNvbj17SWNvbi5MaXN0fVxuICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIl0sIGtleTogXCJoXCIgfX1cbiAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICBsYXVuY2hDb21tYW5kKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcIm5ldHdvcmstaGlzdG9yeVwiLFxuICAgICAgICAgICAgICAgIHR5cGU6IExhdW5jaFR5cGUuVXNlckluaXRpYXRlZCxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgIHRpdGxlPVwiQ29tcGFyZSBOZXR3b3Jrc1wiXG4gICAgICAgICAgICBpY29uPXtJY29uLlR3b1Blb3BsZX1cbiAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCIsIFwic2hpZnRcIl0sIGtleTogXCJjXCIgfX1cbiAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICBsYXVuY2hDb21tYW5kKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImNvbXBhcmUtbmV0d29ya3NcIixcbiAgICAgICAgICAgICAgICB0eXBlOiBMYXVuY2hUeXBlLlVzZXJJbml0aWF0ZWQsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9BY3Rpb25QYW5lbD5cbiAgICAgIH1cbiAgICAvPlxuICApO1xufVxuXG5mdW5jdGlvbiByZW5kZXJNYXJrZG93bihcbiAgcmVzdWx0OiBOZXR3b3JrVGVzdFJlc3VsdCxcbiAgaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsLFxuICBpc1N0YWxlOiBib29sZWFuLFxuICBpc1J1bm5pbmc6IGJvb2xlYW4sXG4gIHByb2dyZXNzOiBUZXN0UHJvZ3Jlc3MgfCBudWxsLFxuICBydW5uaW5nTW9kZTogVGVzdE1vZGUgfCBudWxsLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKGlzUnVubmluZyAmJiBwcm9ncmVzcykge1xuICAgIGxpbmVzLnB1c2goLi4ucmVuZGVyUmVmcmVzaEhlYWRlcihwcm9ncmVzcywgcnVubmluZ01vZGUpKTtcbiAgICBsaW5lcy5wdXNoKFwiLS0tXCIpO1xuICAgIGxpbmVzLnB1c2goXCJcIik7XG4gICAgbGluZXMucHVzaChcbiAgICAgIGAjIyMgUHJldmlvdXMgcmVzdWx0IFx1MDBCNyAke2lzU3RhbGUgPyBmb3JtYXRSZWxhdGl2ZVRpbWUocmVzdWx0LmZpbmlzaGVkQXQpIDogXCJqdXN0IG5vd1wifWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9IGVsc2UgaWYgKGlmYWNlKSB7XG4gICAgbGluZXMucHVzaChgKioke2Rpc3BsYXlOYW1lKGlmYWNlKX0qKmApO1xuICAgIGxpbmVzLnB1c2goXCJcIik7XG4gIH1cblxuICBpZiAoaXNSdW5uaW5nICYmIGlmYWNlKSB7XG4gICAgbGluZXMucHVzaChgKiR7ZGlzcGxheU5hbWUoaWZhY2UpfSpgKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG5cbiAgbGluZXMucHVzaChgPiAke2dlbmVyYXRlU3VtbWFyeShyZXN1bHQpfWApO1xuICBsaW5lcy5wdXNoKFwiXCIpO1xuXG4gIGlmIChpZmFjZSAmJiBpc1NTSURQZXJtaXNzaW9uTWlzc2luZyhpZmFjZSkpIHtcbiAgICBsaW5lcy5wdXNoKFxuICAgICAgXCIqTmV0d29yayBuYW1lIGhpZGRlbiBcdTIwMTQgZ3JhbnQgUmF5Y2FzdCBhY2Nlc3MgaW4gU3lzdGVtIFNldHRpbmdzIFx1MjE5MiBQcml2YWN5ICYgU2VjdXJpdHkgXHUyMTkyIExvY2F0aW9uIFNlcnZpY2VzIHRvIHNlZSB0aGUgU1NJRC4qXCIsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG5cbiAgaWYgKHJlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbCkge1xuICAgIGxpbmVzLnB1c2goXG4gICAgICAuLi5yZW5kZXJEaXJlY3Rpb24oXCJcdTIxOTMgRG93bmxvYWRcIiwgcmVzdWx0LmRvd25sb2FkQnBzLCBcImRvd25sb2FkXCIpLFxuICAgICk7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuICBpZiAocmVzdWx0LnVwbG9hZEJwcyAhPT0gbnVsbCkge1xuICAgIGxpbmVzLnB1c2goLi4ucmVuZGVyRGlyZWN0aW9uKFwiXHUyMTkxIFVwbG9hZFwiLCByZXN1bHQudXBsb2FkQnBzLCBcInVwbG9hZFwiKSk7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuXG4gIGxpbmVzLnB1c2goXG4gICAgYCoqTGF0ZW5jeSoqICAke2Zvcm1hdExhdGVuY3kocmVzdWx0LmJhc2VSdHRNcyl9YCArXG4gICAgICAocmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtICE9PSBudWxsXG4gICAgICAgID8gYCAgXHUwMEI3ICAqKlJlc3BvbnNpdmVuZXNzKiogICR7Zm9ybWF0UmVzcG9uc2l2ZW5lc3MocmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtLCByZXN1bHQucmVzcG9uc2l2ZW5lc3NUaWVyKX1gXG4gICAgICAgIDogXCJcIiksXG4gICk7XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclJlZnJlc2hIZWFkZXIoXG4gIHByb2dyZXNzOiBUZXN0UHJvZ3Jlc3MsXG4gIHJ1bm5pbmdNb2RlOiBUZXN0TW9kZSB8IG51bGwsXG4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGJhciA9IHJlbmRlclByb2dyZXNzQmFyKHByb2dyZXNzLmZyYWN0aW9uKTtcbiAgY29uc3QgcGN0ID0gTWF0aC5yb3VuZChwcm9ncmVzcy5mcmFjdGlvbiAqIDEwMCk7XG4gIGNvbnN0IGVsYXBzZWRGcmFnbWVudCA9IHByb2dyZXNzLm92ZXJydW5cbiAgICA/IGAke2Zvcm1hdEVsYXBzZWQocHJvZ3Jlc3MuZWxhcHNlZE1zKX0gXHUwMEI3IHRha2luZyBsb25nZXIgdGhhbiB1c3VhbGBcbiAgICA6IGAke2Zvcm1hdEVsYXBzZWQocHJvZ3Jlc3MuZWxhcHNlZE1zKX0gLyB+JHtNYXRoLnJvdW5kKHByb2dyZXNzLmVzdGltYXRlZFRvdGFsTXMgLyAxMDAwKX1zYDtcbiAgY29uc3QgbW9kZUZyYWdtZW50ID0gcnVubmluZ01vZGUgPyBgIFx1MDBCNyAke21vZGVMYWJlbChydW5uaW5nTW9kZSl9YCA6IFwiXCI7XG4gIHJldHVybiBbXG4gICAgYCMjIFJ1bm5pbmcgbmV3IHRlc3Qke21vZGVGcmFnbWVudH1gLFxuICAgIFwiXCIsXG4gICAgXCJgYGBcIixcbiAgICBgJHtiYXJ9ICAke3BjdH0lICAgJHtlbGFwc2VkRnJhZ21lbnR9YCxcbiAgICBcImBgYFwiLFxuICAgIFwiXCIsXG4gIF07XG59XG5cbmZ1bmN0aW9uIHJlbmRlckRpcmVjdGlvbihcbiAgaGVhZGluZzogc3RyaW5nLFxuICBicHM6IG51bWJlcixcbiAgZGlyZWN0aW9uOiBcImRvd25sb2FkXCIgfCBcInVwbG9hZFwiLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCB0aWVyID0gY2xhc3NpZnlTcGVlZChicHMpO1xuICBjb25zdCBjb250ZXh0ID1cbiAgICBkaXJlY3Rpb24gPT09IFwiZG93bmxvYWRcIiA/IGRvd25sb2FkQ29udGV4dCh0aWVyKSA6IHVwbG9hZENvbnRleHQodGllcik7XG4gIHJldHVybiBbXG4gICAgYCMjIyAke2hlYWRpbmd9ICAke2Zvcm1hdFRocm91Z2hwdXQoYnBzKX0gIFx1MDBCNyAgJHtzcGVlZFRpZXJMYWJlbCh0aWVyKX0gXHUyMDE0ICR7Y29udGV4dH1gLFxuICAgIFwiYGBgXCIsXG4gICAgcmVuZGVyTG9nTWV0ZXIoYnBzKSxcbiAgICBcImBgYFwiLFxuICBdO1xufVxuXG5mdW5jdGlvbiByZW5kZXJNZXRhZGF0YShcbiAgcmVzdWx0OiBOZXR3b3JrVGVzdFJlc3VsdCxcbiAgaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsLFxuICBpc1J1bm5pbmc6IGJvb2xlYW4sXG4gIHByb2dyZXNzOiBUZXN0UHJvZ3Jlc3MgfCBudWxsLFxuKSB7XG4gIHJldHVybiAoXG4gICAgPERldGFpbC5NZXRhZGF0YT5cbiAgICAgIHtpc1J1bm5pbmcgJiYgcHJvZ3Jlc3MgJiYgKFxuICAgICAgICA8PlxuICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICAgIHRpdGxlPVwiU3RhdHVzXCJcbiAgICAgICAgICAgIHRleHQ9e1xuICAgICAgICAgICAgICBwcm9ncmVzcy5vdmVycnVuXG4gICAgICAgICAgICAgICAgPyBgT3ZlcnJ1biBcdTAwQjcgJHtmb3JtYXRFbGFwc2VkKHByb2dyZXNzLmVsYXBzZWRNcyl9YFxuICAgICAgICAgICAgICAgIDogYCR7TWF0aC5yb3VuZChwcm9ncmVzcy5mcmFjdGlvbiAqIDEwMCl9JSBcdTAwQjcgJHtmb3JtYXRFbGFwc2VkKHByb2dyZXNzLmVsYXBzZWRNcyl9YFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWNvbj17eyBzb3VyY2U6IEljb24uQ2lyY2xlUHJvZ3Jlc3MsIHRpbnRDb2xvcjogQ29sb3IuQmx1ZSB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5TZXBhcmF0b3IgLz5cbiAgICAgICAgPC8+XG4gICAgICApfVxuICAgICAge3Jlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbCAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuVGFnTGlzdCB0aXRsZT1cIkRvd25sb2FkXCI+XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgIHRleHQ9e2Ake2Zvcm1hdFRocm91Z2hwdXQocmVzdWx0LmRvd25sb2FkQnBzKX0gXHUwMEI3ICR7c3BlZWRUaWVyTGFiZWwoY2xhc3NpZnlTcGVlZChyZXN1bHQuZG93bmxvYWRCcHMpKX1gfVxuICAgICAgICAgICAgY29sb3I9e3NwZWVkVGllckNvbG9yKGNsYXNzaWZ5U3BlZWQocmVzdWx0LmRvd25sb2FkQnBzKSl9XG4gICAgICAgICAgICBpY29uPXtJY29uLkFycm93RG93bn1cbiAgICAgICAgICAvPlxuICAgICAgICA8L0RldGFpbC5NZXRhZGF0YS5UYWdMaXN0PlxuICAgICAgKX1cbiAgICAgIHtyZXN1bHQudXBsb2FkQnBzICE9PSBudWxsICYmIChcbiAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0IHRpdGxlPVwiVXBsb2FkXCI+XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgIHRleHQ9e2Ake2Zvcm1hdFRocm91Z2hwdXQocmVzdWx0LnVwbG9hZEJwcyl9IFx1MDBCNyAke3NwZWVkVGllckxhYmVsKGNsYXNzaWZ5U3BlZWQocmVzdWx0LnVwbG9hZEJwcykpfWB9XG4gICAgICAgICAgICBjb2xvcj17c3BlZWRUaWVyQ29sb3IoY2xhc3NpZnlTcGVlZChyZXN1bHQudXBsb2FkQnBzKSl9XG4gICAgICAgICAgICBpY29uPXtJY29uLkFycm93VXB9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9EZXRhaWwuTWV0YWRhdGEuVGFnTGlzdD5cbiAgICAgICl9XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgIHRpdGxlPVwiTGF0ZW5jeVwiXG4gICAgICAgIHRleHQ9e2Zvcm1hdExhdGVuY3kocmVzdWx0LmJhc2VSdHRNcyl9XG4gICAgICAgIGljb249e0ljb24uR2F1Z2V9XG4gICAgICAvPlxuICAgICAge3Jlc3VsdC5yZXNwb25zaXZlbmVzc1JwbSAhPT0gbnVsbCAmJlxuICAgICAgICByZXN1bHQucmVzcG9uc2l2ZW5lc3NUaWVyICE9PSBudWxsICYmIChcbiAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3QgdGl0bGU9XCJSZXNwb25zaXZlbmVzc1wiPlxuICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgdGV4dD17Zm9ybWF0UmVzcG9uc2l2ZW5lc3MoXG4gICAgICAgICAgICAgICAgcmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtLFxuICAgICAgICAgICAgICAgIHJlc3VsdC5yZXNwb25zaXZlbmVzc1RpZXIsXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIGNvbG9yPXt0aWVyQ29sb3IocmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllcil9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3Q+XG4gICAgICAgICl9XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLlNlcGFyYXRvciAvPlxuICAgICAge2lmYWNlICYmIDxOZXR3b3JrQ29udGV4dE1ldGFkYXRhIGlmYWNlPXtpZmFjZX0gLz59XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsIHRpdGxlPVwiTW9kZVwiIHRleHQ9e21vZGVMYWJlbChyZXN1bHQubW9kZSl9IC8+XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsIHRpdGxlPVwiRW5kcG9pbnRcIiB0ZXh0PXtyZXN1bHQudGVzdEVuZHBvaW50fSAvPlxuICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbFxuICAgICAgICB0aXRsZT1cIk1lYXN1cmVkXCJcbiAgICAgICAgdGV4dD17Zm9ybWF0UmVsYXRpdmVUaW1lKHJlc3VsdC5maW5pc2hlZEF0KX1cbiAgICAgIC8+XG4gICAgPC9EZXRhaWwuTWV0YWRhdGE+XG4gICk7XG59XG5cbmZ1bmN0aW9uIHRpZXJDb2xvcih0aWVyOiBSZXNwb25zaXZlbmVzc1RpZXIpOiBDb2xvciB7XG4gIHN3aXRjaCAodGllcikge1xuICAgIGNhc2UgXCJoaWdoXCI6XG4gICAgICByZXR1cm4gQ29sb3IuR3JlZW47XG4gICAgY2FzZSBcIm1lZGl1bVwiOlxuICAgICAgcmV0dXJuIENvbG9yLlllbGxvdztcbiAgICBjYXNlIFwibG93XCI6XG4gICAgICByZXR1cm4gQ29sb3IuUmVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNwZWVkVGllckNvbG9yKHRpZXI6IFNwZWVkVGllcik6IENvbG9yIHtcbiAgc3dpdGNoICh0aWVyKSB7XG4gICAgY2FzZSBcInBvb3JcIjpcbiAgICAgIHJldHVybiBDb2xvci5SZWQ7XG4gICAgY2FzZSBcIm9rXCI6XG4gICAgICByZXR1cm4gQ29sb3IuT3JhbmdlO1xuICAgIGNhc2UgXCJnb29kXCI6XG4gICAgICByZXR1cm4gQ29sb3IuWWVsbG93O1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgcmV0dXJuIENvbG9yLkdyZWVuO1xuICAgIGNhc2UgXCJleGNlbGxlbnRcIjpcbiAgICAgIHJldHVybiBDb2xvci5CbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNsaXBib2FyZFN1bW1hcnkoXG4gIHJlc3VsdDogTmV0d29ya1Rlc3RSZXN1bHQsXG4gIGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbCxcbik6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAoaWZhY2UpIHBhcnRzLnB1c2goYE5ldHdvcms6ICR7ZGlzcGxheU5hbWUoaWZhY2UpfSAoJHtpZmFjZS5uYW1lfSlgKTtcbiAgaWYgKHJlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbClcbiAgICBwYXJ0cy5wdXNoKGBEb3dubG9hZDogJHtmb3JtYXRUaHJvdWdocHV0KHJlc3VsdC5kb3dubG9hZEJwcyl9YCk7XG4gIGlmIChyZXN1bHQudXBsb2FkQnBzICE9PSBudWxsKVxuICAgIHBhcnRzLnB1c2goYFVwbG9hZDogJHtmb3JtYXRUaHJvdWdocHV0KHJlc3VsdC51cGxvYWRCcHMpfWApO1xuICBpZiAocmVzdWx0LmJhc2VSdHRNcyAhPT0gbnVsbClcbiAgICBwYXJ0cy5wdXNoKGBMYXRlbmN5OiAke2Zvcm1hdExhdGVuY3kocmVzdWx0LmJhc2VSdHRNcyl9YCk7XG4gIGlmIChyZXN1bHQucmVzcG9uc2l2ZW5lc3NScG0gIT09IG51bGwgJiYgcmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllciAhPT0gbnVsbClcbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgYFJlc3BvbnNpdmVuZXNzOiAke2Zvcm1hdFJlc3BvbnNpdmVuZXNzKHJlc3VsdC5yZXNwb25zaXZlbmVzc1JwbSwgcmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllcil9YCxcbiAgICApO1xuICByZXR1cm4gcGFydHMuam9pbihcIlxcblwiKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFJlc3BvbnNpdmVuZXNzVGllciwgVGVzdE1vZGUgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFRocm91Z2hwdXQoYml0c1BlclNlYzogbnVtYmVyIHwgbnVsbCk6IHN0cmluZyB7XG4gIGlmIChiaXRzUGVyU2VjID09PSBudWxsKSByZXR1cm4gXCJcdTIwMTRcIjtcbiAgY29uc3QgbWJwcyA9IGJpdHNQZXJTZWMgLyAxXzAwMF8wMDA7XG4gIGlmIChtYnBzID49IDEwMDApIHJldHVybiBgJHsobWJwcyAvIDEwMDApLnRvRml4ZWQoMil9IEdicHNgO1xuICBpZiAobWJwcyA+PSAxMDApIHJldHVybiBgJHttYnBzLnRvRml4ZWQoMCl9IE1icHNgO1xuICBpZiAobWJwcyA+PSAxMCkgcmV0dXJuIGAke21icHMudG9GaXhlZCgxKX0gTWJwc2A7XG4gIHJldHVybiBgJHttYnBzLnRvRml4ZWQoMil9IE1icHNgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0TGF0ZW5jeShtczogbnVtYmVyIHwgbnVsbCk6IHN0cmluZyB7XG4gIGlmIChtcyA9PT0gbnVsbCkgcmV0dXJuIFwiXHUyMDE0XCI7XG4gIHJldHVybiBtcyA+PSAxMCA/IGAke21zLnRvRml4ZWQoMCl9IG1zYCA6IGAke21zLnRvRml4ZWQoMSl9IG1zYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vZGVMYWJlbChtb2RlOiBUZXN0TW9kZSk6IHN0cmluZyB7XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgXCJwYXJhbGxlbFwiOlxuICAgICAgcmV0dXJuIFwiUGFyYWxsZWwgKGRvd24gKyB1cClcIjtcbiAgICBjYXNlIFwic2VxdWVudGlhbFwiOlxuICAgICAgcmV0dXJuIFwiU2VxdWVudGlhbFwiO1xuICAgIGNhc2UgXCJkb3dubG9hZFwiOlxuICAgICAgcmV0dXJuIFwiRG93bmxvYWQgb25seVwiO1xuICAgIGNhc2UgXCJ1cGxvYWRcIjpcbiAgICAgIHJldHVybiBcIlVwbG9hZCBvbmx5XCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJlc3BvbnNpdmVuZXNzKFxuICBycG06IG51bWJlciB8IG51bGwsXG4gIHRpZXI6IFJlc3BvbnNpdmVuZXNzVGllciB8IG51bGwsXG4pOiBzdHJpbmcge1xuICBpZiAocnBtID09PSBudWxsIHx8IHRpZXIgPT09IG51bGwpIHJldHVybiBcIlx1MjAxNFwiO1xuICBjb25zdCBsYWJlbCA9IHRpZXIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0aWVyLnNsaWNlKDEpO1xuICByZXR1cm4gYCR7bGFiZWx9ICgke3JwbS50b0ZpeGVkKDApfSBSUE0pYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEVsYXBzZWQobXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHNlY29uZHMgPSBtcyAvIDEwMDA7XG4gIHJldHVybiBzZWNvbmRzIDwgMTAgPyBgJHtzZWNvbmRzLnRvRml4ZWQoMSl9c2AgOiBgJHtNYXRoLnJvdW5kKHNlY29uZHMpfXNgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyUHJvZ3Jlc3NCYXIoZnJhY3Rpb246IG51bWJlciwgd2lkdGggPSAyNCk6IHN0cmluZyB7XG4gIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCBmcmFjdGlvbikpO1xuICBjb25zdCBmaWxsZWQgPSBNYXRoLnJvdW5kKGNsYW1wZWQgKiB3aWR0aCk7XG4gIHJldHVybiBcIlx1MjU4OFwiLnJlcGVhdChmaWxsZWQpICsgXCJcdTI1OTFcIi5yZXBlYXQod2lkdGggLSBmaWxsZWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVsYXRpdmVUaW1lKFxuICB0czogbnVtYmVyLFxuICBub3c6IG51bWJlciA9IERhdGUubm93KCksXG4pOiBzdHJpbmcge1xuICBjb25zdCBzZWNvbmRzID0gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCgobm93IC0gdHMpIC8gMTAwMCkpO1xuICBpZiAoc2Vjb25kcyA8IDUpIHJldHVybiBcImp1c3Qgbm93XCI7XG4gIGlmIChzZWNvbmRzIDwgNjApIHJldHVybiBgJHtzZWNvbmRzfXMgYWdvYDtcbiAgY29uc3QgbWludXRlcyA9IE1hdGgucm91bmQoc2Vjb25kcyAvIDYwKTtcbiAgaWYgKG1pbnV0ZXMgPCA2MCkgcmV0dXJuIGAke21pbnV0ZXN9bSBhZ29gO1xuICBjb25zdCBob3VycyA9IE1hdGgucm91bmQobWludXRlcyAvIDYwKTtcbiAgaWYgKGhvdXJzIDwgMjQpIHJldHVybiBgJHtob3Vyc31oIGFnb2A7XG4gIGNvbnN0IGRheXMgPSBNYXRoLnJvdW5kKGhvdXJzIC8gMjQpO1xuICByZXR1cm4gYCR7ZGF5c31kIGFnb2A7XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBTcGVlZFRpZXIgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuLyoqXG4gKiBUaWVyIGJvdW5kYXJpZXMgaW4gTWJwcy4gQ2hvc2VuIGZvciAyMDI2IHR5cGljYWwtdXNlciBjYWxpYnJhdGlvbjpcbiAqIC0gcG9vcjogbm90aWNlYWJsZSBkZWdyYWRhdGlvbiBmb3IgZXZlcnlkYXkgdXNlXG4gKiAtIG9rOiBoYW5kbGVzIEhEIHN0cmVhbWluZyArIHZpZGVvIGNhbGxzXG4gKiAtIGdvb2Q6IGNvbWZvcnRhYmxlIGZvciA0SyArIG11bHRpLWRldmljZVxuICogLSBncmVhdDogcG93ZXItdXNlciAvIG11bHRpLTRLIHRlcnJpdG9yeVxuICogLSBleGNlbGxlbnQ6IGdpZ2FiaXQtY2xhc3NcbiAqL1xuY29uc3QgVElFUl9USFJFU0hPTERTX01CUFM6IEFycmF5PHsgdGllcjogU3BlZWRUaWVyOyBtaW46IG51bWJlciB9PiA9IFtcbiAgeyB0aWVyOiBcImV4Y2VsbGVudFwiLCBtaW46IDEwMDAgfSxcbiAgeyB0aWVyOiBcImdyZWF0XCIsIG1pbjogMjAwIH0sXG4gIHsgdGllcjogXCJnb29kXCIsIG1pbjogNTAgfSxcbiAgeyB0aWVyOiBcIm9rXCIsIG1pbjogMTAgfSxcbiAgeyB0aWVyOiBcInBvb3JcIiwgbWluOiAwIH0sXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gY2xhc3NpZnlTcGVlZChicHM6IG51bWJlcik6IFNwZWVkVGllciB7XG4gIGNvbnN0IG1icHMgPSBicHMgLyAxXzAwMF8wMDA7XG4gIHJldHVybiBUSUVSX1RIUkVTSE9MRFNfTUJQUy5maW5kKCh0KSA9PiBtYnBzID49IHQubWluKSEudGllcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwZWVkVGllckxhYmVsKHRpZXI6IFNwZWVkVGllcik6IHN0cmluZyB7XG4gIHJldHVybiB0aWVyLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdGllci5zbGljZSgxKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRvd25sb2FkQ29udGV4dCh0aWVyOiBTcGVlZFRpZXIpOiBzdHJpbmcge1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgcmV0dXJuIFwibWF5IHN0cnVnZ2xlIHdpdGggSEQgdmlkZW9cIjtcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHJldHVybiBcIkhEIHN0cmVhbWluZywgdmlkZW8gY2FsbHMgZmluZVwiO1xuICAgIGNhc2UgXCJnb29kXCI6XG4gICAgICByZXR1cm4gXCI0SyBzdHJlYW1pbmcsIG11bHRpLWRldmljZVwiO1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgcmV0dXJuIFwibXVsdGktNEssIGZhc3QgbGFyZ2UgZG93bmxvYWRzXCI7XG4gICAgY2FzZSBcImV4Y2VsbGVudFwiOlxuICAgICAgcmV0dXJuIFwiZ2lnYWJpdC1jbGFzcyBjb25uZWN0aW9uXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVwbG9hZENvbnRleHQodGllcjogU3BlZWRUaWVyKTogc3RyaW5nIHtcbiAgc3dpdGNoICh0aWVyKSB7XG4gICAgY2FzZSBcInBvb3JcIjpcbiAgICAgIHJldHVybiBcInZpZGVvIGNhbGxzIG1heSBzdHV0dGVyXCI7XG4gICAgY2FzZSBcIm9rXCI6XG4gICAgICByZXR1cm4gXCJIRCB2aWRlbyBjYWxscyBPS1wiO1xuICAgIGNhc2UgXCJnb29kXCI6XG4gICAgICByZXR1cm4gXCJoaWdoLXF1YWxpdHkgbGl2ZSBzdHJlYW1pbmdcIjtcbiAgICBjYXNlIFwiZ3JlYXRcIjpcbiAgICAgIHJldHVybiBcInByb2Zlc3Npb25hbCBzdHJlYW1pbmcsIGxhcmdlIHVwbG9hZHNcIjtcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICByZXR1cm4gXCJzeW1tZXRyaWMgZ2lnYWJpdFwiO1xuICB9XG59XG5cbi8qKlxuICogUmVuZGVyIGEgbG9nLXNjYWxlIG1ldGVyIGZyb20gMSBNYnBzIHRvIDEwIEdicHMgKGZvdXIgZGVjYWRlcykuXG4gKiBSZXR1cm5zIGEgbXVsdGktbGluZSBibG9jazogYmFyICsgYXhpcyBsYWJlbHMsIG1vbm9zcGFjZS5cbiAqL1xuY29uc3QgTUVURVJfV0lEVEggPSAyODtcbmNvbnN0IExPR19NSU4gPSAwOyAvLyBsb2cxMCgxIE1icHMpXG5jb25zdCBMT0dfTUFYID0gNDsgLy8gbG9nMTAoMTAwMDAgTWJwcyA9IDEwIEdicHMpXG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJMb2dNZXRlcihicHM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IG1icHMgPSBNYXRoLm1heCgwLjEsIGJwcyAvIDFfMDAwXzAwMCk7XG4gIGNvbnN0IGxvZ1ZhbCA9IE1hdGgubG9nMTAobWJwcyk7XG4gIGNvbnN0IGZyYWN0aW9uID0gTWF0aC5tYXgoXG4gICAgMCxcbiAgICBNYXRoLm1pbigxLCAobG9nVmFsIC0gTE9HX01JTikgLyAoTE9HX01BWCAtIExPR19NSU4pKSxcbiAgKTtcbiAgY29uc3QgcG9zaXRpb24gPSBNYXRoLnJvdW5kKGZyYWN0aW9uICogKE1FVEVSX1dJRFRIIC0gMSkpO1xuXG4gIGxldCBiYXIgPSBcIlwiO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IE1FVEVSX1dJRFRIOyBpKyspIHtcbiAgICBpZiAoaSA9PT0gcG9zaXRpb24pIGJhciArPSBcIlx1MjVCQ1wiO1xuICAgIGVsc2UgaWYgKGkgJSA3ID09PSAwKVxuICAgICAgYmFyICs9IFwiXHUyNTBBXCI7IC8vIGRlY2FkZSB0aWNrIGF0IDAsIDcsIDE0LCAyMVxuICAgIGVsc2UgYmFyICs9IFwiXHUyNTAwXCI7XG4gIH1cblxuICAvLyBBeGlzIGxhYmVsczogMU0oMCkgIDEwTSg3KSAgMTAwTSgxNCkgIDFHKDIxKSAgMTBHKDI3KVxuICBjb25zdCBheGlzID0gbGF5b3V0QXhpcyhbXG4gICAgeyBjb2w6IDAsIHRleHQ6IFwiMU1cIiB9LFxuICAgIHsgY29sOiA3LCB0ZXh0OiBcIjEwTVwiIH0sXG4gICAgeyBjb2w6IDE0LCB0ZXh0OiBcIjEwME1cIiB9LFxuICAgIHsgY29sOiAyMSwgdGV4dDogXCIxR1wiIH0sXG4gICAgeyBjb2w6IDI3LCB0ZXh0OiBcIjEwR1wiIH0sXG4gIF0pO1xuXG4gIHJldHVybiBgJHtiYXJ9XFxuJHtheGlzfWA7XG59XG5cbmZ1bmN0aW9uIGxheW91dEF4aXMobGFiZWxzOiBBcnJheTx7IGNvbDogbnVtYmVyOyB0ZXh0OiBzdHJpbmcgfT4pOiBzdHJpbmcge1xuICBjb25zdCBsaW5lOiBzdHJpbmdbXSA9IEFycmF5KE1FVEVSX1dJRFRIICsgMykuZmlsbChcIiBcIik7XG4gIGZvciAoY29uc3QgeyBjb2wsIHRleHQgfSBvZiBsYWJlbHMpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGMgPSBjb2wgKyBpO1xuICAgICAgaWYgKGMgPCBsaW5lLmxlbmd0aCkgbGluZVtjXSA9IHRleHRbaV07XG4gICAgfVxuICB9XG4gIHJldHVybiBsaW5lLmpvaW4oXCJcIikudHJpbUVuZCgpO1xufVxuIiwgImltcG9ydCB0eXBlIHsgTmV0d29ya1Rlc3RSZXN1bHQgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGNsYXNzaWZ5U3BlZWQgfSBmcm9tIFwiLi9zcGVlZFwiO1xuXG4vKipcbiAqIERldGVybWluaXN0aWMgcGxhaW4tRW5nbGlzaCB2ZXJkaWN0IGZvciBhIHJlc3VsdC4gT25lIHNlbnRlbmNlLlxuICogRGVzaWduZWQgZm9yIHNvbWVvbmUgd2hvIGRvZXNuJ3Qga25vdyB3aGF0IFJQTSBtZWFucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlU3VtbWFyeShyZXN1bHQ6IE5ldHdvcmtUZXN0UmVzdWx0KTogc3RyaW5nIHtcbiAgY29uc3QgZGxUaWVyID1cbiAgICByZXN1bHQuZG93bmxvYWRCcHMgIT09IG51bGwgPyBjbGFzc2lmeVNwZWVkKHJlc3VsdC5kb3dubG9hZEJwcykgOiBudWxsO1xuICBjb25zdCB1bFRpZXIgPVxuICAgIHJlc3VsdC51cGxvYWRCcHMgIT09IG51bGwgPyBjbGFzc2lmeVNwZWVkKHJlc3VsdC51cGxvYWRCcHMpIDogbnVsbDtcbiAgY29uc3QgcmVzcExvdyA9IHJlc3VsdC5yZXNwb25zaXZlbmVzc1RpZXIgPT09IFwibG93XCI7XG5cbiAgLy8gTm8gbWVhc3VyZW1lbnRzIGF0IGFsbCBcdTIwMTQgc2hvdWxkbid0IHJlYWxseSBoYXBwZW5cbiAgaWYgKGRsVGllciA9PT0gbnVsbCAmJiB1bFRpZXIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gXCJDb3VsZG4ndCBtZWFzdXJlIHRocm91Z2hwdXQuIENvbm5lY3Rpb24gbWF5IGJlIHVuc3RhYmxlLlwiO1xuICB9XG5cbiAgLy8gU2luZ2xlIGRpcmVjdGlvbiBvbmx5XG4gIGlmIChkbFRpZXIgPT09IG51bGwpIHJldHVybiB2ZXJkaWN0VXBsb2FkKHVsVGllciEsIHJlc3BMb3cpO1xuICBpZiAodWxUaWVyID09PSBudWxsKSByZXR1cm4gdmVyZGljdERvd25sb2FkKGRsVGllciwgcmVzcExvdyk7XG5cbiAgLy8gQ29tYmluZWQgdmVyZGljdFxuICBjb25zdCBtaW4gPSBtaW5UaWVyKGRsVGllciwgdWxUaWVyKTtcbiAgbGV0IHZlcmRpY3Q6IHN0cmluZztcbiAgc3dpdGNoIChtaW4pIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiU2xvdyBjb25uZWN0aW9uIFx1MjAxNCBiYXNpYyBicm93c2luZyBvbmx5LCBleHBlY3QgaXNzdWVzIHdpdGggdmlkZW8gY2FsbHMuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHZlcmRpY3QgPVxuICAgICAgICBcIkRlY2VudCBjb25uZWN0aW9uIFx1MjAxNCBIRCBzdHJlYW1pbmcgYW5kIG9uZS1vbi1vbmUgdmlkZW8gY2FsbHMgc2hvdWxkIHdvcmsuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZ29vZFwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiU29saWQgY29ubmVjdGlvbiBcdTIwMTQgaGFuZGxlcyA0SyBzdHJlYW1pbmcgYW5kIG1vc3QgdmlkZW8gd29yayBjb21mb3J0YWJseS5cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiRmFzdCBjb25uZWN0aW9uIFx1MjAxNCBwbGVudHkgb2YgaGVhZHJvb20gZm9yIHN0cmVhbWluZywgY2FsbHMsIGFuZCBsYXJnZSB0cmFuc2ZlcnMuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICB2ZXJkaWN0ID1cbiAgICAgICAgXCJFeGNlbGxlbnQgY29ubmVjdGlvbiBcdTIwMTQgZ2lnYWJpdC1jbGFzcywgbm8gcHJhY3RpY2FsIGJvdHRsZW5lY2tzLlwiO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBpZiAocmVzcExvdykge1xuICAgIHZlcmRpY3QgKz1cbiAgICAgIFwiIFJlc3BvbnNpdmVuZXNzIGlzIGxvdyB0aG91Z2ggXHUyMDE0IHZpZGVvIGNhbGxzIGFuZCBnYW1pbmcgbWF5IHN0dXR0ZXIgdW5kZXIgbG9hZCAoYnVmZmVyYmxvYXQpLlwiO1xuICB9XG4gIHJldHVybiB2ZXJkaWN0O1xufVxuXG5mdW5jdGlvbiB2ZXJkaWN0RG93bmxvYWQoXG4gIHRpZXI6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PixcbiAgcmVzcExvdzogYm9vbGVhbixcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgcG9vcjogXCJEb3dubG9hZCBpcyBzbG93IFx1MjAxNCBIRCBzdHJlYW1pbmcgd2lsbCBzdHJ1Z2dsZS5cIixcbiAgICBvazogXCJEb3dubG9hZCBpcyBPSyBmb3IgSEQgc3RyZWFtaW5nIGFuZCBiYXNpYyB1c2UuXCIsXG4gICAgZ29vZDogXCJEb3dubG9hZCBpcyBzb2xpZCBcdTIwMTQgNEsgc3RyZWFtaW5nIHdvcmtzIGNvbWZvcnRhYmx5LlwiLFxuICAgIGdyZWF0OiBcIkRvd25sb2FkIGlzIGZhc3QgXHUyMDE0IHBsZW50eSBvZiBoZWFkcm9vbSBmb3IgaGVhdnkgdXNlLlwiLFxuICAgIGV4Y2VsbGVudDogXCJEb3dubG9hZCBpcyBnaWdhYml0LWNsYXNzLlwiLFxuICB9W3RpZXJdO1xuICByZXR1cm4gcmVzcExvdyA/IGAke2Jhc2V9IFJlc3BvbnNpdmVuZXNzIGlzIGxvdyAoYnVmZmVyYmxvYXQpLmAgOiBiYXNlO1xufVxuXG5mdW5jdGlvbiB2ZXJkaWN0VXBsb2FkKFxuICB0aWVyOiBOb25OdWxsYWJsZTxSZXR1cm5UeXBlPHR5cGVvZiBjbGFzc2lmeVNwZWVkPj4sXG4gIHJlc3BMb3c6IGJvb2xlYW4sXG4pOiBzdHJpbmcge1xuICBjb25zdCBiYXNlID0ge1xuICAgIHBvb3I6IFwiVXBsb2FkIGlzIHNsb3cgXHUyMDE0IHZpZGVvIGNhbGxzIGFuZCB1cGxvYWRzIHdpbGwgYmUgcGFpbmZ1bC5cIixcbiAgICBvazogXCJVcGxvYWQgaGFuZGxlcyBIRCB2aWRlbyBjYWxscy5cIixcbiAgICBnb29kOiBcIlVwbG9hZCBpcyBzb2xpZCBcdTIwMTQgZmluZSBmb3IgbGl2ZSBzdHJlYW1pbmcuXCIsXG4gICAgZ3JlYXQ6XG4gICAgICBcIlVwbG9hZCBpcyBmYXN0IFx1MjAxNCBwcm9mZXNzaW9uYWwgc3RyZWFtaW5nIGFuZCBsYXJnZSB1cGxvYWRzIHdvcmsgd2VsbC5cIixcbiAgICBleGNlbGxlbnQ6IFwiVXBsb2FkIGlzIGdpZ2FiaXQtY2xhc3MgXHUyMDE0IHN5bW1ldHJpYyBjb25uZWN0aW9uLlwiLFxuICB9W3RpZXJdO1xuICByZXR1cm4gcmVzcExvdyA/IGAke2Jhc2V9IFJlc3BvbnNpdmVuZXNzIGlzIGxvdyAoYnVmZmVyYmxvYXQpLmAgOiBiYXNlO1xufVxuXG5mdW5jdGlvbiBtaW5UaWVyKFxuICBhOiBOb25OdWxsYWJsZTxSZXR1cm5UeXBlPHR5cGVvZiBjbGFzc2lmeVNwZWVkPj4sXG4gIGI6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+Pixcbik6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PiB7XG4gIGNvbnN0IG9yZGVyID0gW1wicG9vclwiLCBcIm9rXCIsIFwiZ29vZFwiLCBcImdyZWF0XCIsIFwiZXhjZWxsZW50XCJdIGFzIGNvbnN0O1xuICByZXR1cm4gb3JkZXIuaW5kZXhPZihhKSA8IG9yZGVyLmluZGV4T2YoYikgPyBhIDogYjtcbn1cbiIsICJpbXBvcnQgeyBDb2xvciwgRGV0YWlsLCBJY29uIH0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBOZXR3b3JrSW50ZXJmYWNlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBkaXNwbGF5TmFtZSwgaXNTU0lEUGVybWlzc2lvbk1pc3NpbmcgfSBmcm9tIFwiLi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuXG4vKipcbiAqIFN0YW5kYXJkIHNldCBvZiBtZXRhZGF0YSByb3dzIGRlc2NyaWJpbmcgdGhlIG5ldHdvcmsgYW4gYWN0aXZlL2NvbXBsZXRlZFxuICogdGVzdCB3YXMgcnVuIG9uLiBEcm9wIGluc2lkZSBhIDxEZXRhaWwuTWV0YWRhdGE+LlxuICovXG5leHBvcnQgZnVuY3Rpb24gTmV0d29ya0NvbnRleHRNZXRhZGF0YSh7IGlmYWNlIH06IHsgaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfSkge1xuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgIHRpdGxlPVwiTmV0d29ya1wiXG4gICAgICAgIHRleHQ9e2Rpc3BsYXlOYW1lKGlmYWNlKX1cbiAgICAgICAgaWNvbj17aWNvbkZvcihpZmFjZSl9XG4gICAgICAvPlxuICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbCB0aXRsZT1cIkludGVyZmFjZVwiIHRleHQ9e2lmYWNlLm5hbWV9IC8+XG4gICAgICB7aWZhY2UuaXB2NCAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJMb2NhbCBJUFwiIHRleHQ9e2lmYWNlLmlwdjR9IC8+XG4gICAgICApfVxuICAgICAge2lmYWNlLmlzRGVmYXVsdCAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJEZWZhdWx0IHJvdXRlXCIgdGV4dD1cIlllc1wiIC8+XG4gICAgICApfVxuICAgICAge2lzU1NJRFBlcm1pc3Npb25NaXNzaW5nKGlmYWNlKSAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICB0aXRsZT1cIk5ldHdvcmsgbmFtZVwiXG4gICAgICAgICAgdGV4dD1cIkdyYW50IExvY2F0aW9uIFNlcnZpY2VzIHRvIHJlYWQgU1NJRFwiXG4gICAgICAgICAgaWNvbj17eyBzb3VyY2U6IEljb24uSW5mbywgdGludENvbG9yOiBDb2xvci5ZZWxsb3cgfX1cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgPC8+XG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpY29uRm9yKGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlKTogSWNvbiB7XG4gIGlmIChpZmFjZS5pc0hvdHNwb3QpIHJldHVybiBJY29uLk1vYmlsZTtcbiAgc3dpdGNoIChpZmFjZS50eXBlKSB7XG4gICAgY2FzZSBcIndpZmlcIjpcbiAgICAgIHJldHVybiBJY29uLldpZmk7XG4gICAgY2FzZSBcImV0aGVybmV0XCI6XG4gICAgICByZXR1cm4gSWNvbi5QbHVnO1xuICAgIGNhc2UgXCJ0aHVuZGVyYm9sdFwiOlxuICAgICAgcmV0dXJuIEljb24uQm9sdDtcbiAgICBjYXNlIFwidXNiXCI6XG4gICAgICByZXR1cm4gSWNvbi5Nb2JpbGU7XG4gICAgY2FzZSBcImJsdWV0b290aFwiOlxuICAgICAgcmV0dXJuIEljb24uQmx1ZXRvb3RoO1xuICAgIGNhc2UgXCJvdGhlclwiOlxuICAgICAgcmV0dXJuIEljb24uTmV0d29yaztcbiAgfVxufVxuIiwgImltcG9ydCB7IEFjdGlvbiwgQWN0aW9uUGFuZWwsIEljb24gfSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgdHlwZSB7IE5ldHdvcmtJbnRlcmZhY2UsIFRlc3RNb2RlLCBUZXN0U3RhdHVzIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBtb2RlTGFiZWwgfSBmcm9tIFwiLi4vbGliL2Zvcm1hdFwiO1xuXG5pbnRlcmZhY2UgUnVuVGVzdEFjdGlvbnNQcm9wcyB7XG4gIHN0YXR1czogVGVzdFN0YXR1cztcbiAgZGVmYXVsdE1vZGU6IFRlc3RNb2RlO1xuICAvKiogSWYgcHJvdmlkZWQsIGxldHMgdGhlIHVzZXIgcGljayB3aGljaCBpbnRlcmZhY2UgdG8gdGVzdC4gKi9cbiAgaW50ZXJmYWNlcz86IE5ldHdvcmtJbnRlcmZhY2VbXTtcbiAgY3VycmVudEludGVyZmFjZT86IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsO1xuICBvblJ1bjogKG1vZGU6IFRlc3RNb2RlLCBpZmFjZT86IE5ldHdvcmtJbnRlcmZhY2UpID0+IHZvaWQ7XG4gIG9uQ2FuY2VsPzogKCkgPT4gdm9pZDtcbn1cblxuY29uc3QgTU9ERVM6IFRlc3RNb2RlW10gPSBbXCJwYXJhbGxlbFwiLCBcInNlcXVlbnRpYWxcIiwgXCJkb3dubG9hZFwiLCBcInVwbG9hZFwiXTtcblxuLyoqXG4gKiBQcmltYXJ5IGFjdGlvbiBpcyBjb250ZXh0dWFsOlxuICogICBydW5uaW5nICBcdTIxOTIgXCJDYW5jZWwgVGVzdFwiIChFbnRlcilcbiAqICAgZWxzZSAgICAgXHUyMTkyIFwiUnVuIFRlc3RcIiAoRW50ZXIpXG4gKiBNb2RlIGFuZCBpbnRlcmZhY2UgcGlja2VycyBsaXZlIGluIHN1Ym1lbnVzIHNvIHRoZSBwYW5lbCBzdGF5cyB1bmNsdXR0ZXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFJ1blRlc3RBY3Rpb25zKHtcbiAgc3RhdHVzLFxuICBkZWZhdWx0TW9kZSxcbiAgaW50ZXJmYWNlcyxcbiAgY3VycmVudEludGVyZmFjZSxcbiAgb25SdW4sXG4gIG9uQ2FuY2VsLFxufTogUnVuVGVzdEFjdGlvbnNQcm9wcykge1xuICBpZiAoc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgIHJldHVybiAoXG4gICAgICA8QWN0aW9uXG4gICAgICAgIHRpdGxlPVwiQ2FuY2VsIFRlc3RcIlxuICAgICAgICBpY29uPXtJY29uLlN0b3B9XG4gICAgICAgIG9uQWN0aW9uPXsoKSA9PiBvbkNhbmNlbD8uKCl9XG4gICAgICAvPlxuICAgICk7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8QWN0aW9uXG4gICAgICAgIHRpdGxlPVwiUnVuIFRlc3RcIlxuICAgICAgICBpY29uPXtJY29uLlBsYXl9XG4gICAgICAgIG9uQWN0aW9uPXsoKSA9PiBvblJ1bihkZWZhdWx0TW9kZSwgY3VycmVudEludGVyZmFjZSA/PyB1bmRlZmluZWQpfVxuICAgICAgLz5cbiAgICAgIDxBY3Rpb25QYW5lbC5TdWJtZW51XG4gICAgICAgIHRpdGxlPVwiUnVuIHdpdGggTW9kZVwiXG4gICAgICAgIGljb249e0ljb24uU3dpdGNofVxuICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcIm1cIiB9fVxuICAgICAgPlxuICAgICAgICB7TU9ERVMubWFwKChtKSA9PiAoXG4gICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAga2V5PXttfVxuICAgICAgICAgICAgdGl0bGU9e21vZGVMYWJlbChtKX1cbiAgICAgICAgICAgIGljb249e2ljb25Gb3JNb2RlKG0pfVxuICAgICAgICAgICAgb25BY3Rpb249eygpID0+IG9uUnVuKG0sIGN1cnJlbnRJbnRlcmZhY2UgPz8gdW5kZWZpbmVkKX1cbiAgICAgICAgICAvPlxuICAgICAgICApKX1cbiAgICAgIDwvQWN0aW9uUGFuZWwuU3VibWVudT5cbiAgICAgIHtpbnRlcmZhY2VzICYmIGludGVyZmFjZXMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxBY3Rpb25QYW5lbC5TdWJtZW51XG4gICAgICAgICAgdGl0bGU9XCJSdW4gb24gSW50ZXJmYWNlXCJcbiAgICAgICAgICBpY29uPXtJY29uLk5ldHdvcmt9XG4gICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIl0sIGtleTogXCJpXCIgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHtpbnRlcmZhY2VzLm1hcCgoaWZhY2UpID0+IChcbiAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAga2V5PXtpZmFjZS5uYW1lfVxuICAgICAgICAgICAgICB0aXRsZT17YCR7aWZhY2UubmFtZX0gXHUyMDE0ICR7aWZhY2Uuc3NpZCA/PyBpZmFjZS5oYXJkd2FyZVBvcnR9YH1cbiAgICAgICAgICAgICAgaWNvbj17SWNvbi5OZXR3b3JrfVxuICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gb25SdW4oZGVmYXVsdE1vZGUsIGlmYWNlKX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvQWN0aW9uUGFuZWwuU3VibWVudT5cbiAgICAgICl9XG4gICAgPC8+XG4gICk7XG59XG5cbmZ1bmN0aW9uIGljb25Gb3JNb2RlKG1vZGU6IFRlc3RNb2RlKTogSWNvbiB7XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgXCJwYXJhbGxlbFwiOlxuICAgICAgcmV0dXJuIEljb24uQXJyb3dDbG9ja3dpc2U7XG4gICAgY2FzZSBcInNlcXVlbnRpYWxcIjpcbiAgICAgIHJldHVybiBJY29uLkxpc3Q7XG4gICAgY2FzZSBcImRvd25sb2FkXCI6XG4gICAgICByZXR1cm4gSWNvbi5BcnJvd0Rvd247XG4gICAgY2FzZSBcInVwbG9hZFwiOlxuICAgICAgcmV0dXJuIEljb24uQXJyb3dVcDtcbiAgfVxufVxuIiwgImltcG9ydCB7IEFjdGlvbiwgQWN0aW9uUGFuZWwsIERldGFpbCwgSWNvbiB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgVGVzdEVycm9yRGV0YWlscywgVGVzdE1vZGUgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IFJ1blRlc3RBY3Rpb25zIH0gZnJvbSBcIi4vUnVuVGVzdEFjdGlvbnNcIjtcblxuaW50ZXJmYWNlIEVycm9yRGV0YWlsUHJvcHMge1xuICBlcnJvcjogVGVzdEVycm9yRGV0YWlscztcbiAgZGVmYXVsdE1vZGU6IFRlc3RNb2RlO1xuICBvblJldHJ5OiAobW9kZTogVGVzdE1vZGUpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBFcnJvckRldGFpbCh7IGVycm9yLCBkZWZhdWx0TW9kZSwgb25SZXRyeSB9OiBFcnJvckRldGFpbFByb3BzKSB7XG4gIHJldHVybiAoXG4gICAgPERldGFpbFxuICAgICAgbWFya2Rvd249e3JlbmRlck1hcmtkb3duKGVycm9yKX1cbiAgICAgIGFjdGlvbnM9e1xuICAgICAgICA8QWN0aW9uUGFuZWw+XG4gICAgICAgICAgPFJ1blRlc3RBY3Rpb25zXG4gICAgICAgICAgICBzdGF0dXM9XCJpZGxlXCJcbiAgICAgICAgICAgIGRlZmF1bHRNb2RlPXtkZWZhdWx0TW9kZX1cbiAgICAgICAgICAgIG9uUnVuPXtvblJldHJ5fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEFjdGlvbi5Db3B5VG9DbGlwYm9hcmRcbiAgICAgICAgICAgIHRpdGxlPVwiQ29weSBEZWJ1ZyBJbmZvXCJcbiAgICAgICAgICAgIGljb249e0ljb24uQ2xpcGJvYXJkfVxuICAgICAgICAgICAgY29udGVudD17cmVuZGVyRGVidWdJbmZvKGVycm9yKX1cbiAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCJdLCBrZXk6IFwiZFwiIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9BY3Rpb25QYW5lbD5cbiAgICAgIH1cbiAgICAvPlxuICApO1xufVxuXG5mdW5jdGlvbiByZW5kZXJNYXJrZG93bihlcnJvcjogVGVzdEVycm9yRGV0YWlscyk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBsaW5lcy5wdXNoKFwiIyBOZXR3b3JrIHRlc3QgZmFpbGVkXCIpO1xuICBsaW5lcy5wdXNoKFwiXCIpO1xuICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICBsaW5lcy5wdXNoKGVycm9yLm1lc3NhZ2UpO1xuICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICBsaW5lcy5wdXNoKFwiXCIpO1xuXG4gIGlmIChlcnJvci53YXNSZXRyaWVkKSB7XG4gICAgbGluZXMucHVzaChcIipSZXRyaWVkIG9uY2UgYXV0b21hdGljYWxseSBiZWZvcmUgc2hvd2luZyB0aGlzIGVycm9yLipcIik7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuXG4gIGxpbmVzLnB1c2goXG4gICAgXCJUaGlzIGlzIHVzdWFsbHkgdHJhbnNpZW50IFx1MjAxNCB0aGUgQXBwbGUgdGVzdCBlbmRwb2ludCBjYW4gcmVmdXNlIG1pZC1ydW4gb24gZmxha3kgbmV0d29ya3MuIFRyeSBhZ2Fpbi5cIixcbiAgKTtcbiAgbGluZXMucHVzaChcIlwiKTtcblxuICBpZiAoZXJyb3IuYXJncyAmJiBlcnJvci5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICBsaW5lcy5wdXNoKFwiIyMjIENvbW1hbmRcIik7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKGAvdXNyL2Jpbi9uZXR3b3JrcXVhbGl0eSAke2Vycm9yLmFyZ3Muam9pbihcIiBcIil9YCk7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG5cbiAgaWYgKGVycm9yLnJhd091dHB1dCkge1xuICAgIGxpbmVzLnB1c2goXCIjIyMgUmF3IHN0ZG91dFwiKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBganNvblwiKTtcbiAgICBsaW5lcy5wdXNoKHRydW5jYXRlKGVycm9yLnJhd091dHB1dCwgMTIwMCkpO1xuICAgIGxpbmVzLnB1c2goXCJgYGBcIik7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuXG4gIGlmIChlcnJvci5yYXdTdGRlcnIgJiYgZXJyb3IucmF3U3RkZXJyLnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgbGluZXMucHVzaChcIiMjIyBzdGRlcnJcIik7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKHRydW5jYXRlKGVycm9yLnJhd1N0ZGVyciwgODAwKSk7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckRlYnVnSW5mbyhlcnJvcjogVGVzdEVycm9yRGV0YWlscyk6IHN0cmluZyB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShcbiAgICB7XG4gICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgd2FzUmV0cmllZDogZXJyb3Iud2FzUmV0cmllZCxcbiAgICAgIGFyZ3M6IGVycm9yLmFyZ3MsXG4gICAgICBzdGRvdXQ6IGVycm9yLnJhd091dHB1dCxcbiAgICAgIHN0ZGVycjogZXJyb3IucmF3U3RkZXJyLFxuICAgIH0sXG4gICAgbnVsbCxcbiAgICAyLFxuICApO1xufVxuXG5mdW5jdGlvbiB0cnVuY2F0ZShzOiBzdHJpbmcsIG1heDogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKHMubGVuZ3RoIDw9IG1heCkgcmV0dXJuIHM7XG4gIHJldHVybiBzLnNsaWNlKDAsIG1heCkgKyBgXFxuLi4uIFt0cnVuY2F0ZWQsICR7cy5sZW5ndGggLSBtYXh9IG1vcmUgY2hhcnNdYDtcbn1cbiIsICJpbXBvcnQgeyBBY3Rpb25QYW5lbCwgRGV0YWlsLCBJY29uIH0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHR5cGUge1xuICBOZXR3b3JrSW50ZXJmYWNlLFxuICBUZXN0TW9kZSxcbiAgVGVzdFBoYXNlLFxuICBUZXN0UHJvZ3Jlc3MsXG59IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgZm9ybWF0RWxhcHNlZCwgbW9kZUxhYmVsLCByZW5kZXJQcm9ncmVzc0JhciB9IGZyb20gXCIuLi9saWIvZm9ybWF0XCI7XG5pbXBvcnQgeyBkaXNwbGF5TmFtZSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9pbnRlcmZhY2VzXCI7XG5pbXBvcnQgeyBOZXR3b3JrQ29udGV4dE1ldGFkYXRhIH0gZnJvbSBcIi4vTmV0d29ya0JhZGdlXCI7XG5pbXBvcnQgeyBSdW5UZXN0QWN0aW9ucyB9IGZyb20gXCIuL1J1blRlc3RBY3Rpb25zXCI7XG5cbmludGVyZmFjZSBSdW5uaW5nVmlld1Byb3BzIHtcbiAgcHJvZ3Jlc3M6IFRlc3RQcm9ncmVzcztcbiAgbW9kZTogVGVzdE1vZGU7XG4gIGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbDtcbiAgZGVmYXVsdE1vZGU6IFRlc3RNb2RlO1xuICBvblJ1bjogKG1vZGU6IFRlc3RNb2RlLCBpZmFjZT86IE5ldHdvcmtJbnRlcmZhY2UpID0+IHZvaWQ7XG4gIG9uQ2FuY2VsOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gUnVubmluZ1ZpZXcoe1xuICBwcm9ncmVzcyxcbiAgbW9kZSxcbiAgaWZhY2UsXG4gIGRlZmF1bHRNb2RlLFxuICBvblJ1bixcbiAgb25DYW5jZWwsXG59OiBSdW5uaW5nVmlld1Byb3BzKSB7XG4gIHJldHVybiAoXG4gICAgPERldGFpbFxuICAgICAgaXNMb2FkaW5nXG4gICAgICBtYXJrZG93bj17cmVuZGVyTWFya2Rvd24ocHJvZ3Jlc3MsIG1vZGUsIGlmYWNlKX1cbiAgICAgIG1ldGFkYXRhPXtcbiAgICAgICAgPERldGFpbC5NZXRhZGF0YT5cbiAgICAgICAgICB7aWZhY2UgJiYgPE5ldHdvcmtDb250ZXh0TWV0YWRhdGEgaWZhY2U9e2lmYWNlfSAvPn1cbiAgICAgICAgICB7aWZhY2UgJiYgPERldGFpbC5NZXRhZGF0YS5TZXBhcmF0b3IgLz59XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbFxuICAgICAgICAgICAgdGl0bGU9XCJNb2RlXCJcbiAgICAgICAgICAgIHRleHQ9e21vZGVMYWJlbChtb2RlKX1cbiAgICAgICAgICAgIGljb249e0ljb24uU3dpdGNofVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbFxuICAgICAgICAgICAgdGl0bGU9XCJQaGFzZVwiXG4gICAgICAgICAgICB0ZXh0PXtwaGFzZUxhYmVsKHByb2dyZXNzLnBoYXNlKX1cbiAgICAgICAgICAgIGljb249e3BoYXNlSWNvbihwcm9ncmVzcy5waGFzZSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICB0aXRsZT1cIkVsYXBzZWRcIlxuICAgICAgICAgICAgdGV4dD17Zm9ybWF0RWxhcHNlZChwcm9ncmVzcy5lbGFwc2VkTXMpfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgeyFwcm9ncmVzcy5vdmVycnVuICYmIChcbiAgICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICAgICAgdGl0bGU9XCJFc3RpbWF0ZWQgdG90YWxcIlxuICAgICAgICAgICAgICB0ZXh0PXtgfiR7TWF0aC5yb3VuZChwcm9ncmVzcy5lc3RpbWF0ZWRUb3RhbE1zIC8gMTAwMCl9c2B9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhPlxuICAgICAgfVxuICAgICAgYWN0aW9ucz17XG4gICAgICAgIDxBY3Rpb25QYW5lbD5cbiAgICAgICAgICA8UnVuVGVzdEFjdGlvbnNcbiAgICAgICAgICAgIHN0YXR1cz1cInJ1bm5pbmdcIlxuICAgICAgICAgICAgZGVmYXVsdE1vZGU9e2RlZmF1bHRNb2RlfVxuICAgICAgICAgICAgb25SdW49e29uUnVufVxuICAgICAgICAgICAgb25DYW5jZWw9e29uQ2FuY2VsfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQWN0aW9uUGFuZWw+XG4gICAgICB9XG4gICAgLz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oXG4gIHByb2dyZXNzOiBUZXN0UHJvZ3Jlc3MsXG4gIG1vZGU6IFRlc3RNb2RlLFxuICBpZmFjZTogTmV0d29ya0ludGVyZmFjZSB8IG51bGwsXG4pOiBzdHJpbmcge1xuICBjb25zdCBiYXIgPSByZW5kZXJQcm9ncmVzc0Jhcihwcm9ncmVzcy5mcmFjdGlvbik7XG4gIGNvbnN0IHBjdCA9IE1hdGgucm91bmQocHJvZ3Jlc3MuZnJhY3Rpb24gKiAxMDApO1xuICBjb25zdCBoZWFkaW5nID0gaGVhZGluZ0Zvcihwcm9ncmVzcy5waGFzZSwgbW9kZSk7XG4gIGNvbnN0IGRldGFpbCA9IGRldGFpbEZvcihwcm9ncmVzcy5waGFzZSwgbW9kZSk7XG4gIGNvbnN0IGVsYXBzZWRMaW5lID0gcHJvZ3Jlc3Mub3ZlcnJ1blxuICAgID8gYCoqRWxhcHNlZCoqICAke2Zvcm1hdEVsYXBzZWQocHJvZ3Jlc3MuZWxhcHNlZE1zKX0gIFx1MDBCNyAgdGFraW5nIGxvbmdlciB0aGFuIHVzdWFsYFxuICAgIDogYCoqRWxhcHNlZCoqICAke2Zvcm1hdEVsYXBzZWQocHJvZ3Jlc3MuZWxhcHNlZE1zKX0gLyB+JHtNYXRoLnJvdW5kKHByb2dyZXNzLmVzdGltYXRlZFRvdGFsTXMgLyAxMDAwKX1zYDtcbiAgY29uc3QgaWZhY2VMaW5lID0gaWZhY2VcbiAgICA/IGBUZXN0aW5nICoqJHtkaXNwbGF5TmFtZShpZmFjZSl9KiogKCR7aWZhY2UubmFtZX0pYFxuICAgIDogXCJcIjtcblxuICByZXR1cm4gW1xuICAgIGAjICR7aGVhZGluZ31gLFxuICAgIFwiXCIsXG4gICAgaWZhY2VMaW5lLFxuICAgIFwiXCIsXG4gICAgXCJgYGBcIixcbiAgICBgJHtiYXJ9ICAke3BjdH0lYCxcbiAgICBcImBgYFwiLFxuICAgIFwiXCIsXG4gICAgZGV0YWlsLFxuICAgIFwiXCIsXG4gICAgZWxhcHNlZExpbmUsXG4gIF1cbiAgICAuZmlsdGVyKChzLCBpKSA9PiBzICE9PSBcIlwiIHx8IGkgPT09IDApXG4gICAgLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGhlYWRpbmdGb3IocGhhc2U6IFRlc3RQaGFzZSwgbW9kZTogVGVzdE1vZGUpOiBzdHJpbmcge1xuICBpZiAocGhhc2UgPT09IFwid2FybXVwXCIpIHJldHVybiBcIkNvbm5lY3RpbmcgdG8gdGVzdCBzZXJ2ZXIuLi5cIjtcbiAgaWYgKHBoYXNlID09PSBcImZpbmFsaXppbmdcIikgcmV0dXJuIFwiRmluYWxpemluZyByZXN1bHRzLi4uXCI7XG4gIGlmIChwaGFzZSA9PT0gXCJvdmVycnVuXCIpIHJldHVybiBcIlN0aWxsIG1lYXN1cmluZy4uLlwiO1xuICBzd2l0Y2ggKG1vZGUpIHtcbiAgICBjYXNlIFwicGFyYWxsZWxcIjpcbiAgICAgIHJldHVybiBcIk1lYXN1cmluZyBkb3dubG9hZCAmIHVwbG9hZFwiO1xuICAgIGNhc2UgXCJzZXF1ZW50aWFsXCI6XG4gICAgICByZXR1cm4gXCJNZWFzdXJpbmcgKG9uZSBkaXJlY3Rpb24gYXQgYSB0aW1lKVwiO1xuICAgIGNhc2UgXCJkb3dubG9hZFwiOlxuICAgICAgcmV0dXJuIFwiTWVhc3VyaW5nIGRvd25sb2FkIHNwZWVkXCI7XG4gICAgY2FzZSBcInVwbG9hZFwiOlxuICAgICAgcmV0dXJuIFwiTWVhc3VyaW5nIHVwbG9hZCBzcGVlZFwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRldGFpbEZvcihwaGFzZTogVGVzdFBoYXNlLCBtb2RlOiBUZXN0TW9kZSk6IHN0cmluZyB7XG4gIGlmIChwaGFzZSA9PT0gXCJ3YXJtdXBcIilcbiAgICByZXR1cm4gXCJOZWdvdGlhdGluZyB3aXRoIEFwcGxlJ3MgbmV0d29yayBxdWFsaXR5IGVuZHBvaW50LlwiO1xuICBpZiAocGhhc2UgPT09IFwiZmluYWxpemluZ1wiKSByZXR1cm4gXCJDb21wdXRpbmcgdGhyb3VnaHB1dCBhbmQgcmVzcG9uc2l2ZW5lc3MuXCI7XG4gIGlmIChwaGFzZSA9PT0gXCJvdmVycnVuXCIpXG4gICAgcmV0dXJuIFwiU2xvd2VyIHRoYW4gdHlwaWNhbCBmb3IgdGhpcyBuZXR3b3JrLCBzbyB0aGUgdGVzdCBuZWVkcyBtb3JlIHRpbWUuIFJlc3VsdHMgd2lsbCBzdGlsbCBiZSBhY2N1cmF0ZS5cIjtcbiAgaWYgKG1vZGUgPT09IFwicGFyYWxsZWxcIilcbiAgICByZXR1cm4gXCJTYXR1cmF0aW5nIHRoZSBsaW5rIGluIGJvdGggZGlyZWN0aW9ucyB3aGlsZSBzYW1wbGluZyBsYXRlbmN5IHVuZGVyIGxvYWQuXCI7XG4gIGlmIChtb2RlID09PSBcInNlcXVlbnRpYWxcIilcbiAgICByZXR1cm4gXCJNZWFzdXJpbmcgZWFjaCBkaXJlY3Rpb24gc2VwYXJhdGVseSBmb3IgcGVhay1zcGVlZCBhY2N1cmFjeS5cIjtcbiAgcmV0dXJuIFwiU2F0dXJhdGluZyBvbmUgZGlyZWN0aW9uIHdoaWxlIHNhbXBsaW5nIGxhdGVuY3kuXCI7XG59XG5cbmZ1bmN0aW9uIHBoYXNlTGFiZWwocGhhc2U6IFRlc3RQaGFzZSk6IHN0cmluZyB7XG4gIGlmIChwaGFzZSA9PT0gXCJvdmVycnVuXCIpIHJldHVybiBcIk92ZXJydW4gKHN0aWxsIHJ1bm5pbmcpXCI7XG4gIHJldHVybiBwaGFzZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHBoYXNlLnNsaWNlKDEpO1xufVxuXG5mdW5jdGlvbiBwaGFzZUljb24ocGhhc2U6IFRlc3RQaGFzZSk6IEljb24ge1xuICBzd2l0Y2ggKHBoYXNlKSB7XG4gICAgY2FzZSBcIndhcm11cFwiOlxuICAgICAgcmV0dXJuIEljb24uUGx1ZztcbiAgICBjYXNlIFwibWVhc3VyaW5nXCI6XG4gICAgICByZXR1cm4gSWNvbi5CYXJDaGFydDtcbiAgICBjYXNlIFwiZmluYWxpemluZ1wiOlxuICAgICAgcmV0dXJuIEljb24uQ2hlY2tDaXJjbGU7XG4gICAgY2FzZSBcIm92ZXJydW5cIjpcbiAgICAgIHJldHVybiBJY29uLkhvdXJnbGFzcztcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLGNBQW9DOzs7QUNBcEMseUJBQTJCO0FBQzNCLG1CQUF5RDs7O0FDRHpELGdDQUF5QjtBQUN6Qix1QkFBMEI7QUFHMUIsSUFBTSxvQkFBZ0IsNEJBQVUsa0NBQVE7QUFFeEMsSUFBTSxxQkFBcUI7QUFDM0IsSUFBTSxrQkFBa0I7QUFFakIsSUFBTSxtQkFBTixjQUErQixNQUFNO0FBQUEsRUFDMUMsWUFDRSxTQUNnQixPQUNBLGFBS2hCO0FBQ0EsVUFBTSxPQUFPO0FBUEc7QUFDQTtBQU9oQixTQUFLLE9BQU87QUFBQSxFQUNkO0FBQUEsRUFUa0I7QUFBQSxFQUNBO0FBU3BCO0FBTU8sSUFBTSwwQkFBMEI7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UUFDQyxPQUFPLE1BQU07QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUE7QUFBQSxJQUNYO0FBQUEsRUFFSjtBQUVBLE1BQUksTUFBTSxZQUFZLE1BQU0sYUFBYTtBQUN2QyxXQUNFO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDQyxVQUFVLE1BQU07QUFBQSxRQUNoQixNQUFNLE1BQU07QUFBQSxRQUNaLE9BQU8sTUFBTTtBQUFBLFFBQ2I7QUFBQSxRQUNBLE9BQU87QUFBQSxRQUNQLFVBQVU7QUFBQTtBQUFBLElBQ1o7QUFBQSxFQUVKO0FBRUEsU0FDRTtBQUFBLElBQUM7QUFBQTtBQUFBLE1BQ0MsVUFBVTtBQUFBLFFBQ1IsT0FBTztBQUFBLFFBQ1AsV0FBVztBQUFBLFFBQ1gsa0JBQWtCO0FBQUEsUUFDbEIsVUFBVTtBQUFBLFFBQ1YsU0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQO0FBQUEsTUFDQSxPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUE7QUFBQSxFQUNaO0FBRUo7IiwKICAibmFtZXMiOiBbImltcG9ydF9hcGkiLCAiaW1wb3J0X25vZGVfY2hpbGRfcHJvY2VzcyIsICJpbXBvcnRfbm9kZV91dGlsIiwgImV4ZWNGaWxlQXN5bmMiLCAiZXhlY0ZpbGVBc3luYyIsICJpbXBvcnRfYXBpIiwgInBhdGgiLCAiZnMiLCAiaW1wb3J0X2FwaSIsICJpbXBvcnRfYXBpIiwgImltcG9ydF9hcGkiLCAiaW1wb3J0X2FwaSIsICJpbXBvcnRfanN4X3J1bnRpbWUiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgImltcG9ydF9hcGkiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgInJlbmRlck1hcmtkb3duIiwgImltcG9ydF9hcGkiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgInJlbmRlck1hcmtkb3duIiwgImltcG9ydF9qc3hfcnVudGltZSJdCn0K
