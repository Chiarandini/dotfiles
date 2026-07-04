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

// src/compare-networks.tsx
var compare_networks_exports = {};
__export(compare_networks_exports, {
  default: () => Command
});
module.exports = __toCommonJS(compare_networks_exports);
var import_api5 = require("@raycast/api");
var import_react2 = require("react");

// src/hooks/useCompareNetworks.ts
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
async function getActiveInterfaces() {
  return (await listInterfaces()).filter((i) => i.active);
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
async function getWifiDevice() {
  const ports = await listHardwarePorts();
  const wifi = ports.find((p) => /wi-fi|airport/i.test(p.hardwarePort));
  return wifi?.device ?? null;
}
async function getCurrentWifiSSID() {
  const device = await getWifiDevice();
  if (!device) return null;
  return readSSID(device);
}
async function listKnownWifiNetworks() {
  const device = await getWifiDevice();
  if (!device) return [];
  try {
    const { stdout } = await execFileAsync2(
      "/usr/sbin/networksetup",
      ["-listpreferredwirelessnetworks", device],
      { timeout: CMD_TIMEOUT_MS }
    );
    return stdout.split("\n").slice(1).map((l) => l.trim()).filter((l) => l.length > 0);
  } catch {
    return [];
  }
}
async function switchWifiTo(device, ssid, signal) {
  const { stdout, stderr } = await execFileAsync2(
    "/usr/sbin/networksetup",
    ["-setairportnetwork", device, ssid],
    { timeout: 2e4, signal }
  );
  const combined = `${stdout}
${stderr}`.toLowerCase();
  if (combined.includes("failed") || combined.includes("could not find") || combined.includes("error")) {
    if (isContinuityHotspotName(ssid)) {
      throw new Error(
        `${ssid} is a Personal Hotspot \u2014 activate it via the Wi-Fi menu bar (Continuity), then re-run. networksetup can't trigger Continuity.`
      );
    }
    throw new Error(
      `${ssid} not in range or unreachable (raw: ${stdout.trim() || stderr.trim() || "no output"})`
    );
  }
}
function isContinuityHotspotName(ssid) {
  return /\b(iphone|ipad)\b/i.test(ssid);
}
async function waitForWifiReady(device, expectedSSID, timeoutMs = 2e4, signal) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) return { active: false, ssid: null };
    const [active] = await readIfconfig(device);
    if (active) {
      const ssid = await readSSID(device);
      if (expectedSSID === null || ssid === null || ssid === expectedSSID) {
        return { active: true, ssid };
      }
    }
    await sleep(500, signal);
  }
  return { active: false, ssid: null };
}
function sleep(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
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

// src/services/captivePortal.ts
var APPLE_CAPTIVE_URL = "http://captive.apple.com/hotspot-detect.html";
var SUCCESS_BODY = "Success";
async function detectCaptivePortal(timeoutMs = 5e3, outerSignal) {
  const inner = new AbortController();
  const timer = setTimeout(() => inner.abort(), timeoutMs);
  outerSignal?.addEventListener("abort", () => inner.abort(), { once: true });
  try {
    const url = `${APPLE_CAPTIVE_URL}?t=${Date.now()}`;
    const res = await fetch(url, {
      signal: inner.signal,
      redirect: "manual",
      headers: { "User-Agent": "CaptiveNetworkSupport-419 wispr" }
    });
    if (res.status >= 300 && res.status < 400) return "captive";
    if (res.status !== 200) return "captive";
    const text = (await res.text()).trim();
    return text.includes(SUCCESS_BODY) ? "open" : "captive";
  } catch {
    return "no-internet";
  } finally {
    clearTimeout(timer);
  }
}

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

// src/storage/durationStats.ts
var import_api2 = require("@raycast/api");
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
      await import_api2.LocalStorage.setItem(
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
  const raw = await import_api2.LocalStorage.getItem(keyFor(mode, interfaceName));
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

// src/hooks/useCompareNetworks.ts
var PROGRESS_TICK_MS = 250;
var SWITCH_TIMEOUT_MS = 2e4;
var CAPTIVE_PROBE_TIMEOUT_MS = 4e3;
function useCompareNetworks(options = {}) {
  const { mode = "parallel" } = options;
  const historyRef = (0, import_react.useRef)(
    options.history ?? createHistoryStore()
  );
  const statsRef = (0, import_react.useRef)(
    options.durationStats ?? createDurationStats()
  );
  const abortRef = (0, import_react.useRef)(null);
  const timerRef = (0, import_react.useRef)(null);
  const [interfaces, setInterfaces] = (0, import_react.useState)([]);
  const [knownWifi, setKnownWifi] = (0, import_react.useState)([]);
  const [isDiscovering, setIsDiscovering] = (0, import_react.useState)(true);
  const [state, setState] = (0, import_react.useState)({
    runId: (0, import_node_crypto.randomUUID)(),
    mode,
    items: [],
    activeIndex: -1,
    status: "idle",
    originalSSID: null,
    didRestore: false
  });
  const refreshInterfaces = (0, import_react.useCallback)(async () => {
    setIsDiscovering(true);
    try {
      const [ifaces, known] = await Promise.all([
        getActiveInterfaces(),
        listKnownWifiNetworks()
      ]);
      setInterfaces(ifaces);
      const activeSSIDs = new Set(
        ifaces.map((i) => i.ssid).filter((s) => s !== null)
      );
      setKnownWifi(known.filter((s) => !activeSSIDs.has(s)));
    } finally {
      setIsDiscovering(false);
    }
  }, []);
  (0, import_react.useEffect)(() => {
    void refreshInterfaces();
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterfaces]);
  const stopTimer = (0, import_react.useCallback)(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const cancel = (0, import_react.useCallback)(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();
    setState((prev) => ({ ...prev, status: "cancelled", activeIndex: -1 }));
  }, [stopTimer]);
  const run = (0, import_react.useCallback)(
    async (targets) => {
      if (targets.length === 0) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = (0, import_node_crypto.randomUUID)();
      const wifiDevice = await getWifiDevice();
      const originalSSID = wifiDevice ? await getCurrentWifiSSID() : null;
      if (controller.signal.aborted) return;
      const items = targets.map((t) => ({
        target: t,
        iface: t.kind === "active" ? t.iface : syntheticWifiInterface(t.ssid, wifiDevice),
        status: "pending",
        result: null,
        error: null,
        progress: null
      }));
      setState({
        runId,
        mode,
        items,
        activeIndex: -1,
        status: "running",
        originalSSID,
        didRestore: false
      });
      for (let i = 0; i < items.length; i++) {
        if (controller.signal.aborted) break;
        const item = items[i];
        const target = item.target;
        setState((prev) => ({ ...prev, activeIndex: i }));
        if (target.kind === "knownWifi") {
          if (!wifiDevice) {
            patchItem(setState, i, {
              status: "error",
              error: "No Wi-Fi adapter found."
            });
            continue;
          }
          patchItem(setState, i, { status: "switching" });
          try {
            await switchWifiTo(wifiDevice, target.ssid, controller.signal);
            const { active } = await waitForWifiReady(
              wifiDevice,
              target.ssid,
              SWITCH_TIMEOUT_MS,
              controller.signal
            );
            if (controller.signal.aborted) break;
            if (!active) {
              patchItem(setState, i, {
                status: "unreachable",
                error: `${target.ssid} did not come up within ${SWITCH_TIMEOUT_MS / 1e3}s.`
              });
              continue;
            }
          } catch (err) {
            if (controller.signal.aborted) break;
            patchItem(setState, i, {
              status: "unreachable",
              error: err instanceof Error ? err.message : String(err)
            });
            continue;
          }
          const captiveResult = await detectCaptivePortal(
            CAPTIVE_PROBE_TIMEOUT_MS,
            controller.signal
          );
          if (controller.signal.aborted) break;
          if (captiveResult === "captive") {
            patchItem(setState, i, {
              status: "captive",
              error: "Captive portal detected \u2014 sign in via browser before testing this network."
            });
            continue;
          }
          if (captiveResult === "no-internet") {
            patchItem(setState, i, {
              status: "unreachable",
              error: "Connected but no internet reachable."
            });
            continue;
          }
        }
        const startedAt = Date.now();
        const estimatedMs = await statsRef.current.estimate(mode, item.iface.name) ?? FALLBACK_ESTIMATE_MS[mode];
        patchItem(setState, i, {
          status: "running",
          progress: computeProgress(0, estimatedMs)
        });
        startProgressTimer(i, startedAt, estimatedMs, setState);
        const entryId = (0, import_node_crypto.randomUUID)();
        try {
          const result = await runNetworkTest(mode, {
            interfaceName: item.iface.name,
            signal: controller.signal
          });
          if (controller.signal.aborted) break;
          stopTimer();
          const finishedAt = Date.now();
          const durationMs = finishedAt - startedAt;
          await statsRef.current.record(mode, item.iface.name, durationMs);
          await persistHistory(historyRef.current, {
            id: entryId,
            startedAt,
            finishedAt,
            durationMs,
            mode,
            interface: item.iface,
            result,
            error: null,
            compareRunId: runId
          });
          patchItem(setState, i, {
            status: "done",
            result,
            progress: null
          });
        } catch (err) {
          if (controller.signal.aborted) break;
          stopTimer();
          const message = err instanceof NetworkTestError ? err.message : err instanceof Error ? err.message : "Unknown error";
          await persistHistory(historyRef.current, {
            id: entryId,
            startedAt,
            finishedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            mode,
            interface: item.iface,
            result: null,
            error: message,
            compareRunId: runId
          });
          patchItem(setState, i, {
            status: "error",
            error: message,
            progress: null
          });
        }
      }
      stopTimer();
      let didRestore = false;
      const involvedSwitching = targets.some((t) => t.kind === "knownWifi");
      if (involvedSwitching && wifiDevice && originalSSID) {
        try {
          const current = await getCurrentWifiSSID();
          if (current !== originalSSID) {
            await switchWifiTo(wifiDevice, originalSSID);
            await waitForWifiReady(wifiDevice, originalSSID, SWITCH_TIMEOUT_MS);
          }
          didRestore = true;
        } catch {
        }
      }
      setState(
        (prev) => prev.status === "cancelled" ? { ...prev, didRestore } : { ...prev, activeIndex: -1, status: "done", didRestore }
      );
    },
    [mode, stopTimer]
  );
  const reset = (0, import_react.useCallback)(() => {
    abortRef.current?.abort();
    stopTimer();
    setState({
      runId: (0, import_node_crypto.randomUUID)(),
      mode,
      items: [],
      activeIndex: -1,
      status: "idle",
      originalSSID: null,
      didRestore: false
    });
  }, [mode, stopTimer]);
  function startProgressTimer(idx, startedAt, estimatedMs, setter) {
    stopTimer();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setter((prev) => ({
        ...prev,
        items: prev.items.map(
          (it, i) => i === idx && it.status === "running" ? { ...it, progress: computeProgress(elapsed, estimatedMs) } : it
        )
      }));
    }, PROGRESS_TICK_MS);
  }
  return {
    interfaces,
    knownWifi,
    isDiscovering,
    state,
    run,
    cancel,
    reset,
    refreshInterfaces
  };
}
function patchItem(setter, idx, patch) {
  setter((prev) => ({
    ...prev,
    items: prev.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
  }));
}
function syntheticWifiInterface(ssid, wifiDevice) {
  return {
    name: wifiDevice ?? "en0",
    type: "wifi",
    hardwarePort: "Wi-Fi",
    ssid,
    ipv4: null,
    active: false,
    isDefault: false,
    isHotspot: false
  };
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

// src/types.ts
function targetKey(t) {
  return t.kind === "active" ? `active:${t.iface.name}` : `wifi:${t.ssid}`;
}

// src/views/HistoryEntryDetail.tsx
var import_api4 = require("@raycast/api");

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
var import_api3 = require("@raycast/api");
var import_jsx_runtime = require("react/jsx-runtime");
function NetworkContextMetadata({ iface }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api3.Detail.Metadata.Label,
      {
        title: "Network",
        text: displayName(iface),
        icon: iconFor(iface)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api3.Detail.Metadata.Label, { title: "Interface", text: iface.name }),
    iface.ipv4 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api3.Detail.Metadata.Label, { title: "Local IP", text: iface.ipv4 }),
    iface.isDefault && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api3.Detail.Metadata.Label, { title: "Default route", text: "Yes" }),
    isSSIDPermissionMissing(iface) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_api3.Detail.Metadata.Label,
      {
        title: "Network name",
        text: "Grant Location Services to read SSID",
        icon: { source: import_api3.Icon.Info, tintColor: import_api3.Color.Yellow }
      }
    )
  ] });
}
function iconFor(iface) {
  if (iface.isHotspot) return import_api3.Icon.Mobile;
  switch (iface.type) {
    case "wifi":
      return import_api3.Icon.Wifi;
    case "ethernet":
      return import_api3.Icon.Plug;
    case "thunderbolt":
      return import_api3.Icon.Bolt;
    case "usb":
      return import_api3.Icon.Mobile;
    case "bluetooth":
      return import_api3.Icon.Bluetooth;
    case "other":
      return import_api3.Icon.Network;
  }
}

// src/views/HistoryEntryDetail.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function HistoryEntryDetail({ entry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_api4.Detail,
    {
      markdown: renderMarkdown(entry),
      metadata: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_api4.Detail.Metadata, { children: [
        entry.result?.downloadBps != null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.Detail.Metadata.TagList, { title: "Download", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.TagList.Item,
          {
            text: `${formatThroughput(entry.result.downloadBps)} \xB7 ${speedTierLabel(classifySpeed(entry.result.downloadBps))}`,
            color: speedTierColor(classifySpeed(entry.result.downloadBps)),
            icon: import_api4.Icon.ArrowDown
          }
        ) }),
        entry.result?.uploadBps != null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.Detail.Metadata.TagList, { title: "Upload", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.TagList.Item,
          {
            text: `${formatThroughput(entry.result.uploadBps)} \xB7 ${speedTierLabel(classifySpeed(entry.result.uploadBps))}`,
            color: speedTierColor(classifySpeed(entry.result.uploadBps)),
            icon: import_api4.Icon.ArrowUp
          }
        ) }),
        entry.result && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.Label,
          {
            title: "Latency",
            text: formatLatency(entry.result.baseRttMs),
            icon: import_api4.Icon.Gauge
          }
        ),
        entry.result?.responsivenessRpm != null && entry.result.responsivenessTier && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.Detail.Metadata.TagList, { title: "Responsiveness", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.TagList.Item,
          {
            text: formatResponsiveness(
              entry.result.responsivenessRpm,
              entry.result.responsivenessTier
            ),
            color: responsivenessColor(entry.result.responsivenessTier)
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.Detail.Metadata.Separator, {}),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NetworkContextMetadata, { iface: entry.interface }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.Detail.Metadata.Label, { title: "Mode", text: modeLabel(entry.mode) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.Label,
          {
            title: "Run duration",
            text: formatElapsed(entry.durationMs)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.Label,
          {
            title: "When",
            text: formatRelativeTime(entry.finishedAt)
          }
        ),
        entry.compareRunId && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_api4.Detail.Metadata.Label,
          {
            title: "Compare run",
            text: entry.compareRunId.slice(0, 8)
          }
        )
      ] }),
      actions: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_api4.ActionPanel, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_api4.Action.CopyToClipboard,
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
      return import_api4.Color.Green;
    case "medium":
      return import_api4.Color.Yellow;
    case "low":
      return import_api4.Color.Red;
  }
}
function speedTierColor(tier) {
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

// src/compare-networks.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function Command() {
  const { interfaces, knownWifi, isDiscovering, state, run, cancel, reset } = useCompareNetworks();
  const [selected, setSelected] = (0, import_react2.useState)(/* @__PURE__ */ new Set());
  const { push } = (0, import_api5.useNavigation)();
  const seededRef = (0, import_react2.useRef)(false);
  (0, import_react2.useEffect)(() => {
    if (!seededRef.current && interfaces.length > 0) {
      const initial = new Set(
        interfaces.map((i) => targetKey({ kind: "active", iface: i }))
      );
      setSelected(initial);
      seededRef.current = true;
    }
  }, [interfaces]);
  const isSelecting = state.status === "idle";
  const winners = (0, import_react2.useMemo)(() => computeWinners(state), [state]);
  const allTargets = (0, import_react2.useMemo)(() => {
    return [
      ...interfaces.map((i) => ({ kind: "active", iface: i })),
      ...knownWifi.map((ssid) => ({ kind: "knownWifi", ssid }))
    ];
  }, [interfaces, knownWifi]);
  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const selectedTargets = (0, import_react2.useMemo)(
    () => allTargets.filter((t) => selected.has(targetKey(t))),
    [allTargets, selected]
  );
  const handleRun = async () => {
    if (selectedTargets.length === 0) return;
    const confirmed = await confirmRun(selectedTargets);
    if (!confirmed) return;
    void run(selectedTargets);
  };
  const handleRunOne = async (t) => {
    const confirmed = await confirmRun([t]);
    if (!confirmed) return;
    void run([t]);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_api5.List,
    {
      isLoading: isDiscovering || state.status === "running",
      searchBarPlaceholder: searchPlaceholder(
        state,
        selected.size,
        allTargets.length
      ),
      children: isSelecting ? renderSelectionState({
        interfaces,
        knownWifi,
        selectedKeys: selected,
        isDiscovering,
        toggle,
        setSelected,
        allTargets,
        handleRun,
        handleRunOne,
        selectedCount: selectedTargets.length
      }) : renderRunningOrDoneState({
        state,
        winners,
        push,
        reset,
        cancel,
        handleRun: async () => {
          const same = state.items.map((it) => it.target);
          if (same.length === 0) return;
          const confirmed = await confirmRun(same);
          if (!confirmed) return;
          void run(same);
        }
      })
    }
  );
}
function renderSelectionState(args) {
  const {
    interfaces,
    knownWifi,
    selectedKeys,
    isDiscovering,
    toggle,
    setSelected,
    allTargets,
    handleRun,
    handleRunOne,
    selectedCount
  } = args;
  if (!isDiscovering && allTargets.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api5.List.EmptyView,
      {
        title: "Nothing to compare",
        description: "Connect to Wi-Fi or Ethernet to populate the list.",
        icon: import_api5.Icon.WifiDisabled
      }
    );
  }
  const renderItem = (t) => {
    const key = targetKey(t);
    const isSelected = selectedKeys.has(key);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api5.List.Item,
      {
        icon: isSelected ? { source: import_api5.Icon.CircleFilled, tintColor: import_api5.Color.Blue } : { source: import_api5.Icon.Circle, tintColor: import_api5.Color.SecondaryText },
        title: targetTitle(t),
        subtitle: targetSubtitle(t),
        accessories: targetAccessories(t, isSelected),
        actions: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api5.ActionPanel, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_api5.Action,
            {
              title: primaryActionTitle(selectedCount),
              icon: import_api5.Icon.Play,
              onAction: handleRun
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_api5.Action,
            {
              title: isSelected ? "Deselect" : "Select",
              icon: isSelected ? import_api5.Icon.Circle : import_api5.Icon.CircleFilled,
              shortcut: { modifiers: [], key: "space" },
              onAction: () => toggle(key)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_api5.Action,
            {
              title: "Test Just This One",
              icon: import_api5.Icon.Play,
              shortcut: { modifiers: ["cmd"], key: "r" },
              onAction: () => handleRunOne(t)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api5.ActionPanel.Section, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              import_api5.Action,
              {
                title: "Select All",
                icon: import_api5.Icon.CheckCircle,
                shortcut: { modifiers: ["cmd"], key: "a" },
                onAction: () => setSelected(new Set(allTargets.map((tt) => targetKey(tt))))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              import_api5.Action,
              {
                title: "Select Only Active",
                icon: import_api5.Icon.Network,
                shortcut: { modifiers: ["cmd", "shift"], key: "a" },
                onAction: () => setSelected(
                  new Set(
                    allTargets.filter((tt) => tt.kind === "active").map((tt) => targetKey(tt))
                  )
                )
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              import_api5.Action,
              {
                title: "Deselect All",
                icon: import_api5.Icon.Circle,
                shortcut: { modifiers: ["cmd", "shift"], key: "d" },
                onAction: () => setSelected(/* @__PURE__ */ new Set())
              }
            )
          ] })
        ] })
      },
      key
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    interfaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api5.List.Section,
      {
        title: "Active now",
        subtitle: "Tested in place \u2014 no switching needed",
        children: interfaces.map((iface) => renderItem({ kind: "active", iface }))
      }
    ),
    knownWifi.filter((s) => !isContinuityHotspotName(s)).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api5.List.Section,
      {
        title: "Known Wi-Fi networks",
        subtitle: `Switches Wi-Fi to each then restores (~${15 + 30}s per network)`,
        children: knownWifi.filter((s) => !isContinuityHotspotName(s)).map((ssid) => renderItem({ kind: "knownWifi", ssid }))
      }
    ),
    knownWifi.filter((s) => isContinuityHotspotName(s)).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_api5.List.Section,
      {
        title: "Personal Hotspots \u2014 manual activation only",
        subtitle: "iPhone/iPad hotspots use Continuity; activate via Wi-Fi menu, then re-open this command",
        children: knownWifi.filter((s) => isContinuityHotspotName(s)).map((ssid) => renderItem({ kind: "knownWifi", ssid }))
      }
    )
  ] });
}
function targetTitle(t) {
  return t.kind === "active" ? displayName(t.iface) : t.ssid;
}
function targetSubtitle(t) {
  if (t.kind === "active") {
    const parts = [];
    if (t.iface.ipv4) parts.push(t.iface.ipv4);
    parts.push(t.iface.name);
    if (t.iface.isDefault) parts.push("default route");
    return parts.join(" \xB7 ");
  }
  return "Saved Wi-Fi \xB7 will switch when testing";
}
function targetAccessories(t, isSelected) {
  const accs = [];
  if (t.kind === "active" && t.iface.isHotspot) {
    accs.push({ tag: { value: "Hotspot", color: import_api5.Color.Orange } });
  }
  if (t.kind === "knownWifi") {
    if (isContinuityHotspotName(t.ssid)) {
      accs.push({
        tag: { value: "Manual only", color: import_api5.Color.Yellow },
        tooltip: "iPhone/iPad Personal Hotspot. Activate via Wi-Fi menu bar first \u2014 networksetup can't trigger Continuity."
      });
    } else {
      accs.push({ tag: { value: "Switch", color: import_api5.Color.Purple } });
    }
  }
  accs.push({
    tag: {
      value: isSelected ? "Will test" : "Skip",
      color: isSelected ? import_api5.Color.Blue : import_api5.Color.SecondaryText
    }
  });
  return accs;
}
function primaryActionTitle(selectedCount) {
  if (selectedCount === 0) return "Select Networks First";
  if (selectedCount === 1) return "Test 1 Network";
  return `Compare ${selectedCount} Networks`;
}
async function confirmRun(targets) {
  const switchCount = targets.filter((t) => t.kind === "knownWifi").length;
  const activeCount = targets.length - switchCount;
  const estSec = activeCount * 30 + switchCount * (30 + 15);
  const restoreNote = switchCount > 0 ? " Will restore your current Wi-Fi after." : "";
  const lines = [];
  if (activeCount > 0)
    lines.push(
      `${activeCount} active interface${activeCount === 1 ? "" : "s"} (tested in place)`
    );
  if (switchCount > 0)
    lines.push(
      `${switchCount} known Wi-Fi network${switchCount === 1 ? "" : "s"} (requires switching)`
    );
  lines.push("");
  lines.push(`Estimated time: ~${formatDuration(estSec)}.${restoreNote}`);
  if (switchCount > 0) {
    lines.push("");
    lines.push("Will disrupt your current network connection.");
  }
  return (0, import_api5.confirmAlert)({
    title: switchCount > 0 ? "Start comparison?" : `Run on ${targets.length} network${targets.length === 1 ? "" : "s"}?`,
    message: lines.join("\n"),
    primaryAction: {
      title: "Start",
      style: switchCount > 0 ? import_api5.Alert.ActionStyle.Destructive : import_api5.Alert.ActionStyle.Default
    }
  });
}
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s}s`;
}
function renderRunningOrDoneState(args) {
  const { state, winners, push, reset, cancel, handleRun } = args;
  const isRunning = state.status === "running";
  const restoreNote = !isRunning && state.originalSSID ? state.didRestore ? `Restored Wi-Fi to ${state.originalSSID}` : `Did not restore Wi-Fi \u2014 manually switch back to ${state.originalSSID} if needed` : null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_api5.List.Section,
    {
      title: isRunning ? `Comparing ${state.items.length} network${state.items.length === 1 ? "" : "s"}\u2026` : `Results \xB7 ${modeLabel(state.mode)}`,
      subtitle: restoreNote ?? void 0,
      children: state.items.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_api5.List.Item,
        {
          icon: iconForItem(item, idx === state.activeIndex),
          title: titleForItem(item),
          subtitle: subtitleForItem(item),
          accessories: accessoriesForItem(item, winners),
          actions: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_api5.ActionPanel, { children: [
            item.status === "done" && item.result && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              import_api5.Action,
              {
                title: "Show Full Details",
                icon: import_api5.Icon.Eye,
                onAction: () => push(
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    HistoryEntryDetail,
                    {
                      entry: syntheticEntry(item, state.mode, state.runId)
                    }
                  )
                )
              }
            ),
            isRunning ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              import_api5.Action,
              {
                title: "Cancel Comparison",
                icon: import_api5.Icon.Stop,
                onAction: cancel
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_api5.Action,
                {
                  title: "Run Same Comparison Again",
                  icon: import_api5.Icon.ArrowClockwise,
                  shortcut: { modifiers: ["cmd"], key: "r" },
                  onAction: handleRun
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_api5.Action,
                {
                  title: "Pick Different Networks",
                  icon: import_api5.Icon.List,
                  shortcut: { modifiers: ["cmd"], key: "n" },
                  onAction: reset
                }
              )
            ] })
          ] })
        },
        targetKey(item.target)
      ))
    }
  ) });
}
function titleForItem(item) {
  if (item.target.kind === "knownWifi") return item.target.ssid;
  return displayName(item.target.iface);
}
function iconForItem(item, isActive) {
  if (item.status === "running" || item.status === "switching" || isActive) {
    return { source: import_api5.Icon.CircleProgress, tintColor: import_api5.Color.Blue };
  }
  if (item.status === "done") {
    return { source: import_api5.Icon.Checkmark, tintColor: import_api5.Color.Green };
  }
  if (item.status === "error") {
    return { source: import_api5.Icon.ExclamationMark, tintColor: import_api5.Color.Red };
  }
  if (item.status === "unreachable") {
    return { source: import_api5.Icon.WifiDisabled, tintColor: import_api5.Color.Orange };
  }
  if (item.status === "captive") {
    return { source: import_api5.Icon.Lock, tintColor: import_api5.Color.Yellow };
  }
  return { source: import_api5.Icon.Circle, tintColor: import_api5.Color.SecondaryText };
}
function subtitleForItem(item) {
  switch (item.status) {
    case "pending":
      return "Queued\u2026";
    case "switching":
      return item.target.kind === "knownWifi" ? `Switching Wi-Fi to ${item.target.ssid}\u2026` : "Switching\u2026";
    case "running":
      if (!item.progress) return "Starting test\u2026";
      return `${renderProgressBar(item.progress.fraction, 12)} ${formatElapsed(item.progress.elapsedMs)}${item.progress.overrun ? " (overrun)" : ""}`;
    case "done":
      return item.iface.name;
    case "error":
      return item.error ?? "Failed";
    case "unreachable":
      return item.error ?? "Network unreachable";
    case "captive":
      return "Captive portal \u2014 sign in manually";
  }
}
function computeWinners(state) {
  const done = state.items.filter((i) => i.status === "done" && i.result);
  const argMax = (key) => {
    let bestName = null;
    let bestVal = -Infinity;
    for (const item of done) {
      const v = item.result[key];
      if (v !== null && v > bestVal) {
        bestVal = v;
        bestName = targetKey(item.target);
      }
    }
    return bestName;
  };
  let bestLatency = null;
  let bestLatencyVal = Infinity;
  for (const item of done) {
    const v = item.result.baseRttMs;
    if (v !== null && v < bestLatencyVal) {
      bestLatencyVal = v;
      bestLatency = targetKey(item.target);
    }
  }
  return {
    download: argMax("downloadBps"),
    upload: argMax("uploadBps"),
    latency: bestLatency,
    responsiveness: argMax("responsivenessRpm")
  };
}
function accessoriesForItem(item, winners) {
  if (item.status !== "done" || !item.result) return [];
  const key = targetKey(item.target);
  const accs = [];
  if (item.result.downloadBps !== null) {
    const tier = classifySpeed(item.result.downloadBps);
    const isWinner = winners.download === key;
    accs.push({
      tag: {
        value: `\u2193 ${formatThroughput(item.result.downloadBps)}${isWinner ? " \u2605" : ""}`,
        color: isWinner ? import_api5.Color.Green : speedTierColor2(tier)
      },
      tooltip: `Download \xB7 ${speedTierLabel(tier)}${isWinner ? " \xB7 Best" : ""}`
    });
  }
  if (item.result.uploadBps !== null) {
    const tier = classifySpeed(item.result.uploadBps);
    const isWinner = winners.upload === key;
    accs.push({
      tag: {
        value: `\u2191 ${formatThroughput(item.result.uploadBps)}${isWinner ? " \u2605" : ""}`,
        color: isWinner ? import_api5.Color.Green : speedTierColor2(tier)
      },
      tooltip: `Upload \xB7 ${speedTierLabel(tier)}${isWinner ? " \xB7 Best" : ""}`
    });
  }
  if (item.result.baseRttMs !== null) {
    const isWinner = winners.latency === key;
    accs.push({
      tag: {
        value: `${formatLatency(item.result.baseRttMs)}${isWinner ? " \u2605" : ""}`,
        color: isWinner ? import_api5.Color.Green : void 0
      },
      tooltip: `Latency${isWinner ? " \xB7 Lowest" : ""}`
    });
  }
  return accs;
}
function speedTierColor2(tier) {
  switch (tier) {
    case "poor":
      return import_api5.Color.Red;
    case "ok":
      return import_api5.Color.Orange;
    case "good":
      return import_api5.Color.Yellow;
    case "great":
      return import_api5.Color.Green;
    case "excellent":
      return import_api5.Color.Blue;
  }
}
function syntheticEntry(item, mode, runId) {
  return {
    id: `${runId}-${targetKey(item.target)}`,
    startedAt: 0,
    finishedAt: item.result?.finishedAt ?? Date.now(),
    durationMs: 0,
    mode,
    interface: item.iface,
    result: item.result,
    error: item.error,
    compareRunId: runId
  };
}
function searchPlaceholder(state, selectedCount, totalCount) {
  if (state.status === "running") return "Running comparison\u2026";
  if (state.status === "done")
    return "Done \u2014 Cmd+R to repeat, Cmd+N to pick different networks";
  if (totalCount === 0) return "No networks available";
  return `${selectedCount}/${totalCount} selected \xB7 Space toggles, Enter runs`;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9jb21wYXJlLW5ldHdvcmtzLnRzeCIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL2hvb2tzL3VzZUNvbXBhcmVOZXR3b3Jrcy50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3NlcnZpY2VzL25ldHdvcmtRdWFsaXR5LnRzIiwgIi4uLy4uLy4uLy4uL3Byb2dyYW1taW5nL3JheWNhc3RFeHRlbnNpb25zL25ldHdvcmstdGVzdC9zcmMvc2VydmljZXMvaW50ZXJmYWNlcy50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3NlcnZpY2VzL2NhcHRpdmVQb3J0YWwudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9zdG9yYWdlL2hpc3RvcnlTdG9yZS50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3N0b3JhZ2UvZHVyYXRpb25TdGF0cy50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL2xpYi9mb3JtYXQudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9saWIvc3BlZWQudHMiLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy90eXBlcy50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3ZpZXdzL0hpc3RvcnlFbnRyeURldGFpbC50c3giLCAiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvbmV0d29yay10ZXN0L3NyYy9saWIvc3VtbWFyeS50cyIsICIuLi8uLi8uLi8uLi9wcm9ncmFtbWluZy9yYXljYXN0RXh0ZW5zaW9ucy9uZXR3b3JrLXRlc3Qvc3JjL3ZpZXdzL05ldHdvcmtCYWRnZS50c3giXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIEFjdGlvbixcbiAgQWN0aW9uUGFuZWwsXG4gIEFsZXJ0LFxuICBDb2xvcixcbiAgY29uZmlybUFsZXJ0LFxuICBJY29uLFxuICBMaXN0LFxuICB1c2VOYXZpZ2F0aW9uLFxufSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVJlZiwgdXNlU3RhdGUsIHR5cGUgUmVhY3RFbGVtZW50IH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyB1c2VDb21wYXJlTmV0d29ya3MgfSBmcm9tIFwiLi9ob29rcy91c2VDb21wYXJlTmV0d29ya3NcIjtcbmltcG9ydCB7IGRpc3BsYXlOYW1lLCBpc0NvbnRpbnVpdHlIb3RzcG90TmFtZSB9IGZyb20gXCIuL3NlcnZpY2VzL2ludGVyZmFjZXNcIjtcbmltcG9ydCB7XG4gIGZvcm1hdEVsYXBzZWQsXG4gIGZvcm1hdExhdGVuY3ksXG4gIGZvcm1hdFRocm91Z2hwdXQsXG4gIG1vZGVMYWJlbCxcbiAgcmVuZGVyUHJvZ3Jlc3NCYXIsXG59IGZyb20gXCIuL2xpYi9mb3JtYXRcIjtcbmltcG9ydCB7IGNsYXNzaWZ5U3BlZWQsIHNwZWVkVGllckxhYmVsIH0gZnJvbSBcIi4vbGliL3NwZWVkXCI7XG5pbXBvcnQge1xuICB0YXJnZXRLZXksXG4gIHR5cGUgQ29tcGFyZUl0ZW0sXG4gIHR5cGUgQ29tcGFyZVN0YXRlLFxuICB0eXBlIENvbXBhcmVUYXJnZXQsXG4gIHR5cGUgSGlzdG9yeUVudHJ5LFxuICB0eXBlIE5ldHdvcmtJbnRlcmZhY2UsXG4gIHR5cGUgU3BlZWRUaWVyLFxufSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHsgSGlzdG9yeUVudHJ5RGV0YWlsIH0gZnJvbSBcIi4vdmlld3MvSGlzdG9yeUVudHJ5RGV0YWlsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIENvbW1hbmQoKSB7XG4gIGNvbnN0IHsgaW50ZXJmYWNlcywga25vd25XaWZpLCBpc0Rpc2NvdmVyaW5nLCBzdGF0ZSwgcnVuLCBjYW5jZWwsIHJlc2V0IH0gPVxuICAgIHVzZUNvbXBhcmVOZXR3b3JrcygpO1xuICBjb25zdCBbc2VsZWN0ZWQsIHNldFNlbGVjdGVkXSA9IHVzZVN0YXRlPFNldDxzdHJpbmc+PihuZXcgU2V0KCkpO1xuICBjb25zdCB7IHB1c2ggfSA9IHVzZU5hdmlnYXRpb24oKTtcblxuICAvLyBTZWVkIHNlbGVjdGlvbiB3aXRoIGFsbCBhY3RpdmUgaW50ZXJmYWNlcyAobm90IGtub3duIHdpZmkpLCBvbmNlLlxuICBjb25zdCBzZWVkZWRSZWYgPSB1c2VSZWYoZmFsc2UpO1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghc2VlZGVkUmVmLmN1cnJlbnQgJiYgaW50ZXJmYWNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBpbml0aWFsID0gbmV3IFNldChcbiAgICAgICAgaW50ZXJmYWNlcy5tYXAoKGkpID0+IHRhcmdldEtleSh7IGtpbmQ6IFwiYWN0aXZlXCIsIGlmYWNlOiBpIH0pKSxcbiAgICAgICk7XG4gICAgICBzZXRTZWxlY3RlZChpbml0aWFsKTtcbiAgICAgIHNlZWRlZFJlZi5jdXJyZW50ID0gdHJ1ZTtcbiAgICB9XG4gIH0sIFtpbnRlcmZhY2VzXSk7XG5cbiAgY29uc3QgaXNTZWxlY3RpbmcgPSBzdGF0ZS5zdGF0dXMgPT09IFwiaWRsZVwiO1xuICBjb25zdCB3aW5uZXJzID0gdXNlTWVtbygoKSA9PiBjb21wdXRlV2lubmVycyhzdGF0ZSksIFtzdGF0ZV0pO1xuXG4gIGNvbnN0IGFsbFRhcmdldHMgPSB1c2VNZW1vPENvbXBhcmVUYXJnZXRbXT4oKCkgPT4ge1xuICAgIHJldHVybiBbXG4gICAgICAuLi5pbnRlcmZhY2VzLm1hcCgoaSkgPT4gKHsga2luZDogXCJhY3RpdmVcIiBhcyBjb25zdCwgaWZhY2U6IGkgfSkpLFxuICAgICAgLi4ua25vd25XaWZpLm1hcCgoc3NpZCkgPT4gKHsga2luZDogXCJrbm93bldpZmlcIiBhcyBjb25zdCwgc3NpZCB9KSksXG4gICAgXTtcbiAgfSwgW2ludGVyZmFjZXMsIGtub3duV2lmaV0pO1xuXG4gIGNvbnN0IHRvZ2dsZSA9IChrZXk6IHN0cmluZykgPT5cbiAgICBzZXRTZWxlY3RlZCgocHJldikgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldik7XG4gICAgICBpZiAobmV4dC5oYXMoa2V5KSkgbmV4dC5kZWxldGUoa2V5KTtcbiAgICAgIGVsc2UgbmV4dC5hZGQoa2V5KTtcbiAgICAgIHJldHVybiBuZXh0O1xuICAgIH0pO1xuXG4gIGNvbnN0IHNlbGVjdGVkVGFyZ2V0cyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gYWxsVGFyZ2V0cy5maWx0ZXIoKHQpID0+IHNlbGVjdGVkLmhhcyh0YXJnZXRLZXkodCkpKSxcbiAgICBbYWxsVGFyZ2V0cywgc2VsZWN0ZWRdLFxuICApO1xuXG4gIGNvbnN0IGhhbmRsZVJ1biA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoc2VsZWN0ZWRUYXJnZXRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgIGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IGNvbmZpcm1SdW4oc2VsZWN0ZWRUYXJnZXRzKTtcbiAgICBpZiAoIWNvbmZpcm1lZCkgcmV0dXJuO1xuICAgIHZvaWQgcnVuKHNlbGVjdGVkVGFyZ2V0cyk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUnVuT25lID0gYXN5bmMgKHQ6IENvbXBhcmVUYXJnZXQpID0+IHtcbiAgICBjb25zdCBjb25maXJtZWQgPSBhd2FpdCBjb25maXJtUnVuKFt0XSk7XG4gICAgaWYgKCFjb25maXJtZWQpIHJldHVybjtcbiAgICB2b2lkIHJ1bihbdF0pO1xuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPExpc3RcbiAgICAgIGlzTG9hZGluZz17aXNEaXNjb3ZlcmluZyB8fCBzdGF0ZS5zdGF0dXMgPT09IFwicnVubmluZ1wifVxuICAgICAgc2VhcmNoQmFyUGxhY2Vob2xkZXI9e3NlYXJjaFBsYWNlaG9sZGVyKFxuICAgICAgICBzdGF0ZSxcbiAgICAgICAgc2VsZWN0ZWQuc2l6ZSxcbiAgICAgICAgYWxsVGFyZ2V0cy5sZW5ndGgsXG4gICAgICApfVxuICAgID5cbiAgICAgIHtpc1NlbGVjdGluZ1xuICAgICAgICA/IHJlbmRlclNlbGVjdGlvblN0YXRlKHtcbiAgICAgICAgICAgIGludGVyZmFjZXMsXG4gICAgICAgICAgICBrbm93bldpZmksXG4gICAgICAgICAgICBzZWxlY3RlZEtleXM6IHNlbGVjdGVkLFxuICAgICAgICAgICAgaXNEaXNjb3ZlcmluZyxcbiAgICAgICAgICAgIHRvZ2dsZSxcbiAgICAgICAgICAgIHNldFNlbGVjdGVkLFxuICAgICAgICAgICAgYWxsVGFyZ2V0cyxcbiAgICAgICAgICAgIGhhbmRsZVJ1bixcbiAgICAgICAgICAgIGhhbmRsZVJ1bk9uZSxcbiAgICAgICAgICAgIHNlbGVjdGVkQ291bnQ6IHNlbGVjdGVkVGFyZ2V0cy5sZW5ndGgsXG4gICAgICAgICAgfSlcbiAgICAgICAgOiByZW5kZXJSdW5uaW5nT3JEb25lU3RhdGUoe1xuICAgICAgICAgICAgc3RhdGUsXG4gICAgICAgICAgICB3aW5uZXJzLFxuICAgICAgICAgICAgcHVzaCxcbiAgICAgICAgICAgIHJlc2V0LFxuICAgICAgICAgICAgY2FuY2VsLFxuICAgICAgICAgICAgaGFuZGxlUnVuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHNhbWUgPSBzdGF0ZS5pdGVtcy5tYXAoKGl0KSA9PiBpdC50YXJnZXQpO1xuICAgICAgICAgICAgICBpZiAoc2FtZS5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgICAgICAgY29uc3QgY29uZmlybWVkID0gYXdhaXQgY29uZmlybVJ1bihzYW1lKTtcbiAgICAgICAgICAgICAgaWYgKCFjb25maXJtZWQpIHJldHVybjtcbiAgICAgICAgICAgICAgdm9pZCBydW4oc2FtZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pfVxuICAgIDwvTGlzdD5cbiAgKTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU2VsZWN0aW9uIHN0YXRlXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHJlbmRlclNlbGVjdGlvblN0YXRlKGFyZ3M6IHtcbiAgaW50ZXJmYWNlczogTmV0d29ya0ludGVyZmFjZVtdO1xuICBrbm93bldpZmk6IHN0cmluZ1tdO1xuICBzZWxlY3RlZEtleXM6IFNldDxzdHJpbmc+O1xuICBpc0Rpc2NvdmVyaW5nOiBib29sZWFuO1xuICB0b2dnbGU6IChrZXk6IHN0cmluZykgPT4gdm9pZDtcbiAgc2V0U2VsZWN0ZWQ6IFJlYWN0LkRpc3BhdGNoPFJlYWN0LlNldFN0YXRlQWN0aW9uPFNldDxzdHJpbmc+Pj47XG4gIGFsbFRhcmdldHM6IENvbXBhcmVUYXJnZXRbXTtcbiAgaGFuZGxlUnVuOiAoKSA9PiB2b2lkO1xuICBoYW5kbGVSdW5PbmU6ICh0OiBDb21wYXJlVGFyZ2V0KSA9PiB2b2lkO1xuICBzZWxlY3RlZENvdW50OiBudW1iZXI7XG59KSB7XG4gIGNvbnN0IHtcbiAgICBpbnRlcmZhY2VzLFxuICAgIGtub3duV2lmaSxcbiAgICBzZWxlY3RlZEtleXMsXG4gICAgaXNEaXNjb3ZlcmluZyxcbiAgICB0b2dnbGUsXG4gICAgc2V0U2VsZWN0ZWQsXG4gICAgYWxsVGFyZ2V0cyxcbiAgICBoYW5kbGVSdW4sXG4gICAgaGFuZGxlUnVuT25lLFxuICAgIHNlbGVjdGVkQ291bnQsXG4gIH0gPSBhcmdzO1xuXG4gIGlmICghaXNEaXNjb3ZlcmluZyAmJiBhbGxUYXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAoXG4gICAgICA8TGlzdC5FbXB0eVZpZXdcbiAgICAgICAgdGl0bGU9XCJOb3RoaW5nIHRvIGNvbXBhcmVcIlxuICAgICAgICBkZXNjcmlwdGlvbj1cIkNvbm5lY3QgdG8gV2ktRmkgb3IgRXRoZXJuZXQgdG8gcG9wdWxhdGUgdGhlIGxpc3QuXCJcbiAgICAgICAgaWNvbj17SWNvbi5XaWZpRGlzYWJsZWR9XG4gICAgICAvPlxuICAgICk7XG4gIH1cblxuICBjb25zdCByZW5kZXJJdGVtID0gKHQ6IENvbXBhcmVUYXJnZXQpID0+IHtcbiAgICBjb25zdCBrZXkgPSB0YXJnZXRLZXkodCk7XG4gICAgY29uc3QgaXNTZWxlY3RlZCA9IHNlbGVjdGVkS2V5cy5oYXMoa2V5KTtcbiAgICByZXR1cm4gKFxuICAgICAgPExpc3QuSXRlbVxuICAgICAgICBrZXk9e2tleX1cbiAgICAgICAgaWNvbj17XG4gICAgICAgICAgaXNTZWxlY3RlZFxuICAgICAgICAgICAgPyB7IHNvdXJjZTogSWNvbi5DaXJjbGVGaWxsZWQsIHRpbnRDb2xvcjogQ29sb3IuQmx1ZSB9XG4gICAgICAgICAgICA6IHsgc291cmNlOiBJY29uLkNpcmNsZSwgdGludENvbG9yOiBDb2xvci5TZWNvbmRhcnlUZXh0IH1cbiAgICAgICAgfVxuICAgICAgICB0aXRsZT17dGFyZ2V0VGl0bGUodCl9XG4gICAgICAgIHN1YnRpdGxlPXt0YXJnZXRTdWJ0aXRsZSh0KX1cbiAgICAgICAgYWNjZXNzb3JpZXM9e3RhcmdldEFjY2Vzc29yaWVzKHQsIGlzU2VsZWN0ZWQpfVxuICAgICAgICBhY3Rpb25zPXtcbiAgICAgICAgICA8QWN0aW9uUGFuZWw+XG4gICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgIHRpdGxlPXtwcmltYXJ5QWN0aW9uVGl0bGUoc2VsZWN0ZWRDb3VudCl9XG4gICAgICAgICAgICAgIGljb249e0ljb24uUGxheX1cbiAgICAgICAgICAgICAgb25BY3Rpb249e2hhbmRsZVJ1bn1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgIHRpdGxlPXtpc1NlbGVjdGVkID8gXCJEZXNlbGVjdFwiIDogXCJTZWxlY3RcIn1cbiAgICAgICAgICAgICAgaWNvbj17aXNTZWxlY3RlZCA/IEljb24uQ2lyY2xlIDogSWNvbi5DaXJjbGVGaWxsZWR9XG4gICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW10sIGtleTogXCJzcGFjZVwiIH19XG4gICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PiB0b2dnbGUoa2V5KX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgIHRpdGxlPVwiVGVzdCBKdXN0IFRoaXMgT25lXCJcbiAgICAgICAgICAgICAgaWNvbj17SWNvbi5QbGF5fVxuICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcInJcIiB9fVxuICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gaGFuZGxlUnVuT25lKHQpfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxBY3Rpb25QYW5lbC5TZWN0aW9uPlxuICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgdGl0bGU9XCJTZWxlY3QgQWxsXCJcbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkNoZWNrQ2lyY2xlfVxuICAgICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCJdLCBrZXk6IFwiYVwiIH19XG4gICAgICAgICAgICAgICAgb25BY3Rpb249eygpID0+XG4gICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZChuZXcgU2V0KGFsbFRhcmdldHMubWFwKCh0dCkgPT4gdGFyZ2V0S2V5KHR0KSkpKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgICAgIHRpdGxlPVwiU2VsZWN0IE9ubHkgQWN0aXZlXCJcbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLk5ldHdvcmt9XG4gICAgICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIiwgXCJzaGlmdFwiXSwga2V5OiBcImFcIiB9fVxuICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWQoXG4gICAgICAgICAgICAgICAgICAgIG5ldyBTZXQoXG4gICAgICAgICAgICAgICAgICAgICAgYWxsVGFyZ2V0c1xuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigodHQpID0+IHR0LmtpbmQgPT09IFwiYWN0aXZlXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKCh0dCkgPT4gdGFyZ2V0S2V5KHR0KSksXG4gICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8QWN0aW9uXG4gICAgICAgICAgICAgICAgdGl0bGU9XCJEZXNlbGVjdCBBbGxcIlxuICAgICAgICAgICAgICAgIGljb249e0ljb24uQ2lyY2xlfVxuICAgICAgICAgICAgICAgIHNob3J0Y3V0PXt7IG1vZGlmaWVyczogW1wiY21kXCIsIFwic2hpZnRcIl0sIGtleTogXCJkXCIgfX1cbiAgICAgICAgICAgICAgICBvbkFjdGlvbj17KCkgPT4gc2V0U2VsZWN0ZWQobmV3IFNldCgpKX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQWN0aW9uUGFuZWwuU2VjdGlvbj5cbiAgICAgICAgICA8L0FjdGlvblBhbmVsPlxuICAgICAgICB9XG4gICAgICAvPlxuICAgICk7XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAge2ludGVyZmFjZXMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxMaXN0LlNlY3Rpb25cbiAgICAgICAgICB0aXRsZT1cIkFjdGl2ZSBub3dcIlxuICAgICAgICAgIHN1YnRpdGxlPVwiVGVzdGVkIGluIHBsYWNlIFx1MjAxNCBubyBzd2l0Y2hpbmcgbmVlZGVkXCJcbiAgICAgICAgPlxuICAgICAgICAgIHtpbnRlcmZhY2VzLm1hcCgoaWZhY2UpID0+IHJlbmRlckl0ZW0oeyBraW5kOiBcImFjdGl2ZVwiLCBpZmFjZSB9KSl9XG4gICAgICAgIDwvTGlzdC5TZWN0aW9uPlxuICAgICAgKX1cbiAgICAgIHtrbm93bldpZmkuZmlsdGVyKChzKSA9PiAhaXNDb250aW51aXR5SG90c3BvdE5hbWUocykpLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8TGlzdC5TZWN0aW9uXG4gICAgICAgICAgdGl0bGU9XCJLbm93biBXaS1GaSBuZXR3b3Jrc1wiXG4gICAgICAgICAgc3VidGl0bGU9e2BTd2l0Y2hlcyBXaS1GaSB0byBlYWNoIHRoZW4gcmVzdG9yZXMgKH4kezE1ICsgMzB9cyBwZXIgbmV0d29yaylgfVxuICAgICAgICA+XG4gICAgICAgICAge2tub3duV2lmaVxuICAgICAgICAgICAgLmZpbHRlcigocykgPT4gIWlzQ29udGludWl0eUhvdHNwb3ROYW1lKHMpKVxuICAgICAgICAgICAgLm1hcCgoc3NpZCkgPT4gcmVuZGVySXRlbSh7IGtpbmQ6IFwia25vd25XaWZpXCIsIHNzaWQgfSkpfVxuICAgICAgICA8L0xpc3QuU2VjdGlvbj5cbiAgICAgICl9XG4gICAgICB7a25vd25XaWZpLmZpbHRlcigocykgPT4gaXNDb250aW51aXR5SG90c3BvdE5hbWUocykpLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8TGlzdC5TZWN0aW9uXG4gICAgICAgICAgdGl0bGU9XCJQZXJzb25hbCBIb3RzcG90cyBcdTIwMTQgbWFudWFsIGFjdGl2YXRpb24gb25seVwiXG4gICAgICAgICAgc3VidGl0bGU9XCJpUGhvbmUvaVBhZCBob3RzcG90cyB1c2UgQ29udGludWl0eTsgYWN0aXZhdGUgdmlhIFdpLUZpIG1lbnUsIHRoZW4gcmUtb3BlbiB0aGlzIGNvbW1hbmRcIlxuICAgICAgICA+XG4gICAgICAgICAge2tub3duV2lmaVxuICAgICAgICAgICAgLmZpbHRlcigocykgPT4gaXNDb250aW51aXR5SG90c3BvdE5hbWUocykpXG4gICAgICAgICAgICAubWFwKChzc2lkKSA9PiByZW5kZXJJdGVtKHsga2luZDogXCJrbm93bldpZmlcIiwgc3NpZCB9KSl9XG4gICAgICAgIDwvTGlzdC5TZWN0aW9uPlxuICAgICAgKX1cbiAgICA8Lz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gdGFyZ2V0VGl0bGUodDogQ29tcGFyZVRhcmdldCk6IHN0cmluZyB7XG4gIHJldHVybiB0LmtpbmQgPT09IFwiYWN0aXZlXCIgPyBkaXNwbGF5TmFtZSh0LmlmYWNlKSA6IHQuc3NpZDtcbn1cblxuZnVuY3Rpb24gdGFyZ2V0U3VidGl0bGUodDogQ29tcGFyZVRhcmdldCk6IHN0cmluZyB7XG4gIGlmICh0LmtpbmQgPT09IFwiYWN0aXZlXCIpIHtcbiAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAodC5pZmFjZS5pcHY0KSBwYXJ0cy5wdXNoKHQuaWZhY2UuaXB2NCk7XG4gICAgcGFydHMucHVzaCh0LmlmYWNlLm5hbWUpO1xuICAgIGlmICh0LmlmYWNlLmlzRGVmYXVsdCkgcGFydHMucHVzaChcImRlZmF1bHQgcm91dGVcIik7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oXCIgXHUwMEI3IFwiKTtcbiAgfVxuICByZXR1cm4gXCJTYXZlZCBXaS1GaSBcdTAwQjcgd2lsbCBzd2l0Y2ggd2hlbiB0ZXN0aW5nXCI7XG59XG5cbmZ1bmN0aW9uIHRhcmdldEFjY2Vzc29yaWVzKFxuICB0OiBDb21wYXJlVGFyZ2V0LFxuICBpc1NlbGVjdGVkOiBib29sZWFuLFxuKTogTGlzdC5JdGVtLkFjY2Vzc29yeVtdIHtcbiAgY29uc3QgYWNjczogTGlzdC5JdGVtLkFjY2Vzc29yeVtdID0gW107XG4gIGlmICh0LmtpbmQgPT09IFwiYWN0aXZlXCIgJiYgdC5pZmFjZS5pc0hvdHNwb3QpIHtcbiAgICBhY2NzLnB1c2goeyB0YWc6IHsgdmFsdWU6IFwiSG90c3BvdFwiLCBjb2xvcjogQ29sb3IuT3JhbmdlIH0gfSk7XG4gIH1cbiAgaWYgKHQua2luZCA9PT0gXCJrbm93bldpZmlcIikge1xuICAgIGlmIChpc0NvbnRpbnVpdHlIb3RzcG90TmFtZSh0LnNzaWQpKSB7XG4gICAgICBhY2NzLnB1c2goe1xuICAgICAgICB0YWc6IHsgdmFsdWU6IFwiTWFudWFsIG9ubHlcIiwgY29sb3I6IENvbG9yLlllbGxvdyB9LFxuICAgICAgICB0b29sdGlwOlxuICAgICAgICAgIFwiaVBob25lL2lQYWQgUGVyc29uYWwgSG90c3BvdC4gQWN0aXZhdGUgdmlhIFdpLUZpIG1lbnUgYmFyIGZpcnN0IFx1MjAxNCBuZXR3b3Jrc2V0dXAgY2FuJ3QgdHJpZ2dlciBDb250aW51aXR5LlwiLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjY3MucHVzaCh7IHRhZzogeyB2YWx1ZTogXCJTd2l0Y2hcIiwgY29sb3I6IENvbG9yLlB1cnBsZSB9IH0pO1xuICAgIH1cbiAgfVxuICBhY2NzLnB1c2goe1xuICAgIHRhZzoge1xuICAgICAgdmFsdWU6IGlzU2VsZWN0ZWQgPyBcIldpbGwgdGVzdFwiIDogXCJTa2lwXCIsXG4gICAgICBjb2xvcjogaXNTZWxlY3RlZCA/IENvbG9yLkJsdWUgOiBDb2xvci5TZWNvbmRhcnlUZXh0LFxuICAgIH0sXG4gIH0pO1xuICByZXR1cm4gYWNjcztcbn1cblxuZnVuY3Rpb24gcHJpbWFyeUFjdGlvblRpdGxlKHNlbGVjdGVkQ291bnQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChzZWxlY3RlZENvdW50ID09PSAwKSByZXR1cm4gXCJTZWxlY3QgTmV0d29ya3MgRmlyc3RcIjtcbiAgaWYgKHNlbGVjdGVkQ291bnQgPT09IDEpIHJldHVybiBcIlRlc3QgMSBOZXR3b3JrXCI7XG4gIHJldHVybiBgQ29tcGFyZSAke3NlbGVjdGVkQ291bnR9IE5ldHdvcmtzYDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybVJ1bih0YXJnZXRzOiBDb21wYXJlVGFyZ2V0W10pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3Qgc3dpdGNoQ291bnQgPSB0YXJnZXRzLmZpbHRlcigodCkgPT4gdC5raW5kID09PSBcImtub3duV2lmaVwiKS5sZW5ndGg7XG4gIGNvbnN0IGFjdGl2ZUNvdW50ID0gdGFyZ2V0cy5sZW5ndGggLSBzd2l0Y2hDb3VudDtcbiAgY29uc3QgZXN0U2VjID0gYWN0aXZlQ291bnQgKiAzMCArIHN3aXRjaENvdW50ICogKDMwICsgMTUpO1xuICBjb25zdCByZXN0b3JlTm90ZSA9XG4gICAgc3dpdGNoQ291bnQgPiAwID8gXCIgV2lsbCByZXN0b3JlIHlvdXIgY3VycmVudCBXaS1GaSBhZnRlci5cIiA6IFwiXCI7XG5cbiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gIGlmIChhY3RpdmVDb3VudCA+IDApXG4gICAgbGluZXMucHVzaChcbiAgICAgIGAke2FjdGl2ZUNvdW50fSBhY3RpdmUgaW50ZXJmYWNlJHthY3RpdmVDb3VudCA9PT0gMSA/IFwiXCIgOiBcInNcIn0gKHRlc3RlZCBpbiBwbGFjZSlgLFxuICAgICk7XG4gIGlmIChzd2l0Y2hDb3VudCA+IDApXG4gICAgbGluZXMucHVzaChcbiAgICAgIGAke3N3aXRjaENvdW50fSBrbm93biBXaS1GaSBuZXR3b3JrJHtzd2l0Y2hDb3VudCA9PT0gMSA/IFwiXCIgOiBcInNcIn0gKHJlcXVpcmVzIHN3aXRjaGluZylgLFxuICAgICk7XG4gIGxpbmVzLnB1c2goXCJcIik7XG4gIGxpbmVzLnB1c2goYEVzdGltYXRlZCB0aW1lOiB+JHtmb3JtYXREdXJhdGlvbihlc3RTZWMpfS4ke3Jlc3RvcmVOb3RlfWApO1xuICBpZiAoc3dpdGNoQ291bnQgPiAwKSB7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgICBsaW5lcy5wdXNoKFwiV2lsbCBkaXNydXB0IHlvdXIgY3VycmVudCBuZXR3b3JrIGNvbm5lY3Rpb24uXCIpO1xuICB9XG5cbiAgcmV0dXJuIGNvbmZpcm1BbGVydCh7XG4gICAgdGl0bGU6XG4gICAgICBzd2l0Y2hDb3VudCA+IDBcbiAgICAgICAgPyBcIlN0YXJ0IGNvbXBhcmlzb24/XCJcbiAgICAgICAgOiBgUnVuIG9uICR7dGFyZ2V0cy5sZW5ndGh9IG5ldHdvcmske3RhcmdldHMubGVuZ3RoID09PSAxID8gXCJcIiA6IFwic1wifT9gLFxuICAgIG1lc3NhZ2U6IGxpbmVzLmpvaW4oXCJcXG5cIiksXG4gICAgcHJpbWFyeUFjdGlvbjoge1xuICAgICAgdGl0bGU6IFwiU3RhcnRcIixcbiAgICAgIHN0eWxlOlxuICAgICAgICBzd2l0Y2hDb3VudCA+IDBcbiAgICAgICAgICA/IEFsZXJ0LkFjdGlvblN0eWxlLkRlc3RydWN0aXZlXG4gICAgICAgICAgOiBBbGVydC5BY3Rpb25TdHlsZS5EZWZhdWx0LFxuICAgIH0sXG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmb3JtYXREdXJhdGlvbihzZWNvbmRzOiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoc2Vjb25kcyA8IDYwKSByZXR1cm4gYCR7c2Vjb25kc31zYDtcbiAgY29uc3QgbSA9IE1hdGguZmxvb3Ioc2Vjb25kcyAvIDYwKTtcbiAgY29uc3QgcyA9IHNlY29uZHMgJSA2MDtcbiAgcmV0dXJuIHMgPT09IDAgPyBgJHttfSBtaW5gIDogYCR7bX0gbWluICR7c31zYDtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUnVubmluZyAvIERvbmUgc3RhdGVcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gcmVuZGVyUnVubmluZ09yRG9uZVN0YXRlKGFyZ3M6IHtcbiAgc3RhdGU6IENvbXBhcmVTdGF0ZTtcbiAgd2lubmVyczogV2lubmVycztcbiAgcHVzaDogKGpzeDogUmVhY3RFbGVtZW50KSA9PiB2b2lkO1xuICByZXNldDogKCkgPT4gdm9pZDtcbiAgY2FuY2VsOiAoKSA9PiB2b2lkO1xuICBoYW5kbGVSdW46ICgpID0+IHZvaWQ7XG59KSB7XG4gIGNvbnN0IHsgc3RhdGUsIHdpbm5lcnMsIHB1c2gsIHJlc2V0LCBjYW5jZWwsIGhhbmRsZVJ1biB9ID0gYXJncztcbiAgY29uc3QgaXNSdW5uaW5nID0gc3RhdGUuc3RhdHVzID09PSBcInJ1bm5pbmdcIjtcbiAgY29uc3QgcmVzdG9yZU5vdGUgPVxuICAgICFpc1J1bm5pbmcgJiYgc3RhdGUub3JpZ2luYWxTU0lEXG4gICAgICA/IHN0YXRlLmRpZFJlc3RvcmVcbiAgICAgICAgPyBgUmVzdG9yZWQgV2ktRmkgdG8gJHtzdGF0ZS5vcmlnaW5hbFNTSUR9YFxuICAgICAgICA6IGBEaWQgbm90IHJlc3RvcmUgV2ktRmkgXHUyMDE0IG1hbnVhbGx5IHN3aXRjaCBiYWNrIHRvICR7c3RhdGUub3JpZ2luYWxTU0lEfSBpZiBuZWVkZWRgXG4gICAgICA6IG51bGw7XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPExpc3QuU2VjdGlvblxuICAgICAgICB0aXRsZT17XG4gICAgICAgICAgaXNSdW5uaW5nXG4gICAgICAgICAgICA/IGBDb21wYXJpbmcgJHtzdGF0ZS5pdGVtcy5sZW5ndGh9IG5ldHdvcmske3N0YXRlLml0ZW1zLmxlbmd0aCA9PT0gMSA/IFwiXCIgOiBcInNcIn1cdTIwMjZgXG4gICAgICAgICAgICA6IGBSZXN1bHRzIFx1MDBCNyAke21vZGVMYWJlbChzdGF0ZS5tb2RlKX1gXG4gICAgICAgIH1cbiAgICAgICAgc3VidGl0bGU9e3Jlc3RvcmVOb3RlID8/IHVuZGVmaW5lZH1cbiAgICAgID5cbiAgICAgICAge3N0YXRlLml0ZW1zLm1hcCgoaXRlbSwgaWR4KSA9PiAoXG4gICAgICAgICAgPExpc3QuSXRlbVxuICAgICAgICAgICAga2V5PXt0YXJnZXRLZXkoaXRlbS50YXJnZXQpfVxuICAgICAgICAgICAgaWNvbj17aWNvbkZvckl0ZW0oaXRlbSwgaWR4ID09PSBzdGF0ZS5hY3RpdmVJbmRleCl9XG4gICAgICAgICAgICB0aXRsZT17dGl0bGVGb3JJdGVtKGl0ZW0pfVxuICAgICAgICAgICAgc3VidGl0bGU9e3N1YnRpdGxlRm9ySXRlbShpdGVtKX1cbiAgICAgICAgICAgIGFjY2Vzc29yaWVzPXthY2Nlc3Nvcmllc0Zvckl0ZW0oaXRlbSwgd2lubmVycyl9XG4gICAgICAgICAgICBhY3Rpb25zPXtcbiAgICAgICAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgICAgICAgIHtpdGVtLnN0YXR1cyA9PT0gXCJkb25lXCIgJiYgaXRlbS5yZXN1bHQgJiYgKFxuICAgICAgICAgICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIlNob3cgRnVsbCBEZXRhaWxzXCJcbiAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5FeWV9XG4gICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgIHB1c2goXG4gICAgICAgICAgICAgICAgICAgICAgICA8SGlzdG9yeUVudHJ5RGV0YWlsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJ5PXtzeW50aGV0aWNFbnRyeShpdGVtLCBzdGF0ZS5tb2RlLCBzdGF0ZS5ydW5JZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPixcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7aXNSdW5uaW5nID8gKFxuICAgICAgICAgICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkNhbmNlbCBDb21wYXJpc29uXCJcbiAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5TdG9wfVxuICAgICAgICAgICAgICAgICAgICBvbkFjdGlvbj17Y2FuY2VsfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgPEFjdGlvblxuICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiUnVuIFNhbWUgQ29tcGFyaXNvbiBBZ2FpblwiXG4gICAgICAgICAgICAgICAgICAgICAgaWNvbj17SWNvbi5BcnJvd0Nsb2Nrd2lzZX1cbiAgICAgICAgICAgICAgICAgICAgICBzaG9ydGN1dD17eyBtb2RpZmllcnM6IFtcImNtZFwiXSwga2V5OiBcInJcIiB9fVxuICAgICAgICAgICAgICAgICAgICAgIG9uQWN0aW9uPXtoYW5kbGVSdW59XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDxBY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIlBpY2sgRGlmZmVyZW50IE5ldHdvcmtzXCJcbiAgICAgICAgICAgICAgICAgICAgICBpY29uPXtJY29uLkxpc3R9XG4gICAgICAgICAgICAgICAgICAgICAgc2hvcnRjdXQ9e3sgbW9kaWZpZXJzOiBbXCJjbWRcIl0sIGtleTogXCJuXCIgfX1cbiAgICAgICAgICAgICAgICAgICAgICBvbkFjdGlvbj17cmVzZXR9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L0FjdGlvblBhbmVsPlxuICAgICAgICAgICAgfVxuICAgICAgICAgIC8+XG4gICAgICAgICkpfVxuICAgICAgPC9MaXN0LlNlY3Rpb24+XG4gICAgPC8+XG4gICk7XG59XG5cbmZ1bmN0aW9uIHRpdGxlRm9ySXRlbShpdGVtOiBDb21wYXJlSXRlbSk6IHN0cmluZyB7XG4gIGlmIChpdGVtLnRhcmdldC5raW5kID09PSBcImtub3duV2lmaVwiKSByZXR1cm4gaXRlbS50YXJnZXQuc3NpZDtcbiAgcmV0dXJuIGRpc3BsYXlOYW1lKGl0ZW0udGFyZ2V0LmlmYWNlKTtcbn1cblxuZnVuY3Rpb24gaWNvbkZvckl0ZW0oaXRlbTogQ29tcGFyZUl0ZW0sIGlzQWN0aXZlOiBib29sZWFuKSB7XG4gIGlmIChpdGVtLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIgfHwgaXRlbS5zdGF0dXMgPT09IFwic3dpdGNoaW5nXCIgfHwgaXNBY3RpdmUpIHtcbiAgICByZXR1cm4geyBzb3VyY2U6IEljb24uQ2lyY2xlUHJvZ3Jlc3MsIHRpbnRDb2xvcjogQ29sb3IuQmx1ZSB9O1xuICB9XG4gIGlmIChpdGVtLnN0YXR1cyA9PT0gXCJkb25lXCIpIHtcbiAgICByZXR1cm4geyBzb3VyY2U6IEljb24uQ2hlY2ttYXJrLCB0aW50Q29sb3I6IENvbG9yLkdyZWVuIH07XG4gIH1cbiAgaWYgKGl0ZW0uc3RhdHVzID09PSBcImVycm9yXCIpIHtcbiAgICByZXR1cm4geyBzb3VyY2U6IEljb24uRXhjbGFtYXRpb25NYXJrLCB0aW50Q29sb3I6IENvbG9yLlJlZCB9O1xuICB9XG4gIGlmIChpdGVtLnN0YXR1cyA9PT0gXCJ1bnJlYWNoYWJsZVwiKSB7XG4gICAgcmV0dXJuIHsgc291cmNlOiBJY29uLldpZmlEaXNhYmxlZCwgdGludENvbG9yOiBDb2xvci5PcmFuZ2UgfTtcbiAgfVxuICBpZiAoaXRlbS5zdGF0dXMgPT09IFwiY2FwdGl2ZVwiKSB7XG4gICAgcmV0dXJuIHsgc291cmNlOiBJY29uLkxvY2ssIHRpbnRDb2xvcjogQ29sb3IuWWVsbG93IH07XG4gIH1cbiAgcmV0dXJuIHsgc291cmNlOiBJY29uLkNpcmNsZSwgdGludENvbG9yOiBDb2xvci5TZWNvbmRhcnlUZXh0IH07XG59XG5cbmZ1bmN0aW9uIHN1YnRpdGxlRm9ySXRlbShpdGVtOiBDb21wYXJlSXRlbSk6IHN0cmluZyB7XG4gIHN3aXRjaCAoaXRlbS5zdGF0dXMpIHtcbiAgICBjYXNlIFwicGVuZGluZ1wiOlxuICAgICAgcmV0dXJuIFwiUXVldWVkXHUyMDI2XCI7XG4gICAgY2FzZSBcInN3aXRjaGluZ1wiOlxuICAgICAgcmV0dXJuIGl0ZW0udGFyZ2V0LmtpbmQgPT09IFwia25vd25XaWZpXCJcbiAgICAgICAgPyBgU3dpdGNoaW5nIFdpLUZpIHRvICR7aXRlbS50YXJnZXQuc3NpZH1cdTIwMjZgXG4gICAgICAgIDogXCJTd2l0Y2hpbmdcdTIwMjZcIjtcbiAgICBjYXNlIFwicnVubmluZ1wiOlxuICAgICAgaWYgKCFpdGVtLnByb2dyZXNzKSByZXR1cm4gXCJTdGFydGluZyB0ZXN0XHUyMDI2XCI7XG4gICAgICByZXR1cm4gYCR7cmVuZGVyUHJvZ3Jlc3NCYXIoaXRlbS5wcm9ncmVzcy5mcmFjdGlvbiwgMTIpfSAke2Zvcm1hdEVsYXBzZWQoaXRlbS5wcm9ncmVzcy5lbGFwc2VkTXMpfSR7aXRlbS5wcm9ncmVzcy5vdmVycnVuID8gXCIgKG92ZXJydW4pXCIgOiBcIlwifWA7XG4gICAgY2FzZSBcImRvbmVcIjpcbiAgICAgIHJldHVybiBpdGVtLmlmYWNlLm5hbWU7XG4gICAgY2FzZSBcImVycm9yXCI6XG4gICAgICByZXR1cm4gaXRlbS5lcnJvciA/PyBcIkZhaWxlZFwiO1xuICAgIGNhc2UgXCJ1bnJlYWNoYWJsZVwiOlxuICAgICAgcmV0dXJuIGl0ZW0uZXJyb3IgPz8gXCJOZXR3b3JrIHVucmVhY2hhYmxlXCI7XG4gICAgY2FzZSBcImNhcHRpdmVcIjpcbiAgICAgIHJldHVybiBcIkNhcHRpdmUgcG9ydGFsIFx1MjAxNCBzaWduIGluIG1hbnVhbGx5XCI7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFdpbm5lcnMge1xuICBkb3dubG9hZDogc3RyaW5nIHwgbnVsbDtcbiAgdXBsb2FkOiBzdHJpbmcgfCBudWxsO1xuICBsYXRlbmN5OiBzdHJpbmcgfCBudWxsO1xuICByZXNwb25zaXZlbmVzczogc3RyaW5nIHwgbnVsbDtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVdpbm5lcnMoc3RhdGU6IENvbXBhcmVTdGF0ZSk6IFdpbm5lcnMge1xuICBjb25zdCBkb25lID0gc3RhdGUuaXRlbXMuZmlsdGVyKChpKSA9PiBpLnN0YXR1cyA9PT0gXCJkb25lXCIgJiYgaS5yZXN1bHQpO1xuICBjb25zdCBhcmdNYXggPSAoa2V5OiBcImRvd25sb2FkQnBzXCIgfCBcInVwbG9hZEJwc1wiIHwgXCJyZXNwb25zaXZlbmVzc1JwbVwiKSA9PiB7XG4gICAgbGV0IGJlc3ROYW1lOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgYmVzdFZhbCA9IC1JbmZpbml0eTtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZG9uZSkge1xuICAgICAgY29uc3QgdiA9IGl0ZW0ucmVzdWx0IVtrZXldO1xuICAgICAgaWYgKHYgIT09IG51bGwgJiYgdiA+IGJlc3RWYWwpIHtcbiAgICAgICAgYmVzdFZhbCA9IHY7XG4gICAgICAgIGJlc3ROYW1lID0gdGFyZ2V0S2V5KGl0ZW0udGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJlc3ROYW1lO1xuICB9O1xuICBsZXQgYmVzdExhdGVuY3k6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBsZXQgYmVzdExhdGVuY3lWYWwgPSBJbmZpbml0eTtcbiAgZm9yIChjb25zdCBpdGVtIG9mIGRvbmUpIHtcbiAgICBjb25zdCB2ID0gaXRlbS5yZXN1bHQhLmJhc2VSdHRNcztcbiAgICBpZiAodiAhPT0gbnVsbCAmJiB2IDwgYmVzdExhdGVuY3lWYWwpIHtcbiAgICAgIGJlc3RMYXRlbmN5VmFsID0gdjtcbiAgICAgIGJlc3RMYXRlbmN5ID0gdGFyZ2V0S2V5KGl0ZW0udGFyZ2V0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBkb3dubG9hZDogYXJnTWF4KFwiZG93bmxvYWRCcHNcIiksXG4gICAgdXBsb2FkOiBhcmdNYXgoXCJ1cGxvYWRCcHNcIiksXG4gICAgbGF0ZW5jeTogYmVzdExhdGVuY3ksXG4gICAgcmVzcG9uc2l2ZW5lc3M6IGFyZ01heChcInJlc3BvbnNpdmVuZXNzUnBtXCIpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBhY2Nlc3Nvcmllc0Zvckl0ZW0oXG4gIGl0ZW06IENvbXBhcmVJdGVtLFxuICB3aW5uZXJzOiBXaW5uZXJzLFxuKTogTGlzdC5JdGVtLkFjY2Vzc29yeVtdIHtcbiAgaWYgKGl0ZW0uc3RhdHVzICE9PSBcImRvbmVcIiB8fCAhaXRlbS5yZXN1bHQpIHJldHVybiBbXTtcbiAgY29uc3Qga2V5ID0gdGFyZ2V0S2V5KGl0ZW0udGFyZ2V0KTtcbiAgY29uc3QgYWNjczogTGlzdC5JdGVtLkFjY2Vzc29yeVtdID0gW107XG5cbiAgaWYgKGl0ZW0ucmVzdWx0LmRvd25sb2FkQnBzICE9PSBudWxsKSB7XG4gICAgY29uc3QgdGllciA9IGNsYXNzaWZ5U3BlZWQoaXRlbS5yZXN1bHQuZG93bmxvYWRCcHMpO1xuICAgIGNvbnN0IGlzV2lubmVyID0gd2lubmVycy5kb3dubG9hZCA9PT0ga2V5O1xuICAgIGFjY3MucHVzaCh7XG4gICAgICB0YWc6IHtcbiAgICAgICAgdmFsdWU6IGBcdTIxOTMgJHtmb3JtYXRUaHJvdWdocHV0KGl0ZW0ucmVzdWx0LmRvd25sb2FkQnBzKX0ke2lzV2lubmVyID8gXCIgXHUyNjA1XCIgOiBcIlwifWAsXG4gICAgICAgIGNvbG9yOiBpc1dpbm5lciA/IENvbG9yLkdyZWVuIDogc3BlZWRUaWVyQ29sb3IodGllciksXG4gICAgICB9LFxuICAgICAgdG9vbHRpcDogYERvd25sb2FkIFx1MDBCNyAke3NwZWVkVGllckxhYmVsKHRpZXIpfSR7aXNXaW5uZXIgPyBcIiBcdTAwQjcgQmVzdFwiIDogXCJcIn1gLFxuICAgIH0pO1xuICB9XG4gIGlmIChpdGVtLnJlc3VsdC51cGxvYWRCcHMgIT09IG51bGwpIHtcbiAgICBjb25zdCB0aWVyID0gY2xhc3NpZnlTcGVlZChpdGVtLnJlc3VsdC51cGxvYWRCcHMpO1xuICAgIGNvbnN0IGlzV2lubmVyID0gd2lubmVycy51cGxvYWQgPT09IGtleTtcbiAgICBhY2NzLnB1c2goe1xuICAgICAgdGFnOiB7XG4gICAgICAgIHZhbHVlOiBgXHUyMTkxICR7Zm9ybWF0VGhyb3VnaHB1dChpdGVtLnJlc3VsdC51cGxvYWRCcHMpfSR7aXNXaW5uZXIgPyBcIiBcdTI2MDVcIiA6IFwiXCJ9YCxcbiAgICAgICAgY29sb3I6IGlzV2lubmVyID8gQ29sb3IuR3JlZW4gOiBzcGVlZFRpZXJDb2xvcih0aWVyKSxcbiAgICAgIH0sXG4gICAgICB0b29sdGlwOiBgVXBsb2FkIFx1MDBCNyAke3NwZWVkVGllckxhYmVsKHRpZXIpfSR7aXNXaW5uZXIgPyBcIiBcdTAwQjcgQmVzdFwiIDogXCJcIn1gLFxuICAgIH0pO1xuICB9XG4gIGlmIChpdGVtLnJlc3VsdC5iYXNlUnR0TXMgIT09IG51bGwpIHtcbiAgICBjb25zdCBpc1dpbm5lciA9IHdpbm5lcnMubGF0ZW5jeSA9PT0ga2V5O1xuICAgIGFjY3MucHVzaCh7XG4gICAgICB0YWc6IHtcbiAgICAgICAgdmFsdWU6IGAke2Zvcm1hdExhdGVuY3koaXRlbS5yZXN1bHQuYmFzZVJ0dE1zKX0ke2lzV2lubmVyID8gXCIgXHUyNjA1XCIgOiBcIlwifWAsXG4gICAgICAgIGNvbG9yOiBpc1dpbm5lciA/IENvbG9yLkdyZWVuIDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICAgIHRvb2x0aXA6IGBMYXRlbmN5JHtpc1dpbm5lciA/IFwiIFx1MDBCNyBMb3dlc3RcIiA6IFwiXCJ9YCxcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gYWNjcztcbn1cblxuZnVuY3Rpb24gc3BlZWRUaWVyQ29sb3IodGllcjogU3BlZWRUaWVyKTogQ29sb3Ige1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgcmV0dXJuIENvbG9yLlJlZDtcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHJldHVybiBDb2xvci5PcmFuZ2U7XG4gICAgY2FzZSBcImdvb2RcIjpcbiAgICAgIHJldHVybiBDb2xvci5ZZWxsb3c7XG4gICAgY2FzZSBcImdyZWF0XCI6XG4gICAgICByZXR1cm4gQ29sb3IuR3JlZW47XG4gICAgY2FzZSBcImV4Y2VsbGVudFwiOlxuICAgICAgcmV0dXJuIENvbG9yLkJsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3ludGhldGljRW50cnkoXG4gIGl0ZW06IENvbXBhcmVJdGVtLFxuICBtb2RlOiBDb21wYXJlU3RhdGVbXCJtb2RlXCJdLFxuICBydW5JZDogc3RyaW5nLFxuKTogSGlzdG9yeUVudHJ5IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogYCR7cnVuSWR9LSR7dGFyZ2V0S2V5KGl0ZW0udGFyZ2V0KX1gLFxuICAgIHN0YXJ0ZWRBdDogMCxcbiAgICBmaW5pc2hlZEF0OiBpdGVtLnJlc3VsdD8uZmluaXNoZWRBdCA/PyBEYXRlLm5vdygpLFxuICAgIGR1cmF0aW9uTXM6IDAsXG4gICAgbW9kZSxcbiAgICBpbnRlcmZhY2U6IGl0ZW0uaWZhY2UsXG4gICAgcmVzdWx0OiBpdGVtLnJlc3VsdCxcbiAgICBlcnJvcjogaXRlbS5lcnJvcixcbiAgICBjb21wYXJlUnVuSWQ6IHJ1bklkLFxuICB9O1xufVxuXG5mdW5jdGlvbiBzZWFyY2hQbGFjZWhvbGRlcihcbiAgc3RhdGU6IENvbXBhcmVTdGF0ZSxcbiAgc2VsZWN0ZWRDb3VudDogbnVtYmVyLFxuICB0b3RhbENvdW50OiBudW1iZXIsXG4pOiBzdHJpbmcge1xuICBpZiAoc3RhdGUuc3RhdHVzID09PSBcInJ1bm5pbmdcIikgcmV0dXJuIFwiUnVubmluZyBjb21wYXJpc29uXHUyMDI2XCI7XG4gIGlmIChzdGF0ZS5zdGF0dXMgPT09IFwiZG9uZVwiKVxuICAgIHJldHVybiBcIkRvbmUgXHUyMDE0IENtZCtSIHRvIHJlcGVhdCwgQ21kK04gdG8gcGljayBkaWZmZXJlbnQgbmV0d29ya3NcIjtcbiAgaWYgKHRvdGFsQ291bnQgPT09IDApIHJldHVybiBcIk5vIG5ldHdvcmtzIGF2YWlsYWJsZVwiO1xuICByZXR1cm4gYCR7c2VsZWN0ZWRDb3VudH0vJHt0b3RhbENvdW50fSBzZWxlY3RlZCBcdTAwQjcgU3BhY2UgdG9nZ2xlcywgRW50ZXIgcnVuc2A7XG59XG4iLCAiaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHsgTmV0d29ya1Rlc3RFcnJvciwgcnVuTmV0d29ya1Rlc3QgfSBmcm9tIFwiLi4vc2VydmljZXMvbmV0d29ya1F1YWxpdHlcIjtcbmltcG9ydCB7XG4gIGdldEFjdGl2ZUludGVyZmFjZXMsXG4gIGdldEN1cnJlbnRXaWZpU1NJRCxcbiAgZ2V0V2lmaURldmljZSxcbiAgbGlzdEtub3duV2lmaU5ldHdvcmtzLFxuICBzd2l0Y2hXaWZpVG8sXG4gIHdhaXRGb3JXaWZpUmVhZHksXG59IGZyb20gXCIuLi9zZXJ2aWNlcy9pbnRlcmZhY2VzXCI7XG5pbXBvcnQgeyBkZXRlY3RDYXB0aXZlUG9ydGFsIH0gZnJvbSBcIi4uL3NlcnZpY2VzL2NhcHRpdmVQb3J0YWxcIjtcbmltcG9ydCB7IGNyZWF0ZUhpc3RvcnlTdG9yZSwgdHlwZSBIaXN0b3J5U3RvcmUgfSBmcm9tIFwiLi4vc3RvcmFnZS9oaXN0b3J5U3RvcmVcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUR1cmF0aW9uU3RhdHMsXG4gIEZBTExCQUNLX0VTVElNQVRFX01TLFxuICB0eXBlIER1cmF0aW9uU3RhdHMsXG59IGZyb20gXCIuLi9zdG9yYWdlL2R1cmF0aW9uU3RhdHNcIjtcbmltcG9ydCB0eXBlIHtcbiAgQ29tcGFyZUl0ZW0sXG4gIENvbXBhcmVTdGF0ZSxcbiAgQ29tcGFyZVRhcmdldCxcbiAgSGlzdG9yeUVudHJ5LFxuICBOZXR3b3JrSW50ZXJmYWNlLFxuICBUZXN0TW9kZSxcbiAgVGVzdFBoYXNlLFxuICBUZXN0UHJvZ3Jlc3MsXG59IGZyb20gXCIuLi90eXBlc1wiO1xuXG5pbnRlcmZhY2UgVXNlQ29tcGFyZU9wdGlvbnMge1xuICBtb2RlPzogVGVzdE1vZGU7XG4gIGhpc3Rvcnk/OiBIaXN0b3J5U3RvcmU7XG4gIGR1cmF0aW9uU3RhdHM/OiBEdXJhdGlvblN0YXRzO1xufVxuXG5jb25zdCBQUk9HUkVTU19USUNLX01TID0gMjUwO1xuY29uc3QgU1dJVENIX1RJTUVPVVRfTVMgPSAyMF8wMDA7XG5jb25zdCBDQVBUSVZFX1BST0JFX1RJTUVPVVRfTVMgPSA0XzAwMDtcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUNvbXBhcmVOZXR3b3JrcyhvcHRpb25zOiBVc2VDb21wYXJlT3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IHsgbW9kZSA9IFwicGFyYWxsZWxcIiB9ID0gb3B0aW9ucztcbiAgY29uc3QgaGlzdG9yeVJlZiA9IHVzZVJlZjxIaXN0b3J5U3RvcmU+KFxuICAgIG9wdGlvbnMuaGlzdG9yeSA/PyBjcmVhdGVIaXN0b3J5U3RvcmUoKSxcbiAgKTtcbiAgY29uc3Qgc3RhdHNSZWYgPSB1c2VSZWY8RHVyYXRpb25TdGF0cz4oXG4gICAgb3B0aW9ucy5kdXJhdGlvblN0YXRzID8/IGNyZWF0ZUR1cmF0aW9uU3RhdHMoKSxcbiAgKTtcbiAgY29uc3QgYWJvcnRSZWYgPSB1c2VSZWY8QWJvcnRDb250cm9sbGVyIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHRpbWVyUmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldEludGVydmFsPiB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IFtpbnRlcmZhY2VzLCBzZXRJbnRlcmZhY2VzXSA9IHVzZVN0YXRlPE5ldHdvcmtJbnRlcmZhY2VbXT4oW10pO1xuICBjb25zdCBba25vd25XaWZpLCBzZXRLbm93bldpZmldID0gdXNlU3RhdGU8c3RyaW5nW10+KFtdKTtcbiAgY29uc3QgW2lzRGlzY292ZXJpbmcsIHNldElzRGlzY292ZXJpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtzdGF0ZSwgc2V0U3RhdGVdID0gdXNlU3RhdGU8Q29tcGFyZVN0YXRlPih7XG4gICAgcnVuSWQ6IHJhbmRvbVVVSUQoKSxcbiAgICBtb2RlLFxuICAgIGl0ZW1zOiBbXSxcbiAgICBhY3RpdmVJbmRleDogLTEsXG4gICAgc3RhdHVzOiBcImlkbGVcIixcbiAgICBvcmlnaW5hbFNTSUQ6IG51bGwsXG4gICAgZGlkUmVzdG9yZTogZmFsc2UsXG4gIH0pO1xuXG4gIGNvbnN0IHJlZnJlc2hJbnRlcmZhY2VzID0gdXNlQ2FsbGJhY2soYXN5bmMgKCkgPT4ge1xuICAgIHNldElzRGlzY292ZXJpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IFtpZmFjZXMsIGtub3duXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0QWN0aXZlSW50ZXJmYWNlcygpLFxuICAgICAgICBsaXN0S25vd25XaWZpTmV0d29ya3MoKSxcbiAgICAgIF0pO1xuICAgICAgc2V0SW50ZXJmYWNlcyhpZmFjZXMpO1xuICAgICAgLy8gRmlsdGVyIGtub3duIG5ldHdvcmtzOiBleGNsdWRlIFNTSURzIGFscmVhZHkgcmVwcmVzZW50ZWQgYnkgYW4gYWN0aXZlIGludGVyZmFjZVxuICAgICAgY29uc3QgYWN0aXZlU1NJRHMgPSBuZXcgU2V0KFxuICAgICAgICBpZmFjZXMubWFwKChpKSA9PiBpLnNzaWQpLmZpbHRlcigocyk6IHMgaXMgc3RyaW5nID0+IHMgIT09IG51bGwpLFxuICAgICAgKTtcbiAgICAgIHNldEtub3duV2lmaShrbm93bi5maWx0ZXIoKHMpID0+ICFhY3RpdmVTU0lEcy5oYXMocykpKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNEaXNjb3ZlcmluZyhmYWxzZSk7XG4gICAgfVxuICB9LCBbXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICB2b2lkIHJlZnJlc2hJbnRlcmZhY2VzKCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGFib3J0UmVmLmN1cnJlbnQ/LmFib3J0KCk7XG4gICAgICBpZiAodGltZXJSZWYuY3VycmVudCkgY2xlYXJJbnRlcnZhbCh0aW1lclJlZi5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbcmVmcmVzaEludGVyZmFjZXNdKTtcblxuICBjb25zdCBzdG9wVGltZXIgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKHRpbWVyUmVmLmN1cnJlbnQpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGltZXJSZWYuY3VycmVudCk7XG4gICAgICB0aW1lclJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gIH0sIFtdKTtcblxuICBjb25zdCBjYW5jZWwgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgYWJvcnRSZWYuY3VycmVudD8uYWJvcnQoKTtcbiAgICBhYm9ydFJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICBzdG9wVGltZXIoKTtcbiAgICBzZXRTdGF0ZSgocHJldikgPT4gKHsgLi4ucHJldiwgc3RhdHVzOiBcImNhbmNlbGxlZFwiLCBhY3RpdmVJbmRleDogLTEgfSkpO1xuICB9LCBbc3RvcFRpbWVyXSk7XG5cbiAgY29uc3QgcnVuID0gdXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKHRhcmdldHM6IENvbXBhcmVUYXJnZXRbXSkgPT4ge1xuICAgICAgaWYgKHRhcmdldHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICAgIGFib3J0UmVmLmN1cnJlbnQ/LmFib3J0KCk7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgYWJvcnRSZWYuY3VycmVudCA9IGNvbnRyb2xsZXI7XG4gICAgICBjb25zdCBydW5JZCA9IHJhbmRvbVVVSUQoKTtcblxuICAgICAgY29uc3Qgd2lmaURldmljZSA9IGF3YWl0IGdldFdpZmlEZXZpY2UoKTtcbiAgICAgIGNvbnN0IG9yaWdpbmFsU1NJRCA9IHdpZmlEZXZpY2UgPyBhd2FpdCBnZXRDdXJyZW50V2lmaVNTSUQoKSA6IG51bGw7XG4gICAgICBpZiAoY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBpdGVtczogQ29tcGFyZUl0ZW1bXSA9IHRhcmdldHMubWFwKCh0KSA9PiAoe1xuICAgICAgICB0YXJnZXQ6IHQsXG4gICAgICAgIGlmYWNlOlxuICAgICAgICAgIHQua2luZCA9PT0gXCJhY3RpdmVcIlxuICAgICAgICAgICAgPyB0LmlmYWNlXG4gICAgICAgICAgICA6IHN5bnRoZXRpY1dpZmlJbnRlcmZhY2UodC5zc2lkLCB3aWZpRGV2aWNlKSxcbiAgICAgICAgc3RhdHVzOiBcInBlbmRpbmdcIixcbiAgICAgICAgcmVzdWx0OiBudWxsLFxuICAgICAgICBlcnJvcjogbnVsbCxcbiAgICAgICAgcHJvZ3Jlc3M6IG51bGwsXG4gICAgICB9KSk7XG4gICAgICBzZXRTdGF0ZSh7XG4gICAgICAgIHJ1bklkLFxuICAgICAgICBtb2RlLFxuICAgICAgICBpdGVtcyxcbiAgICAgICAgYWN0aXZlSW5kZXg6IC0xLFxuICAgICAgICBzdGF0dXM6IFwicnVubmluZ1wiLFxuICAgICAgICBvcmlnaW5hbFNTSUQsXG4gICAgICAgIGRpZFJlc3RvcmU6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIGJyZWFrO1xuICAgICAgICBjb25zdCBpdGVtID0gaXRlbXNbaV07XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGl0ZW0udGFyZ2V0O1xuXG4gICAgICAgIHNldFN0YXRlKChwcmV2KSA9PiAoeyAuLi5wcmV2LCBhY3RpdmVJbmRleDogaSB9KSk7XG5cbiAgICAgICAgLy8gU3RlcCAxOiBzd2l0Y2ggV2ktRmkgaWYgbmVlZGVkXG4gICAgICAgIGlmICh0YXJnZXQua2luZCA9PT0gXCJrbm93bldpZmlcIikge1xuICAgICAgICAgIGlmICghd2lmaURldmljZSkge1xuICAgICAgICAgICAgcGF0Y2hJdGVtKHNldFN0YXRlLCBpLCB7XG4gICAgICAgICAgICAgIHN0YXR1czogXCJlcnJvclwiLFxuICAgICAgICAgICAgICBlcnJvcjogXCJObyBXaS1GaSBhZGFwdGVyIGZvdW5kLlwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGF0Y2hJdGVtKHNldFN0YXRlLCBpLCB7IHN0YXR1czogXCJzd2l0Y2hpbmdcIiB9KTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgc3dpdGNoV2lmaVRvKHdpZmlEZXZpY2UsIHRhcmdldC5zc2lkLCBjb250cm9sbGVyLnNpZ25hbCk7XG4gICAgICAgICAgICBjb25zdCB7IGFjdGl2ZSB9ID0gYXdhaXQgd2FpdEZvcldpZmlSZWFkeShcbiAgICAgICAgICAgICAgd2lmaURldmljZSxcbiAgICAgICAgICAgICAgdGFyZ2V0LnNzaWQsXG4gICAgICAgICAgICAgIFNXSVRDSF9USU1FT1VUX01TLFxuICAgICAgICAgICAgICBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgYnJlYWs7XG4gICAgICAgICAgICBpZiAoIWFjdGl2ZSkge1xuICAgICAgICAgICAgICBwYXRjaEl0ZW0oc2V0U3RhdGUsIGksIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IFwidW5yZWFjaGFibGVcIixcbiAgICAgICAgICAgICAgICBlcnJvcjogYCR7dGFyZ2V0LnNzaWR9IGRpZCBub3QgY29tZSB1cCB3aXRoaW4gJHtTV0lUQ0hfVElNRU9VVF9NUyAvIDEwMDB9cy5gLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoY29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgYnJlYWs7XG4gICAgICAgICAgICBwYXRjaEl0ZW0oc2V0U3RhdGUsIGksIHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBcInVucmVhY2hhYmxlXCIsXG4gICAgICAgICAgICAgIGVycm9yOiBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVyciksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFN0ZXAgMjogY2FwdGl2ZSBwb3J0YWwgY2hlY2tcbiAgICAgICAgICBjb25zdCBjYXB0aXZlUmVzdWx0ID0gYXdhaXQgZGV0ZWN0Q2FwdGl2ZVBvcnRhbChcbiAgICAgICAgICAgIENBUFRJVkVfUFJPQkVfVElNRU9VVF9NUyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIGJyZWFrO1xuICAgICAgICAgIGlmIChjYXB0aXZlUmVzdWx0ID09PSBcImNhcHRpdmVcIikge1xuICAgICAgICAgICAgcGF0Y2hJdGVtKHNldFN0YXRlLCBpLCB7XG4gICAgICAgICAgICAgIHN0YXR1czogXCJjYXB0aXZlXCIsXG4gICAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICAgIFwiQ2FwdGl2ZSBwb3J0YWwgZGV0ZWN0ZWQgXHUyMDE0IHNpZ24gaW4gdmlhIGJyb3dzZXIgYmVmb3JlIHRlc3RpbmcgdGhpcyBuZXR3b3JrLlwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNhcHRpdmVSZXN1bHQgPT09IFwibm8taW50ZXJuZXRcIikge1xuICAgICAgICAgICAgcGF0Y2hJdGVtKHNldFN0YXRlLCBpLCB7XG4gICAgICAgICAgICAgIHN0YXR1czogXCJ1bnJlYWNoYWJsZVwiLFxuICAgICAgICAgICAgICBlcnJvcjogXCJDb25uZWN0ZWQgYnV0IG5vIGludGVybmV0IHJlYWNoYWJsZS5cIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAzOiBydW4gdGhlIG5ldHdvcmsgdGVzdFxuICAgICAgICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgICAgICBjb25zdCBlc3RpbWF0ZWRNcyA9XG4gICAgICAgICAgKGF3YWl0IHN0YXRzUmVmLmN1cnJlbnQuZXN0aW1hdGUobW9kZSwgaXRlbS5pZmFjZS5uYW1lKSkgPz9cbiAgICAgICAgICBGQUxMQkFDS19FU1RJTUFURV9NU1ttb2RlXTtcblxuICAgICAgICBwYXRjaEl0ZW0oc2V0U3RhdGUsIGksIHtcbiAgICAgICAgICBzdGF0dXM6IFwicnVubmluZ1wiLFxuICAgICAgICAgIHByb2dyZXNzOiBjb21wdXRlUHJvZ3Jlc3MoMCwgZXN0aW1hdGVkTXMpLFxuICAgICAgICB9KTtcbiAgICAgICAgc3RhcnRQcm9ncmVzc1RpbWVyKGksIHN0YXJ0ZWRBdCwgZXN0aW1hdGVkTXMsIHNldFN0YXRlKTtcblxuICAgICAgICBjb25zdCBlbnRyeUlkID0gcmFuZG9tVVVJRCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bk5ldHdvcmtUZXN0KG1vZGUsIHtcbiAgICAgICAgICAgIGludGVyZmFjZU5hbWU6IGl0ZW0uaWZhY2UubmFtZSxcbiAgICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIGJyZWFrO1xuICAgICAgICAgIHN0b3BUaW1lcigpO1xuICAgICAgICAgIGNvbnN0IGZpbmlzaGVkQXQgPSBEYXRlLm5vdygpO1xuICAgICAgICAgIGNvbnN0IGR1cmF0aW9uTXMgPSBmaW5pc2hlZEF0IC0gc3RhcnRlZEF0O1xuICAgICAgICAgIGF3YWl0IHN0YXRzUmVmLmN1cnJlbnQucmVjb3JkKG1vZGUsIGl0ZW0uaWZhY2UubmFtZSwgZHVyYXRpb25Ncyk7XG4gICAgICAgICAgYXdhaXQgcGVyc2lzdEhpc3RvcnkoaGlzdG9yeVJlZi5jdXJyZW50LCB7XG4gICAgICAgICAgICBpZDogZW50cnlJZCxcbiAgICAgICAgICAgIHN0YXJ0ZWRBdCxcbiAgICAgICAgICAgIGZpbmlzaGVkQXQsXG4gICAgICAgICAgICBkdXJhdGlvbk1zLFxuICAgICAgICAgICAgbW9kZSxcbiAgICAgICAgICAgIGludGVyZmFjZTogaXRlbS5pZmFjZSxcbiAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgICAgY29tcGFyZVJ1bklkOiBydW5JZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwYXRjaEl0ZW0oc2V0U3RhdGUsIGksIHtcbiAgICAgICAgICAgIHN0YXR1czogXCJkb25lXCIsXG4gICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICBwcm9ncmVzczogbnVsbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIGJyZWFrO1xuICAgICAgICAgIHN0b3BUaW1lcigpO1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPVxuICAgICAgICAgICAgZXJyIGluc3RhbmNlb2YgTmV0d29ya1Rlc3RFcnJvclxuICAgICAgICAgICAgICA/IGVyci5tZXNzYWdlXG4gICAgICAgICAgICAgIDogZXJyIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgICAgICAgICAgICA/IGVyci5tZXNzYWdlXG4gICAgICAgICAgICAgICAgOiBcIlVua25vd24gZXJyb3JcIjtcbiAgICAgICAgICBhd2FpdCBwZXJzaXN0SGlzdG9yeShoaXN0b3J5UmVmLmN1cnJlbnQsIHtcbiAgICAgICAgICAgIGlkOiBlbnRyeUlkLFxuICAgICAgICAgICAgc3RhcnRlZEF0LFxuICAgICAgICAgICAgZmluaXNoZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIGR1cmF0aW9uTXM6IERhdGUubm93KCkgLSBzdGFydGVkQXQsXG4gICAgICAgICAgICBtb2RlLFxuICAgICAgICAgICAgaW50ZXJmYWNlOiBpdGVtLmlmYWNlLFxuICAgICAgICAgICAgcmVzdWx0OiBudWxsLFxuICAgICAgICAgICAgZXJyb3I6IG1lc3NhZ2UsXG4gICAgICAgICAgICBjb21wYXJlUnVuSWQ6IHJ1bklkLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHBhdGNoSXRlbShzZXRTdGF0ZSwgaSwge1xuICAgICAgICAgICAgc3RhdHVzOiBcImVycm9yXCIsXG4gICAgICAgICAgICBlcnJvcjogbWVzc2FnZSxcbiAgICAgICAgICAgIHByb2dyZXNzOiBudWxsLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHN0b3BUaW1lcigpO1xuXG4gICAgICAvLyBTdGVwIDQ6IHJlc3RvcmUgb3JpZ2luYWwgV2ktRmkgaWYgd2Ugc3dpdGNoZWRcbiAgICAgIGxldCBkaWRSZXN0b3JlID0gZmFsc2U7XG4gICAgICBjb25zdCBpbnZvbHZlZFN3aXRjaGluZyA9IHRhcmdldHMuc29tZSgodCkgPT4gdC5raW5kID09PSBcImtub3duV2lmaVwiKTtcbiAgICAgIGlmIChpbnZvbHZlZFN3aXRjaGluZyAmJiB3aWZpRGV2aWNlICYmIG9yaWdpbmFsU1NJRCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBhd2FpdCBnZXRDdXJyZW50V2lmaVNTSUQoKTtcbiAgICAgICAgICBpZiAoY3VycmVudCAhPT0gb3JpZ2luYWxTU0lEKSB7XG4gICAgICAgICAgICBhd2FpdCBzd2l0Y2hXaWZpVG8od2lmaURldmljZSwgb3JpZ2luYWxTU0lEKTtcbiAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JXaWZpUmVhZHkod2lmaURldmljZSwgb3JpZ2luYWxTU0lELCBTV0lUQ0hfVElNRU9VVF9NUyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRpZFJlc3RvcmUgPSB0cnVlO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBiZXN0LWVmZm9ydCByZXN0b3JlOyB1c2VyIGNhbiBzd2l0Y2ggYmFjayBtYW51YWxseVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNldFN0YXRlKChwcmV2KSA9PlxuICAgICAgICBwcmV2LnN0YXR1cyA9PT0gXCJjYW5jZWxsZWRcIlxuICAgICAgICAgID8geyAuLi5wcmV2LCBkaWRSZXN0b3JlIH1cbiAgICAgICAgICA6IHsgLi4ucHJldiwgYWN0aXZlSW5kZXg6IC0xLCBzdGF0dXM6IFwiZG9uZVwiLCBkaWRSZXN0b3JlIH0sXG4gICAgICApO1xuICAgIH0sXG4gICAgW21vZGUsIHN0b3BUaW1lcl0sXG4gICk7XG5cbiAgY29uc3QgcmVzZXQgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgYWJvcnRSZWYuY3VycmVudD8uYWJvcnQoKTtcbiAgICBzdG9wVGltZXIoKTtcbiAgICBzZXRTdGF0ZSh7XG4gICAgICBydW5JZDogcmFuZG9tVVVJRCgpLFxuICAgICAgbW9kZSxcbiAgICAgIGl0ZW1zOiBbXSxcbiAgICAgIGFjdGl2ZUluZGV4OiAtMSxcbiAgICAgIHN0YXR1czogXCJpZGxlXCIsXG4gICAgICBvcmlnaW5hbFNTSUQ6IG51bGwsXG4gICAgICBkaWRSZXN0b3JlOiBmYWxzZSxcbiAgICB9KTtcbiAgfSwgW21vZGUsIHN0b3BUaW1lcl0pO1xuXG4gIGZ1bmN0aW9uIHN0YXJ0UHJvZ3Jlc3NUaW1lcihcbiAgICBpZHg6IG51bWJlcixcbiAgICBzdGFydGVkQXQ6IG51bWJlcixcbiAgICBlc3RpbWF0ZWRNczogbnVtYmVyLFxuICAgIHNldHRlcjogUmVhY3QuRGlzcGF0Y2g8UmVhY3QuU2V0U3RhdGVBY3Rpb248Q29tcGFyZVN0YXRlPj4sXG4gICkge1xuICAgIHN0b3BUaW1lcigpO1xuICAgIHRpbWVyUmVmLmN1cnJlbnQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdDtcbiAgICAgIHNldHRlcigocHJldikgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgaXRlbXM6IHByZXYuaXRlbXMubWFwKChpdCwgaSkgPT5cbiAgICAgICAgICBpID09PSBpZHggJiYgaXQuc3RhdHVzID09PSBcInJ1bm5pbmdcIlxuICAgICAgICAgICAgPyB7IC4uLml0LCBwcm9ncmVzczogY29tcHV0ZVByb2dyZXNzKGVsYXBzZWQsIGVzdGltYXRlZE1zKSB9XG4gICAgICAgICAgICA6IGl0LFxuICAgICAgICApLFxuICAgICAgfSkpO1xuICAgIH0sIFBST0dSRVNTX1RJQ0tfTVMpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBpbnRlcmZhY2VzLFxuICAgIGtub3duV2lmaSxcbiAgICBpc0Rpc2NvdmVyaW5nLFxuICAgIHN0YXRlLFxuICAgIHJ1bixcbiAgICBjYW5jZWwsXG4gICAgcmVzZXQsXG4gICAgcmVmcmVzaEludGVyZmFjZXMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhdGNoSXRlbShcbiAgc2V0dGVyOiBSZWFjdC5EaXNwYXRjaDxSZWFjdC5TZXRTdGF0ZUFjdGlvbjxDb21wYXJlU3RhdGU+PixcbiAgaWR4OiBudW1iZXIsXG4gIHBhdGNoOiBQYXJ0aWFsPENvbXBhcmVJdGVtPixcbikge1xuICBzZXR0ZXIoKHByZXYpID0+ICh7XG4gICAgLi4ucHJldixcbiAgICBpdGVtczogcHJldi5pdGVtcy5tYXAoKGl0LCBpKSA9PiAoaSA9PT0gaWR4ID8geyAuLi5pdCwgLi4ucGF0Y2ggfSA6IGl0KSksXG4gIH0pKTtcbn1cblxuZnVuY3Rpb24gc3ludGhldGljV2lmaUludGVyZmFjZShcbiAgc3NpZDogc3RyaW5nLFxuICB3aWZpRGV2aWNlOiBzdHJpbmcgfCBudWxsLFxuKTogTmV0d29ya0ludGVyZmFjZSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogd2lmaURldmljZSA/PyBcImVuMFwiLFxuICAgIHR5cGU6IFwid2lmaVwiLFxuICAgIGhhcmR3YXJlUG9ydDogXCJXaS1GaVwiLFxuICAgIHNzaWQsXG4gICAgaXB2NDogbnVsbCxcbiAgICBhY3RpdmU6IGZhbHNlLFxuICAgIGlzRGVmYXVsdDogZmFsc2UsXG4gICAgaXNIb3RzcG90OiBmYWxzZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb2dyZXNzKFxuICBlbGFwc2VkTXM6IG51bWJlcixcbiAgZXN0aW1hdGVkVG90YWxNczogbnVtYmVyLFxuKTogVGVzdFByb2dyZXNzIHtcbiAgY29uc3QgcmF3RnJhY3Rpb24gPSBlbGFwc2VkTXMgLyBNYXRoLm1heCgxLCBlc3RpbWF0ZWRUb3RhbE1zKTtcbiAgY29uc3Qgb3ZlcnJ1biA9IHJhd0ZyYWN0aW9uID49IDE7XG4gIGNvbnN0IGZyYWN0aW9uID0gb3ZlcnJ1biA/IDAuOTcgOiBNYXRoLm1pbigwLjk3LCByYXdGcmFjdGlvbik7XG4gIHJldHVybiB7XG4gICAgcGhhc2U6IHBoYXNlRm9yKHJhd0ZyYWN0aW9uLCBvdmVycnVuKSxcbiAgICBlbGFwc2VkTXMsXG4gICAgZXN0aW1hdGVkVG90YWxNcyxcbiAgICBmcmFjdGlvbixcbiAgICBvdmVycnVuLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwaGFzZUZvcihyYXdGcmFjdGlvbjogbnVtYmVyLCBvdmVycnVuOiBib29sZWFuKTogVGVzdFBoYXNlIHtcbiAgaWYgKG92ZXJydW4pIHJldHVybiBcIm92ZXJydW5cIjtcbiAgaWYgKHJhd0ZyYWN0aW9uIDwgMC4xMikgcmV0dXJuIFwid2FybXVwXCI7XG4gIGlmIChyYXdGcmFjdGlvbiA8IDAuOSkgcmV0dXJuIFwibWVhc3VyaW5nXCI7XG4gIHJldHVybiBcImZpbmFsaXppbmdcIjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcGVyc2lzdEhpc3Rvcnkoc3RvcmU6IEhpc3RvcnlTdG9yZSwgZW50cnk6IEhpc3RvcnlFbnRyeSkge1xuICB0cnkge1xuICAgIGF3YWl0IHN0b3JlLmFwcGVuZChlbnRyeSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIG5ldmVyIGJyZWFrIGEgY29tcGFyZSBydW4gb24gaGlzdG9yeSBmYWlsdXJlXG4gIH1cbn1cbiIsICJpbXBvcnQgeyBleGVjRmlsZSB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJub2RlOnV0aWxcIjtcbmltcG9ydCB0eXBlIHsgTmV0d29ya1Rlc3RSZXN1bHQsIFJlc3BvbnNpdmVuZXNzVGllciwgVGVzdE1vZGUgfSBmcm9tIFwiLi4vdHlwZXNcIjtcblxuY29uc3QgZXhlY0ZpbGVBc3luYyA9IHByb21pc2lmeShleGVjRmlsZSk7XG5cbmNvbnN0IE5FVFdPUktRVUFMSVRZX0JJTiA9IFwiL3Vzci9iaW4vbmV0d29ya3F1YWxpdHlcIjtcbmNvbnN0IFRFU1RfVElNRU9VVF9NUyA9IDE4MF8wMDA7XG5cbmV4cG9ydCBjbGFzcyBOZXR3b3JrVGVzdEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgcHVibGljIHJlYWRvbmx5IGNhdXNlPzogdW5rbm93bixcbiAgICBwdWJsaWMgcmVhZG9ubHkgZGlhZ25vc3RpY3M/OiB7XG4gICAgICBzdGRvdXQ/OiBzdHJpbmc7XG4gICAgICBzdGRlcnI/OiBzdHJpbmc7XG4gICAgICBhcmdzPzogc3RyaW5nW107XG4gICAgfSxcbiAgKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJOZXR3b3JrVGVzdEVycm9yXCI7XG4gIH1cbn1cblxuLyoqXG4gKiBFcnJvcnMgdGhhdCBhcmUgbGlrZWx5IHRyYW5zaWVudCAobmV0d29yayBibGlwLCBzZXJ2ZXItc2lkZSByZWZ1c2FsKSB2cy5cbiAqIGRldGVybWluaXN0aWMgKG1pc3NpbmcgYmluYXJ5LCBiYWQgYXJnKS4gRHJpdmVzIHRoZSByZXRyeSBwb2xpY3kgaW4gdGhlIGhvb2suXG4gKi9cbmV4cG9ydCBjb25zdCBUUkFOU0lFTlRfRVJST1JfTUFSS0VSUyA9IFtcbiAgXCJubyB1c2FibGUgbWVhc3VyZW1lbnRzXCIsXG4gIFwiY291bGQgbm90IHBhcnNlXCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNUcmFuc2llbnRFcnJvcihlcnI6IHVua25vd24pOiBib29sZWFuIHtcbiAgaWYgKCEoZXJyIGluc3RhbmNlb2YgTmV0d29ya1Rlc3RFcnJvcikpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgbXNnID0gZXJyLm1lc3NhZ2UudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIFRSQU5TSUVOVF9FUlJPUl9NQVJLRVJTLnNvbWUoKG0pID0+IG1zZy5pbmNsdWRlcyhtKSk7XG59XG5cbmludGVyZmFjZSBSYXdOZXR3b3JrUXVhbGl0eUpzb24ge1xuICBkbF90aHJvdWdocHV0PzogbnVtYmVyO1xuICB1bF90aHJvdWdocHV0PzogbnVtYmVyO1xuICByZXNwb25zaXZlbmVzcz86IG51bWJlcjtcbiAgZGxfcmVzcG9uc2l2ZW5lc3M/OiBudW1iZXI7XG4gIHVsX3Jlc3BvbnNpdmVuZXNzPzogbnVtYmVyO1xuICBiYXNlX3J0dD86IG51bWJlcjtcbiAgaW50ZXJmYWNlX25hbWU/OiBzdHJpbmc7XG4gIHRlc3RfZW5kcG9pbnQ/OiBzdHJpbmc7XG4gIGVuZF9kYXRlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJ1blRlc3RPcHRpb25zIHtcbiAgLyoqIEJpbmQgbmV0d29ya3F1YWxpdHkgdG8gYSBzcGVjaWZpYyBpbnRlcmZhY2UgKC1JKS4gKi9cbiAgaW50ZXJmYWNlTmFtZT86IHN0cmluZztcbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5OZXR3b3JrVGVzdChcbiAgbW9kZTogVGVzdE1vZGUsXG4gIG9wdGlvbnM6IFJ1blRlc3RPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPE5ldHdvcmtUZXN0UmVzdWx0PiB7XG4gIGNvbnN0IGFyZ3MgPSBidWlsZEFyZ3MobW9kZSwgb3B0aW9ucy5pbnRlcmZhY2VOYW1lKTtcbiAgbGV0IHN0ZG91dDogc3RyaW5nO1xuICBsZXQgc3RkZXJyOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhlY0ZpbGVBc3luYyhORVRXT1JLUVVBTElUWV9CSU4sIGFyZ3MsIHtcbiAgICAgIHRpbWVvdXQ6IFRFU1RfVElNRU9VVF9NUyxcbiAgICAgIHNpZ25hbDogb3B0aW9ucy5zaWduYWwsXG4gICAgICBtYXhCdWZmZXI6IDQgKiAxMDI0ICogMTAyNCxcbiAgICB9KTtcbiAgICBzdGRvdXQgPSByZXN1bHQuc3Rkb3V0O1xuICAgIHN0ZGVyciA9IHJlc3VsdC5zdGRlcnI7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnN0IGUgPSBlcnIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uICYge1xuICAgICAgc3Rkb3V0Pzogc3RyaW5nO1xuICAgICAgc3RkZXJyPzogc3RyaW5nO1xuICAgIH07XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXG4gICAgICBcIm5ldHdvcmtxdWFsaXR5IGZhaWxlZCB0byBydW4uIFJlcXVpcmVzIG1hY09TIDEyKy5cIixcbiAgICAgIGVycixcbiAgICAgIHsgc3Rkb3V0OiBlLnN0ZG91dCwgc3RkZXJyOiBlLnN0ZGVyciwgYXJncyB9LFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcGFyc2VOZXR3b3JrUXVhbGl0eU91dHB1dChzdGRvdXQsIG1vZGUsIHsgc3RkZXJyLCBhcmdzIH0pO1xufVxuXG5mdW5jdGlvbiBidWlsZEFyZ3MobW9kZTogVGVzdE1vZGUsIGludGVyZmFjZU5hbWU/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGFyZ3M6IHN0cmluZ1tdID0gW1wiLWNcIl07XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgXCJwYXJhbGxlbFwiOlxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcInNlcXVlbnRpYWxcIjpcbiAgICAgIGFyZ3MucHVzaChcIi1zXCIpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBcImRvd25sb2FkXCI6XG4gICAgICBhcmdzLnB1c2goXCItdVwiKTsgLy8gc2tpcCB1cGxvYWRcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJ1cGxvYWRcIjpcbiAgICAgIGFyZ3MucHVzaChcIi1kXCIpOyAvLyBza2lwIGRvd25sb2FkXG4gICAgICBicmVhaztcbiAgfVxuICBpZiAoaW50ZXJmYWNlTmFtZSkgYXJncy5wdXNoKFwiLUlcIiwgaW50ZXJmYWNlTmFtZSk7XG4gIHJldHVybiBhcmdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VOZXR3b3JrUXVhbGl0eU91dHB1dChcbiAgc3Rkb3V0OiBzdHJpbmcsXG4gIG1vZGU6IFRlc3RNb2RlLFxuICBkaWFnbm9zdGljcz86IHsgc3RkZXJyPzogc3RyaW5nOyBhcmdzPzogc3RyaW5nW10gfSxcbik6IE5ldHdvcmtUZXN0UmVzdWx0IHtcbiAgbGV0IHJhdzogUmF3TmV0d29ya1F1YWxpdHlKc29uO1xuICB0cnkge1xuICAgIHJhdyA9IEpTT04ucGFyc2Uoc3Rkb3V0KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXCJDb3VsZCBub3QgcGFyc2UgbmV0d29ya3F1YWxpdHkgb3V0cHV0XCIsIGVyciwge1xuICAgICAgc3Rkb3V0LFxuICAgICAgLi4uZGlhZ25vc3RpY3MsXG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb3dubG9hZEJwcyA9IHRvTnVtYmVyT3JOdWxsKHJhdy5kbF90aHJvdWdocHV0KTtcbiAgY29uc3QgdXBsb2FkQnBzID0gdG9OdW1iZXJPck51bGwocmF3LnVsX3Rocm91Z2hwdXQpO1xuICBjb25zdCByZXNwb25zaXZlbmVzc1JwbSA9XG4gICAgdG9OdW1iZXJPck51bGwocmF3LnJlc3BvbnNpdmVuZXNzKSA/P1xuICAgIHRvTnVtYmVyT3JOdWxsKHJhdy5kbF9yZXNwb25zaXZlbmVzcykgPz9cbiAgICB0b051bWJlck9yTnVsbChyYXcudWxfcmVzcG9uc2l2ZW5lc3MpO1xuICBjb25zdCBiYXNlUnR0TXMgPSB0b051bWJlck9yTnVsbChyYXcuYmFzZV9ydHQpO1xuXG4gIGlmIChkb3dubG9hZEJwcyA9PT0gbnVsbCAmJiB1cGxvYWRCcHMgPT09IG51bGwgJiYgYmFzZVJ0dE1zID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IE5ldHdvcmtUZXN0RXJyb3IoXG4gICAgICBcIm5ldHdvcmtxdWFsaXR5IHJldHVybmVkIG5vIHVzYWJsZSBtZWFzdXJlbWVudHNcIixcbiAgICAgIHVuZGVmaW5lZCxcbiAgICAgIHsgc3Rkb3V0LCAuLi5kaWFnbm9zdGljcyB9LFxuICAgICk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIG1vZGUsXG4gICAgZG93bmxvYWRCcHMsXG4gICAgdXBsb2FkQnBzLFxuICAgIHJlc3BvbnNpdmVuZXNzUnBtLFxuICAgIHJlc3BvbnNpdmVuZXNzVGllcjpcbiAgICAgIHJlc3BvbnNpdmVuZXNzUnBtID09PSBudWxsXG4gICAgICAgID8gbnVsbFxuICAgICAgICA6IGNsYXNzaWZ5UmVzcG9uc2l2ZW5lc3MocmVzcG9uc2l2ZW5lc3NScG0pLFxuICAgIGJhc2VSdHRNcyxcbiAgICBpbnRlcmZhY2VOYW1lOiByYXcuaW50ZXJmYWNlX25hbWUgPz8gXCJ1bmtub3duXCIsXG4gICAgdGVzdEVuZHBvaW50OiByYXcudGVzdF9lbmRwb2ludCA/PyBcInVua25vd25cIixcbiAgICBmaW5pc2hlZEF0OiBwYXJzZUVuZERhdGUocmF3LmVuZF9kYXRlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdG9OdW1iZXJPck51bGwodmFsdWU6IHVua25vd24pOiBudW1iZXIgfCBudWxsIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiAmJiAhTnVtYmVyLmlzTmFOKHZhbHVlKSA/IHZhbHVlIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gY2xhc3NpZnlSZXNwb25zaXZlbmVzcyhycG06IG51bWJlcik6IFJlc3BvbnNpdmVuZXNzVGllciB7XG4gIGlmIChycG0gPj0gMTAwMCkgcmV0dXJuIFwiaGlnaFwiO1xuICBpZiAocnBtID49IDEwMCkgcmV0dXJuIFwibWVkaXVtXCI7XG4gIHJldHVybiBcImxvd1wiO1xufVxuXG5mdW5jdGlvbiBwYXJzZUVuZERhdGUodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gIGlmICghdmFsdWUpIHJldHVybiBEYXRlLm5vdygpO1xuICBjb25zdCBpc29pc2ggPSB2YWx1ZS5yZXBsYWNlKFwiIFwiLCBcIlRcIikgKyBcIlpcIjtcbiAgY29uc3QgdHMgPSBEYXRlLnBhcnNlKGlzb2lzaCk7XG4gIHJldHVybiBOdW1iZXIuaXNOYU4odHMpID8gRGF0ZS5ub3coKSA6IHRzO1xufVxuIiwgImltcG9ydCB7IGV4ZWNGaWxlIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSBcIm5vZGU6dXRpbFwiO1xuaW1wb3J0IHR5cGUgeyBJbnRlcmZhY2VUeXBlLCBOZXR3b3JrSW50ZXJmYWNlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IGV4ZWNGaWxlQXN5bmMgPSBwcm9taXNpZnkoZXhlY0ZpbGUpO1xuXG5jb25zdCBDTURfVElNRU9VVF9NUyA9IDRfMDAwO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBldmVyeSBCU0QgbmV0d29yayBkZXZpY2UsIGRlY29yYXRlIHdpdGggc3RhdHVzLCBJUCwgU1NJRCwgdHlwZS5cbiAqIFNvcnRlZDogYWN0aXZlIGZpcnN0LCBkZWZhdWx0IHJvdXRlIGZpcnN0IHdpdGhpbiBhY3RpdmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0SW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICBjb25zdCBbcG9ydHMsIGRlZmF1bHRJZmFjZV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgbGlzdEhhcmR3YXJlUG9ydHMoKSxcbiAgICBnZXREZWZhdWx0SW50ZXJmYWNlKCksXG4gIF0pO1xuXG4gIGNvbnN0IGRlY29yYXRlZCA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIHBvcnRzLm1hcChhc3luYyAocCkgPT4ge1xuICAgICAgY29uc3QgW2FjdGl2ZSwgaXB2NF0gPSBhd2FpdCByZWFkSWZjb25maWcocC5kZXZpY2UpO1xuICAgICAgY29uc3QgdHlwZSA9IGNsYXNzaWZ5VHlwZShwLmhhcmR3YXJlUG9ydCk7XG4gICAgICBjb25zdCBzc2lkID0gdHlwZSA9PT0gXCJ3aWZpXCIgPyBhd2FpdCByZWFkU1NJRChwLmRldmljZSkgOiBudWxsO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogcC5kZXZpY2UsXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGhhcmR3YXJlUG9ydDogcC5oYXJkd2FyZVBvcnQsXG4gICAgICAgIHNzaWQsXG4gICAgICAgIGlwdjQsXG4gICAgICAgIGFjdGl2ZSxcbiAgICAgICAgaXNEZWZhdWx0OiBwLmRldmljZSA9PT0gZGVmYXVsdElmYWNlLFxuICAgICAgICBpc0hvdHNwb3Q6IHR5cGUgPT09IFwid2lmaVwiICYmIGlzSG90c3BvdElwKGlwdjQpLFxuICAgICAgfSBzYXRpc2ZpZXMgTmV0d29ya0ludGVyZmFjZTtcbiAgICB9KSxcbiAgKTtcblxuICByZXR1cm4gZGVjb3JhdGVkLnNvcnQoY29tcGFyZUludGVyZmFjZXMpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QWN0aXZlSW50ZXJmYWNlcygpOiBQcm9taXNlPE5ldHdvcmtJbnRlcmZhY2VbXT4ge1xuICByZXR1cm4gKGF3YWl0IGxpc3RJbnRlcmZhY2VzKCkpLmZpbHRlcigoaSkgPT4gaS5hY3RpdmUpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGVmYXVsdEludGVyZmFjZURldGFpbHMoKTogUHJvbWlzZTxOZXR3b3JrSW50ZXJmYWNlIHwgbnVsbD4ge1xuICBjb25zdCBhbGwgPSBhd2FpdCBsaXN0SW50ZXJmYWNlcygpO1xuICByZXR1cm4gYWxsLmZpbmQoKGkpID0+IGkuaXNEZWZhdWx0KSA/PyBhbGwuZmluZCgoaSkgPT4gaS5hY3RpdmUpID8/IG51bGw7XG59XG5cbi8qKiBQcmV0dHktcHJpbnQ6IFwiV2ktRmkgXHUwMEI3IEhvbWVOZXRcIiBvciBcIkhvdHNwb3QgXHUwMEI3IGlQaG9uZVwiICovXG5leHBvcnQgZnVuY3Rpb24gZGlzcGxheU5hbWUoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBzdHJpbmcge1xuICBjb25zdCBwb3J0TGFiZWwgPSBwb3J0U2hvcnRMYWJlbChpZmFjZSk7XG4gIGlmIChpZmFjZS5zc2lkKSByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5zc2lkfWA7XG4gIGlmIChpZmFjZS5pc0hvdHNwb3QgJiYgaWZhY2UuaXB2NCkgcmV0dXJuIGAke3BvcnRMYWJlbH0gXHUwMEI3ICR7aWZhY2UuaXB2NH1gO1xuICBpZiAoaWZhY2UudHlwZSA9PT0gXCJ3aWZpXCIgJiYgaWZhY2UuYWN0aXZlKVxuICAgIHJldHVybiBgJHtwb3J0TGFiZWx9IFx1MDBCNyAobmFtZSB1bmF2YWlsYWJsZSlgO1xuICByZXR1cm4gYCR7cG9ydExhYmVsfSBcdTAwQjcgJHtpZmFjZS5uYW1lfWA7XG59XG5cbmZ1bmN0aW9uIHBvcnRTaG9ydExhYmVsKGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlKTogc3RyaW5nIHtcbiAgaWYgKGlmYWNlLmlzSG90c3BvdCkgcmV0dXJuIFwiSG90c3BvdFwiO1xuICBzd2l0Y2ggKGlmYWNlLnR5cGUpIHtcbiAgICBjYXNlIFwid2lmaVwiOlxuICAgICAgcmV0dXJuIFwiV2ktRmlcIjtcbiAgICBjYXNlIFwiZXRoZXJuZXRcIjpcbiAgICAgIHJldHVybiBcIkV0aGVybmV0XCI7XG4gICAgY2FzZSBcInRodW5kZXJib2x0XCI6XG4gICAgICByZXR1cm4gXCJUaHVuZGVyYm9sdFwiO1xuICAgIGNhc2UgXCJ1c2JcIjpcbiAgICAgIHJldHVybiAvaXBob25lL2kudGVzdChpZmFjZS5oYXJkd2FyZVBvcnQpID8gXCJpUGhvbmUgVVNCXCIgOiBcIlVTQlwiO1xuICAgIGNhc2UgXCJibHVldG9vdGhcIjpcbiAgICAgIHJldHVybiBcIkJsdWV0b290aFwiO1xuICAgIGNhc2UgXCJvdGhlclwiOlxuICAgICAgcmV0dXJuIGlmYWNlLmhhcmR3YXJlUG9ydDtcbiAgfVxufVxuXG4vKipcbiAqIEtub3duIHRldGhlcmluZyAvIFBlcnNvbmFsIEhvdHNwb3Qgc3VibmV0cy4gaVBob25lIFBlcnNvbmFsIEhvdHNwb3QgdXNlc1xuICogMTcyLjIwLjEwLjAvMjg7IGNvbW1vbiBBbmRyb2lkIHRldGhlcmluZyByYW5nZXMgYXJlIDE5Mi4xNjguNDMueCBhbmRcbiAqIDE5Mi4xNjguNDkueC4gVGhlc2UgYXJlIGRldmljZSBkZWZhdWx0cyBcdTIwMTQgc2F2dnkgdXNlcnMgY2FuIGNoYW5nZSB0aGVtXG4gKiBidXQgdmlydHVhbGx5IG5vYm9keSBkb2VzLlxuICovXG5jb25zdCBIT1RTUE9UX1BSRUZJWEVTID0gW1wiMTcyLjIwLjEwLlwiLCBcIjE5Mi4xNjguNDMuXCIsIFwiMTkyLjE2OC40OS5cIl07XG5cbmZ1bmN0aW9uIGlzSG90c3BvdElwKGlwdjQ6IHN0cmluZyB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCFpcHY0KSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBIT1RTUE9UX1BSRUZJWEVTLnNvbWUoKHApID0+IGlwdjQuc3RhcnRzV2l0aChwKSk7XG59XG5cbi8vIC0tLS0gbG93LWxldmVsIGNvbW1hbmQgd3JhcHBlcnMgLS0tLVxuXG5pbnRlcmZhY2UgSGFyZHdhcmVQb3J0IHtcbiAgaGFyZHdhcmVQb3J0OiBzdHJpbmc7XG4gIGRldmljZTogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsaXN0SGFyZHdhcmVQb3J0cygpOiBQcm9taXNlPEhhcmR3YXJlUG9ydFtdPiB7XG4gIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgIFwiL3Vzci9zYmluL25ldHdvcmtzZXR1cFwiLFxuICAgIFtcIi1saXN0YWxsaGFyZHdhcmVwb3J0c1wiXSxcbiAgICB7IHRpbWVvdXQ6IENNRF9USU1FT1VUX01TIH0sXG4gICk7XG5cbiAgY29uc3QgcG9ydHM6IEhhcmR3YXJlUG9ydFtdID0gW107XG4gIGxldCBjdXJyZW50UG9ydDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgcmF3TGluZSBvZiBzdGRvdXQuc3BsaXQoXCJcXG5cIikpIHtcbiAgICBjb25zdCBsaW5lID0gcmF3TGluZS50cmltKCk7XG4gICAgY29uc3QgcG9ydE1hdGNoID0gbGluZS5tYXRjaCgvXkhhcmR3YXJlIFBvcnQ6XFxzKiguKykkLyk7XG4gICAgaWYgKHBvcnRNYXRjaCkge1xuICAgICAgY3VycmVudFBvcnQgPSBwb3J0TWF0Y2hbMV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZGV2aWNlTWF0Y2ggPSBsaW5lLm1hdGNoKC9eRGV2aWNlOlxccyooXFxTKykkLyk7XG4gICAgaWYgKGRldmljZU1hdGNoICYmIGN1cnJlbnRQb3J0KSB7XG4gICAgICBwb3J0cy5wdXNoKHsgaGFyZHdhcmVQb3J0OiBjdXJyZW50UG9ydCwgZGV2aWNlOiBkZXZpY2VNYXRjaFsxXSB9KTtcbiAgICAgIGN1cnJlbnRQb3J0ID0gbnVsbDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBvcnRzO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXREZWZhdWx0SW50ZXJmYWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvc2Jpbi9yb3V0ZVwiLFxuICAgICAgW1wiLW5cIiwgXCJnZXRcIiwgXCJkZWZhdWx0XCJdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqaW50ZXJmYWNlOlxccyooXFxTKykvbSk7XG4gICAgcmV0dXJuIG1hdGNoPy5bMV0gPz8gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqIFJldHVybnMgW2FjdGl2ZSwgaXB2NE9yTnVsbF0uIEFjdGl2ZSA9IFwic3RhdHVzOiBhY3RpdmVcIiArIGhhcyBpbmV0IGxpbmUuICovXG5hc3luYyBmdW5jdGlvbiByZWFkSWZjb25maWcoZGV2aWNlOiBzdHJpbmcpOiBQcm9taXNlPFtib29sZWFuLCBzdHJpbmcgfCBudWxsXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFwiL3NiaW4vaWZjb25maWdcIiwgW2RldmljZV0sIHtcbiAgICAgIHRpbWVvdXQ6IENNRF9USU1FT1VUX01TLFxuICAgIH0pO1xuICAgIGNvbnN0IGlwdjRNYXRjaCA9IHN0ZG91dC5tYXRjaCgvXlxccyppbmV0XFxzKyhcXGQrXFwuXFxkK1xcLlxcZCtcXC5cXGQrKVxcYi9tKTtcbiAgICBjb25zdCBzdGF0dXNBY3RpdmUgPSAvXFxic3RhdHVzOlxccyphY3RpdmVcXGIvLnRlc3Qoc3Rkb3V0KTtcbiAgICBjb25zdCBhY3RpdmUgPSBzdGF0dXNBY3RpdmUgJiYgaXB2NE1hdGNoICE9PSBudWxsO1xuICAgIHJldHVybiBbYWN0aXZlLCBpcHY0TWF0Y2g/LlsxXSA/PyBudWxsXTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtmYWxzZSwgbnVsbF07XG4gIH1cbn1cblxuLyoqXG4gKiBTZW50aW5lbCBzdHJpbmdzIG1hY09TIHJldHVybnMgd2hlbiB0aGUgU1NJRCBleGlzdHMgYnV0IGlzbid0IHJlYWRhYmxlLlxuICogYDxyZWRhY3RlZD5gIGNvbWVzIGZyb20gYGlwY29uZmlnIGdldHN1bW1hcnlgIHdpdGhvdXQgTG9jYXRpb24gU2VydmljZXNcbiAqIHBlcm1pc3Npb24gKGludHJvZHVjZWQgaW4gbWFjT1MgU29ub21hKS4gYChudWxsKWAgaXMgdGhlIG9sZGVyIGZvcm0uXG4gKiBXZSB0cmVhdCBhbGwgb2YgdGhlc2UgYXMgXCJ1bmtub3duXCIgcmF0aGVyIHRoYW4gbGV0dGluZyB0aGUgbGl0ZXJhbCB0ZXh0XG4gKiBsZWFrIGludG8gdGhlIFVJLlxuICovXG5jb25zdCBVTlJFQURBQkxFX1NTSURfTUFSS0VSUyA9IG5ldyBTZXQoW1wiPHJlZGFjdGVkPlwiLCBcIihudWxsKVwiLCBcIlwiXSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRTU0lEKGRldmljZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgICBcIi91c3Ivc2Jpbi9pcGNvbmZpZ1wiLFxuICAgICAgW1wiZ2V0c3VtbWFyeVwiLCBkZXZpY2VdLFxuICAgICAgeyB0aW1lb3V0OiBDTURfVElNRU9VVF9NUyB9LFxuICAgICk7XG4gICAgY29uc3QgbWF0Y2ggPSBzdGRvdXQubWF0Y2goL15cXHMqU1NJRFxccyo6XFxzKiguKz8pXFxzKiQvbSk7XG4gICAgY29uc3Qgc3NpZCA9IG1hdGNoPy5bMV0/LnRyaW0oKSA/PyBcIlwiO1xuICAgIGlmIChVTlJFQURBQkxFX1NTSURfTUFSS0VSUy5oYXMoc3NpZCkpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBzc2lkO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRydWUgd2hlbiB0aGUgaW50ZXJmYWNlIGlzIFdpLUZpLWNsYXNzIGFuZCB3ZSBjb3VsZG4ndCByZWFkIGFuIFNTSUQsXG4gKiBhbG1vc3QgYWx3YXlzIGJlY2F1c2UgUmF5Y2FzdCBsYWNrcyBMb2NhdGlvbiBTZXJ2aWNlcyBwZXJtaXNzaW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTU0lEUGVybWlzc2lvbk1pc3NpbmcoaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlmYWNlLmFjdGl2ZSAmJiBpZmFjZS50eXBlID09PSBcIndpZmlcIiAmJiBpZmFjZS5zc2lkID09PSBudWxsO1xufVxuXG4vLyAtLS0tIFdpLUZpIHN3aXRjaGluZyAodXNlZCBieSBjb21wYXJlLW5ldHdvcmtzKSAtLS0tXG5cbi8qKiBSZXR1cm5zIHRoZSBCU0QgbmFtZSAoZW4wLCBlbjIsIC4uLikgb2YgdGhlIHByaW1hcnkgV2ktRmkgYWRhcHRlciwgb3IgbnVsbC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXaWZpRGV2aWNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBwb3J0cyA9IGF3YWl0IGxpc3RIYXJkd2FyZVBvcnRzKCk7XG4gIGNvbnN0IHdpZmkgPSBwb3J0cy5maW5kKChwKSA9PiAvd2ktZml8YWlycG9ydC9pLnRlc3QocC5oYXJkd2FyZVBvcnQpKTtcbiAgcmV0dXJuIHdpZmk/LmRldmljZSA/PyBudWxsO1xufVxuXG4vKiogUmVhZCBjdXJyZW50IFdpLUZpIFNTSUQgdmlhIGlwY29uZmlnIChyZXR1cm5zIG51bGwgaWYgbm8gcGVybXMgb3Igbm90IGNvbm5lY3RlZCkuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudFdpZmlTU0lEKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICBjb25zdCBkZXZpY2UgPSBhd2FpdCBnZXRXaWZpRGV2aWNlKCk7XG4gIGlmICghZGV2aWNlKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHJlYWRTU0lEKGRldmljZSk7XG59XG5cbi8qKlxuICogTGlzdCBzYXZlZCBXaS1GaSBuZXR3b3JrcyBvbiB0aGlzIE1hYy4gVGhlc2UgYXJlIGNhbmRpZGF0ZXMgZm9yIHN3aXRjaGluZyB0b1xuICogZHVyaW5nIGNvbXBhcmUgcnVucyBcdTIwMTQgbWFjT1Mgd2lsbCB1c2UgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZC5cbiAqXG4gKiBOb3RlOiB0aGlzIGlzICprbm93biogbmV0d29ya3MsIG5vdCAqaW4tcmFuZ2UqIG5ldHdvcmtzLiBBIHRydWUgaW4tcmFuZ2VcbiAqIHNjYW4gbmVlZHMgYHdkdXRpbCBzY2FuYCAoc3Vkbykgb3IgdGhlIHJlbW92ZWQgYGFpcnBvcnQgLXNgIGNvbW1hbmQuIFdpdGhvdXRcbiAqIHRob3NlLCB3ZSBhdHRlbXB0IHRoZSBzd2l0Y2ggYW5kIGxldCBpdCBmYWlsIGZhc3QgaWYgdGhlIG5ldHdvcmsgaXNuJ3QgYXJvdW5kLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbGlzdEtub3duV2lmaU5ldHdvcmtzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgY29uc3QgZGV2aWNlID0gYXdhaXQgZ2V0V2lmaURldmljZSgpO1xuICBpZiAoIWRldmljZSkgcmV0dXJuIFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjRmlsZUFzeW5jKFxuICAgICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgICBbXCItbGlzdHByZWZlcnJlZHdpcmVsZXNzbmV0d29ya3NcIiwgZGV2aWNlXSxcbiAgICAgIHsgdGltZW91dDogQ01EX1RJTUVPVVRfTVMgfSxcbiAgICApO1xuICAgIC8vIE91dHB1dDpcbiAgICAvLyAgIFByZWZlcnJlZCBuZXR3b3JrcyBvbiBlbjA6XG4gICAgLy8gICBcXHROZXR3b3JrQVxuICAgIC8vICAgXFx0TmV0d29ya0JcbiAgICByZXR1cm4gc3Rkb3V0XG4gICAgICAuc3BsaXQoXCJcXG5cIilcbiAgICAgIC5zbGljZSgxKVxuICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAuZmlsdGVyKChsKSA9PiBsLmxlbmd0aCA+IDApO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiBTd2l0Y2ggV2ktRmkgdG8gdGhlIGdpdmVuIFNTSUQuIFVzZXMgS2V5Y2hhaW4gZm9yIHRoZSBwYXNzd29yZCBpZiBrbm93bi5cbiAqIFRocm93cyBvbiBmYWlsdXJlIChuZXR3b3JrIG5vdCBpbiByYW5nZSwgYXV0aCBmYWlsZWQsIHVua25vd24gbmV0d29yaykuXG4gKlxuICogU3BlY2lhbCBjYXNlOiBpUGhvbmUvaVBhZCBQZXJzb25hbCBIb3RzcG90LiBUaGVzZSBvZnRlbiBhcHBlYXIgaW4gdGhlXG4gKiBwcmVmZXJyZWQtbmV0d29ya3MgbGlzdCBidXQgYXJlIGFjdGl2YXRlZCB2aWEgQmx1ZXRvb3RoL0NvbnRpbnVpdHksIG5vdFxuICogYSByZWFsIFdpLUZpIGJyb2FkY2FzdC4gYG5ldHdvcmtzZXR1cGAgY2FuJ3QgdHJpZ2dlciB0aGF0IGFjdGl2YXRpb24gXHUyMDE0XG4gKiB3ZSBzdXJmYWNlIGEgdGFpbG9yZWQgaGludCBpbiB0aGUgZXJyb3IgbWVzc2FnZSBpbnN0ZWFkIG9mIHRoZSByYXdcbiAqIFwiQ291bGQgbm90IGZpbmQgbmV0d29ya1wiIG91dHB1dCwgd2hpY2ggaXMgY29uZnVzaW5nIGhlcmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzd2l0Y2hXaWZpVG8oXG4gIGRldmljZTogc3RyaW5nLFxuICBzc2lkOiBzdHJpbmcsXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNGaWxlQXN5bmMoXG4gICAgXCIvdXNyL3NiaW4vbmV0d29ya3NldHVwXCIsXG4gICAgW1wiLXNldGFpcnBvcnRuZXR3b3JrXCIsIGRldmljZSwgc3NpZF0sXG4gICAgeyB0aW1lb3V0OiAyMF8wMDAsIHNpZ25hbCB9LFxuICApO1xuICBjb25zdCBjb21iaW5lZCA9IGAke3N0ZG91dH1cXG4ke3N0ZGVycn1gLnRvTG93ZXJDYXNlKCk7XG4gIC8vIG5ldHdvcmtzZXR1cCByZXR1cm5zIGV4aXQgMCBldmVuIG9uIGZhaWx1cmU7IGhhdmUgdG8gc2NhbiBvdXRwdXRcbiAgaWYgKFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZmFpbGVkXCIpIHx8XG4gICAgY29tYmluZWQuaW5jbHVkZXMoXCJjb3VsZCBub3QgZmluZFwiKSB8fFxuICAgIGNvbWJpbmVkLmluY2x1ZGVzKFwiZXJyb3JcIilcbiAgKSB7XG4gICAgaWYgKGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGAke3NzaWR9IGlzIGEgUGVyc29uYWwgSG90c3BvdCBcdTIwMTQgYWN0aXZhdGUgaXQgdmlhIHRoZSBXaS1GaSBtZW51IGJhciAoQ29udGludWl0eSksIHRoZW4gcmUtcnVuLiBuZXR3b3Jrc2V0dXAgY2FuJ3QgdHJpZ2dlciBDb250aW51aXR5LmAsXG4gICAgICApO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgJHtzc2lkfSBub3QgaW4gcmFuZ2Ugb3IgdW5yZWFjaGFibGUgKHJhdzogJHtzdGRvdXQudHJpbSgpIHx8IHN0ZGVyci50cmltKCkgfHwgXCJubyBvdXRwdXRcIn0pYCxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogSGV1cmlzdGljOiBpcyB0aGlzIFNTSUQgbGlrZWx5IGFuIGlQaG9uZS9pUGFkIFBlcnNvbmFsIEhvdHNwb3Qgcm91dGVkXG4gKiB0aHJvdWdoIENvbnRpbnVpdHk/IFRoZXNlIG5lZWQgbWFudWFsIGFjdGl2YXRpb24gdmlhIHRoZSBXaS1GaSBtZW51IFx1MjAxNFxuICogbm8gQ0xJIHRvb2wgY2FuIHRyaWdnZXIgdGhlbS5cbiAqXG4gKiBQYXR0ZXJuOiBtYWNPUyBkZWZhdWx0cyBQZXJzb25hbCBIb3RzcG90IFNTSUQgdG8gdGhlIGRldmljZSBuYW1lLCB3aGljaFxuICogYnkgZGVmYXVsdCBpcyBcIjxGaXJzdCBuYW1lPidzIGlQaG9uZVwiIG9yIFwiPEZpcnN0IG5hbWU+J3MgaVBhZFwiLiBVc2Vyc1xuICogY2FuIHJlbmFtZSB0aGVpciBkZXZpY2VzLCBidXQgdGhlIGlQaG9uZS9pUGFkIGtleXdvcmQgdXN1YWxseSBzdXJ2aXZlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQ29udGludWl0eUhvdHNwb3ROYW1lKHNzaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL1xcYihpcGhvbmV8aXBhZClcXGIvaS50ZXN0KHNzaWQpO1xufVxuXG4vKipcbiAqIFBvbGwgaWZjb25maWcgdW50aWwgdGhlIGRldmljZSBpcyB1cCB3aXRoIGFuIGluZXQgYWRkcmVzcywgb3IgdGltZW91dC5cbiAqIElmIGV4cGVjdGVkU1NJRCBpcyBwcm92aWRlZCBhbmQgd2UgY2FuIHJlYWQgU1NJRHMsIGFsc28gd2FpdCB1bnRpbCBpdCBtYXRjaGVzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvcldpZmlSZWFkeShcbiAgZGV2aWNlOiBzdHJpbmcsXG4gIGV4cGVjdGVkU1NJRDogc3RyaW5nIHwgbnVsbCxcbiAgdGltZW91dE1zID0gMjBfMDAwLFxuICBzaWduYWw/OiBBYm9ydFNpZ25hbCxcbik6IFByb21pc2U8eyBhY3RpdmU6IGJvb2xlYW47IHNzaWQ6IHN0cmluZyB8IG51bGwgfT4ge1xuICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQgPCB0aW1lb3V0TXMpIHtcbiAgICBpZiAoc2lnbmFsPy5hYm9ydGVkKSByZXR1cm4geyBhY3RpdmU6IGZhbHNlLCBzc2lkOiBudWxsIH07XG4gICAgY29uc3QgW2FjdGl2ZV0gPSBhd2FpdCByZWFkSWZjb25maWcoZGV2aWNlKTtcbiAgICBpZiAoYWN0aXZlKSB7XG4gICAgICBjb25zdCBzc2lkID0gYXdhaXQgcmVhZFNTSUQoZGV2aWNlKTtcbiAgICAgIC8vIElmIHdlIGNhbid0IHJlYWQgU1NJRCBhdCBhbGwgKG5vIExvY2F0aW9uIHBlcm1zKSwgdHJ1c3QgdGhlIHN3aXRjaC5cbiAgICAgIC8vIE90aGVyd2lzZSByZXF1aXJlIGl0IHRvIG1hdGNoIHdoYXQgd2UgYXNrZWQgZm9yLlxuICAgICAgaWYgKGV4cGVjdGVkU1NJRCA9PT0gbnVsbCB8fCBzc2lkID09PSBudWxsIHx8IHNzaWQgPT09IGV4cGVjdGVkU1NJRCkge1xuICAgICAgICByZXR1cm4geyBhY3RpdmU6IHRydWUsIHNzaWQgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXdhaXQgc2xlZXAoNTAwLCBzaWduYWwpO1xuICB9XG4gIHJldHVybiB7IGFjdGl2ZTogZmFsc2UsIHNzaWQ6IG51bGwgfTtcbn1cblxuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlciwgc2lnbmFsPzogQWJvcnRTaWduYWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3QgdCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpO1xuICAgIHNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgIFwiYWJvcnRcIixcbiAgICAgICgpID0+IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHQpO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9LFxuICAgICAgeyBvbmNlOiB0cnVlIH0sXG4gICAgKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5VHlwZShoYXJkd2FyZVBvcnQ6IHN0cmluZyk6IEludGVyZmFjZVR5cGUge1xuICBjb25zdCBwID0gaGFyZHdhcmVQb3J0LnRvTG93ZXJDYXNlKCk7XG4gIGlmIChwLmluY2x1ZGVzKFwid2ktZmlcIikgfHwgcC5pbmNsdWRlcyhcImFpcnBvcnRcIikpIHJldHVybiBcIndpZmlcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJ0aHVuZGVyYm9sdFwiKSB8fCBwLmluY2x1ZGVzKFwiYnJpZGdlXCIpKSByZXR1cm4gXCJ0aHVuZGVyYm9sdFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImlwaG9uZVwiKSB8fCBwLmluY2x1ZGVzKFwiaXBhZFwiKSkgcmV0dXJuIFwidXNiXCI7XG4gIGlmIChwLmluY2x1ZGVzKFwidXNiXCIpKSByZXR1cm4gXCJ1c2JcIjtcbiAgaWYgKHAuaW5jbHVkZXMoXCJibHVldG9vdGhcIikpIHJldHVybiBcImJsdWV0b290aFwiO1xuICBpZiAocC5pbmNsdWRlcyhcImV0aGVybmV0XCIpIHx8IHAuaW5jbHVkZXMoXCJsYW5cIikpIHJldHVybiBcImV0aGVybmV0XCI7XG4gIHJldHVybiBcIm90aGVyXCI7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVJbnRlcmZhY2VzKGE6IE5ldHdvcmtJbnRlcmZhY2UsIGI6IE5ldHdvcmtJbnRlcmZhY2UpOiBudW1iZXIge1xuICBpZiAoYS5hY3RpdmUgIT09IGIuYWN0aXZlKSByZXR1cm4gYS5hY3RpdmUgPyAtMSA6IDE7XG4gIGlmIChhLmlzRGVmYXVsdCAhPT0gYi5pc0RlZmF1bHQpIHJldHVybiBhLmlzRGVmYXVsdCA/IC0xIDogMTtcbiAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG59XG4iLCAiLyoqXG4gKiBDYXB0aXZlIHBvcnRhbCBkZXRlY3Rpb24uXG4gKlxuICogQXBwbGUncyBzdGFuZGFyZCBwcm9iZSBVUkwgcmV0dXJucyBhIHRpbnkgXCJTdWNjZXNzXCIgSFRNTCBwYWdlIHdoZW4gdGhlXG4gKiBjbGllbnQgaGFzIHVucmVzdHJpY3RlZCBpbnRlcm5ldCBhY2Nlc3MuIEJlaGluZCBhIGNhcHRpdmUgcG9ydGFsIChob3RlbFxuICogV2ktRmksIGNhZlx1MDBFOSBzaWduLWluIHBhZ2VzKSwgdGhlIHJlcXVlc3QgZ2V0cyBpbnRlcmNlcHRlZCBhbmQgd2UgZ2V0IGJhY2tcbiAqIGVpdGhlciBhbiBIVFRQIHJlZGlyZWN0IG9yIHRoZSBwb3J0YWwncyBIVE1MIFx1MjAxNCBhbnl0aGluZyBvdGhlciB0aGFuIHRoZVxuICogZXhhY3Qgc3VjY2VzcyBib2R5IG1lYW5zIHdlIGNhbid0IGFjdHVhbGx5IHJlYWNoIHRoZSBvcGVuIGludGVybmV0LlxuICpcbiAqIFVzZWQgZHVyaW5nIGNvbXBhcmUgcnVucyB0byBza2lwIGNhcHRpdmUgbmV0d29ya3MgYmVmb3JlIHdhc3RpbmcgMzBzIG9uXG4gKiBhIGBuZXR3b3JrcXVhbGl0eWAgcnVuIHRoYXQgd291bGQganVzdCBmYWlsLlxuICovXG5cbmNvbnN0IEFQUExFX0NBUFRJVkVfVVJMID0gXCJodHRwOi8vY2FwdGl2ZS5hcHBsZS5jb20vaG90c3BvdC1kZXRlY3QuaHRtbFwiO1xuY29uc3QgU1VDQ0VTU19CT0RZID0gXCJTdWNjZXNzXCI7XG5cbmV4cG9ydCB0eXBlIENhcHRpdmVDaGVja1Jlc3VsdCA9IFwib3BlblwiIHwgXCJjYXB0aXZlXCIgfCBcIm5vLWludGVybmV0XCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZXRlY3RDYXB0aXZlUG9ydGFsKFxuICB0aW1lb3V0TXMgPSA1MDAwLFxuICBvdXRlclNpZ25hbD86IEFib3J0U2lnbmFsLFxuKTogUHJvbWlzZTxDYXB0aXZlQ2hlY2tSZXN1bHQ+IHtcbiAgY29uc3QgaW5uZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiBpbm5lci5hYm9ydCgpLCB0aW1lb3V0TXMpO1xuICBvdXRlclNpZ25hbD8uYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsICgpID0+IGlubmVyLmFib3J0KCksIHsgb25jZTogdHJ1ZSB9KTtcblxuICB0cnkge1xuICAgIC8vIENhY2hlLWJ1c3QgdmlhIHF1ZXJ5IHBhcmFtIHNpbmNlIHRoZSBgY2FjaGVgIG9wdGlvbiBpc24ndCBpbiBOb2RlJ3MgZmV0Y2ggdHlwaW5ncy5cbiAgICBjb25zdCB1cmwgPSBgJHtBUFBMRV9DQVBUSVZFX1VSTH0/dD0ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIHNpZ25hbDogaW5uZXIuc2lnbmFsLFxuICAgICAgcmVkaXJlY3Q6IFwibWFudWFsXCIsXG4gICAgICBoZWFkZXJzOiB7IFwiVXNlci1BZ2VudFwiOiBcIkNhcHRpdmVOZXR3b3JrU3VwcG9ydC00MTkgd2lzcHJcIiB9LFxuICAgIH0pO1xuICAgIC8vIEFueSByZWRpcmVjdCA9IGNhcHRpdmUgcG9ydGFsIGludGVyY2VwdGluZyB1c1xuICAgIGlmIChyZXMuc3RhdHVzID49IDMwMCAmJiByZXMuc3RhdHVzIDwgNDAwKSByZXR1cm4gXCJjYXB0aXZlXCI7XG4gICAgaWYgKHJlcy5zdGF0dXMgIT09IDIwMCkgcmV0dXJuIFwiY2FwdGl2ZVwiO1xuICAgIGNvbnN0IHRleHQgPSAoYXdhaXQgcmVzLnRleHQoKSkudHJpbSgpO1xuICAgIHJldHVybiB0ZXh0LmluY2x1ZGVzKFNVQ0NFU1NfQk9EWSkgPyBcIm9wZW5cIiA6IFwiY2FwdGl2ZVwiO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gXCJuby1pbnRlcm5ldFwiO1xuICB9IGZpbmFsbHkge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBlbnZpcm9ubWVudCB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB0eXBlIHsgSGlzdG9yeUVudHJ5IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IEhJU1RPUllfRklMRU5BTUUgPSBcImhpc3RvcnkuanNvbmxcIjtcblxuLyoqXG4gKiBBcHBlbmQtb25seSBKU09OTCBoaXN0b3J5LiBXZSB1c2UgYSBmaWxlIChub3QgTG9jYWxTdG9yYWdlKSBiZWNhdXNlOlxuICogLSBVc2VyIGNhbiBpbnNwZWN0IC8gZ3JlcCAvIGJhY2sgdXAgdGhlIGxvZ1xuICogLSBJdCBncm93cyBsaW5lYXJseSBhbmQgd2UgbmV2ZXIgbmVlZCB0byByZWFkIGl0IGFsbCB0byB3cml0ZVxuICogLSBcIlNob3cgaW4gRmluZGVyXCIgaXMgYSByZWFsLCB1c2VmdWwgYWZmb3JkYW5jZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEhpc3RvcnlTdG9yZSB7XG4gIGFwcGVuZChlbnRyeTogSGlzdG9yeUVudHJ5KTogUHJvbWlzZTx2b2lkPjtcbiAgcmVhZEFsbCgpOiBQcm9taXNlPEhpc3RvcnlFbnRyeVtdPjtcbiAgY2xlYXIoKTogUHJvbWlzZTx2b2lkPjtcbiAgZmlsZVBhdGgoKTogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSGlzdG9yeVN0b3JlKCk6IEhpc3RvcnlTdG9yZSB7XG4gIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGVudmlyb25tZW50LnN1cHBvcnRQYXRoLCBISVNUT1JZX0ZJTEVOQU1FKTtcblxuICByZXR1cm4ge1xuICAgIGFzeW5jIGFwcGVuZChlbnRyeSkge1xuICAgICAgYXdhaXQgZnMubWtkaXIocGF0aC5kaXJuYW1lKGZpbGVQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICBhd2FpdCBmcy5hcHBlbmRGaWxlKGZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShlbnRyeSkgKyBcIlxcblwiLCBcInV0ZjhcIik7XG4gICAgfSxcblxuICAgIGFzeW5jIHJlYWRBbGwoKSB7XG4gICAgICBsZXQgY29udGVudHM6IHN0cmluZztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnRlbnRzID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsIFwidXRmOFwiKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoKGVyciBhcyBOb2RlSlMuRXJybm9FeGNlcHRpb24pLmNvZGUgPT09IFwiRU5PRU5UXCIpIHJldHVybiBbXTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgICAgY29uc3QgZW50cmllczogSGlzdG9yeUVudHJ5W10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBjb250ZW50cy5zcGxpdChcIlxcblwiKSkge1xuICAgICAgICBpZiAoIWxpbmUudHJpbSgpKSBjb250aW51ZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBlbnRyaWVzLnB1c2goSlNPTi5wYXJzZShsaW5lKSBhcyBIaXN0b3J5RW50cnkpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBza2lwIG1hbGZvcm1lZCBsaW5lcyByYXRoZXIgdGhhbiBmYWlsIHRoZSB3aG9sZSBsb2FkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBlbnRyaWVzLnNvcnQoKGEsIGIpID0+IGIuZmluaXNoZWRBdCAtIGEuZmluaXNoZWRBdCk7XG4gICAgfSxcblxuICAgIGFzeW5jIGNsZWFyKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMudW5saW5rKGZpbGVQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoKGVyciBhcyBOb2RlSlMuRXJybm9FeGNlcHRpb24pLmNvZGUgIT09IFwiRU5PRU5UXCIpIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZmlsZVBhdGgoKSB7XG4gICAgICByZXR1cm4gZmlsZVBhdGg7XG4gICAgfSxcbiAgfTtcbn1cbiIsICJpbXBvcnQgeyBMb2NhbFN0b3JhZ2UgfSBmcm9tIFwiQHJheWNhc3QvYXBpXCI7XG5pbXBvcnQgdHlwZSB7IFRlc3RNb2RlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5cbmNvbnN0IEtFWV9QUkVGSVggPSBcImR1cmF0aW9uOlwiO1xuY29uc3QgU0FNUExFX0xJTUlUID0gMTA7XG5cbi8qKlxuICogSGFyZC1jb2RlZCBmYWxsYmFjayBlc3RpbWF0ZXMgcGVyIG1vZGUsIHVzZWQgdW50aWwgd2UgaGF2ZSBhbnkgc2FtcGxlcy5cbiAqIENhbGlicmF0ZWQgZnJvbSBvYnNlcnZlZCBydW5zIG9uIHR5cGljYWwgaG9tZSAvIGhvdHNwb3QgY29ubmVjdGlvbnMuXG4gKi9cbmV4cG9ydCBjb25zdCBGQUxMQkFDS19FU1RJTUFURV9NUzogUmVjb3JkPFRlc3RNb2RlLCBudW1iZXI+ID0ge1xuICBwYXJhbGxlbDogMzBfMDAwLFxuICBzZXF1ZW50aWFsOiA1NV8wMDAsXG4gIGRvd25sb2FkOiAxOF8wMDAsXG4gIHVwbG9hZDogMThfMDAwLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBEdXJhdGlvblN0YXRzIHtcbiAgLyoqIFJldHVybnMgdGhlIGJlc3QgZXN0aW1hdGUgZm9yIG5leHQtcnVuIGR1cmF0aW9uIGluIG1zLiAqL1xuICBlc3RpbWF0ZShtb2RlOiBUZXN0TW9kZSwgaW50ZXJmYWNlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+O1xuICAvKiogUmVjb3JkIGEgY29tcGxldGVkIHJ1bidzIGR1cmF0aW9uLiAqL1xuICByZWNvcmQoXG4gICAgbW9kZTogVGVzdE1vZGUsXG4gICAgaW50ZXJmYWNlTmFtZTogc3RyaW5nLFxuICAgIGR1cmF0aW9uTXM6IG51bWJlcixcbiAgKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUR1cmF0aW9uU3RhdHMoKTogRHVyYXRpb25TdGF0cyB7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgZXN0aW1hdGUobW9kZSwgaW50ZXJmYWNlTmFtZSkge1xuICAgICAgY29uc3Qgc2FtcGxlcyA9IGF3YWl0IGxvYWRTYW1wbGVzKG1vZGUsIGludGVyZmFjZU5hbWUpO1xuICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoID09PSAwKSByZXR1cm4gRkFMTEJBQ0tfRVNUSU1BVEVfTVNbbW9kZV07XG4gICAgICByZXR1cm4gbWVkaWFuKHNhbXBsZXMpO1xuICAgIH0sXG5cbiAgICBhc3luYyByZWNvcmQobW9kZSwgaW50ZXJmYWNlTmFtZSwgZHVyYXRpb25Ncykge1xuICAgICAgY29uc3Qgc2FtcGxlcyA9IGF3YWl0IGxvYWRTYW1wbGVzKG1vZGUsIGludGVyZmFjZU5hbWUpO1xuICAgICAgc2FtcGxlcy5wdXNoKGR1cmF0aW9uTXMpO1xuICAgICAgY29uc3QgdHJpbW1lZCA9IHNhbXBsZXMuc2xpY2UoLVNBTVBMRV9MSU1JVCk7XG4gICAgICBhd2FpdCBMb2NhbFN0b3JhZ2Uuc2V0SXRlbShcbiAgICAgICAga2V5Rm9yKG1vZGUsIGludGVyZmFjZU5hbWUpLFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh0cmltbWVkKSxcbiAgICAgICk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24ga2V5Rm9yKG1vZGU6IFRlc3RNb2RlLCBpbnRlcmZhY2VOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7S0VZX1BSRUZJWH0ke21vZGV9OiR7aW50ZXJmYWNlTmFtZX1gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkU2FtcGxlcyhcbiAgbW9kZTogVGVzdE1vZGUsXG4gIGludGVyZmFjZU5hbWU6IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgY29uc3QgcmF3ID0gYXdhaXQgTG9jYWxTdG9yYWdlLmdldEl0ZW08c3RyaW5nPihrZXlGb3IobW9kZSwgaW50ZXJmYWNlTmFtZSkpO1xuICBpZiAoIXJhdykgcmV0dXJuIFtdO1xuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpXG4gICAgICA/IHBhcnNlZC5maWx0ZXIoKG46IHVua25vd24pOiBuIGlzIG51bWJlciA9PiB0eXBlb2YgbiA9PT0gXCJudW1iZXJcIilcbiAgICAgIDogW107XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBbXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtZWRpYW4odmFsdWVzOiBudW1iZXJbXSk6IG51bWJlciB7XG4gIGNvbnN0IHNvcnRlZCA9IFsuLi52YWx1ZXNdLnNvcnQoKGEsIGIpID0+IGEgLSBiKTtcbiAgY29uc3QgbWlkID0gTWF0aC5mbG9vcihzb3J0ZWQubGVuZ3RoIC8gMik7XG4gIHJldHVybiBzb3J0ZWQubGVuZ3RoICUgMiA9PT0gMFxuICAgID8gKHNvcnRlZFttaWQgLSAxXSArIHNvcnRlZFttaWRdKSAvIDJcbiAgICA6IHNvcnRlZFttaWRdO1xufVxuIiwgImltcG9ydCB0eXBlIHsgUmVzcG9uc2l2ZW5lc3NUaWVyLCBUZXN0TW9kZSB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0VGhyb3VnaHB1dChiaXRzUGVyU2VjOiBudW1iZXIgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKGJpdHNQZXJTZWMgPT09IG51bGwpIHJldHVybiBcIlx1MjAxNFwiO1xuICBjb25zdCBtYnBzID0gYml0c1BlclNlYyAvIDFfMDAwXzAwMDtcbiAgaWYgKG1icHMgPj0gMTAwMCkgcmV0dXJuIGAkeyhtYnBzIC8gMTAwMCkudG9GaXhlZCgyKX0gR2Jwc2A7XG4gIGlmIChtYnBzID49IDEwMCkgcmV0dXJuIGAke21icHMudG9GaXhlZCgwKX0gTWJwc2A7XG4gIGlmIChtYnBzID49IDEwKSByZXR1cm4gYCR7bWJwcy50b0ZpeGVkKDEpfSBNYnBzYDtcbiAgcmV0dXJuIGAke21icHMudG9GaXhlZCgyKX0gTWJwc2A7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRMYXRlbmN5KG1zOiBudW1iZXIgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKG1zID09PSBudWxsKSByZXR1cm4gXCJcdTIwMTRcIjtcbiAgcmV0dXJuIG1zID49IDEwID8gYCR7bXMudG9GaXhlZCgwKX0gbXNgIDogYCR7bXMudG9GaXhlZCgxKX0gbXNgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9kZUxhYmVsKG1vZGU6IFRlc3RNb2RlKTogc3RyaW5nIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBcInBhcmFsbGVsXCI6XG4gICAgICByZXR1cm4gXCJQYXJhbGxlbCAoZG93biArIHVwKVwiO1xuICAgIGNhc2UgXCJzZXF1ZW50aWFsXCI6XG4gICAgICByZXR1cm4gXCJTZXF1ZW50aWFsXCI7XG4gICAgY2FzZSBcImRvd25sb2FkXCI6XG4gICAgICByZXR1cm4gXCJEb3dubG9hZCBvbmx5XCI7XG4gICAgY2FzZSBcInVwbG9hZFwiOlxuICAgICAgcmV0dXJuIFwiVXBsb2FkIG9ubHlcIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVzcG9uc2l2ZW5lc3MoXG4gIHJwbTogbnVtYmVyIHwgbnVsbCxcbiAgdGllcjogUmVzcG9uc2l2ZW5lc3NUaWVyIHwgbnVsbCxcbik6IHN0cmluZyB7XG4gIGlmIChycG0gPT09IG51bGwgfHwgdGllciA9PT0gbnVsbCkgcmV0dXJuIFwiXHUyMDE0XCI7XG4gIGNvbnN0IGxhYmVsID0gdGllci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHRpZXIuc2xpY2UoMSk7XG4gIHJldHVybiBgJHtsYWJlbH0gKCR7cnBtLnRvRml4ZWQoMCl9IFJQTSlgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RWxhcHNlZChtczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3Qgc2Vjb25kcyA9IG1zIC8gMTAwMDtcbiAgcmV0dXJuIHNlY29uZHMgPCAxMCA/IGAke3NlY29uZHMudG9GaXhlZCgxKX1zYCA6IGAke01hdGgucm91bmQoc2Vjb25kcyl9c2A7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJQcm9ncmVzc0JhcihmcmFjdGlvbjogbnVtYmVyLCB3aWR0aCA9IDI0KTogc3RyaW5nIHtcbiAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIGZyYWN0aW9uKSk7XG4gIGNvbnN0IGZpbGxlZCA9IE1hdGgucm91bmQoY2xhbXBlZCAqIHdpZHRoKTtcbiAgcmV0dXJuIFwiXHUyNTg4XCIucmVwZWF0KGZpbGxlZCkgKyBcIlx1MjU5MVwiLnJlcGVhdCh3aWR0aCAtIGZpbGxlZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRSZWxhdGl2ZVRpbWUoXG4gIHRzOiBudW1iZXIsXG4gIG5vdzogbnVtYmVyID0gRGF0ZS5ub3coKSxcbik6IHN0cmluZyB7XG4gIGNvbnN0IHNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLnJvdW5kKChub3cgLSB0cykgLyAxMDAwKSk7XG4gIGlmIChzZWNvbmRzIDwgNSkgcmV0dXJuIFwianVzdCBub3dcIjtcbiAgaWYgKHNlY29uZHMgPCA2MCkgcmV0dXJuIGAke3NlY29uZHN9cyBhZ29gO1xuICBjb25zdCBtaW51dGVzID0gTWF0aC5yb3VuZChzZWNvbmRzIC8gNjApO1xuICBpZiAobWludXRlcyA8IDYwKSByZXR1cm4gYCR7bWludXRlc31tIGFnb2A7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5yb3VuZChtaW51dGVzIC8gNjApO1xuICBpZiAoaG91cnMgPCAyNCkgcmV0dXJuIGAke2hvdXJzfWggYWdvYDtcbiAgY29uc3QgZGF5cyA9IE1hdGgucm91bmQoaG91cnMgLyAyNCk7XG4gIHJldHVybiBgJHtkYXlzfWQgYWdvYDtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IFNwZWVkVGllciB9IGZyb20gXCIuLi90eXBlc1wiO1xuXG4vKipcbiAqIFRpZXIgYm91bmRhcmllcyBpbiBNYnBzLiBDaG9zZW4gZm9yIDIwMjYgdHlwaWNhbC11c2VyIGNhbGlicmF0aW9uOlxuICogLSBwb29yOiBub3RpY2VhYmxlIGRlZ3JhZGF0aW9uIGZvciBldmVyeWRheSB1c2VcbiAqIC0gb2s6IGhhbmRsZXMgSEQgc3RyZWFtaW5nICsgdmlkZW8gY2FsbHNcbiAqIC0gZ29vZDogY29tZm9ydGFibGUgZm9yIDRLICsgbXVsdGktZGV2aWNlXG4gKiAtIGdyZWF0OiBwb3dlci11c2VyIC8gbXVsdGktNEsgdGVycml0b3J5XG4gKiAtIGV4Y2VsbGVudDogZ2lnYWJpdC1jbGFzc1xuICovXG5jb25zdCBUSUVSX1RIUkVTSE9MRFNfTUJQUzogQXJyYXk8eyB0aWVyOiBTcGVlZFRpZXI7IG1pbjogbnVtYmVyIH0+ID0gW1xuICB7IHRpZXI6IFwiZXhjZWxsZW50XCIsIG1pbjogMTAwMCB9LFxuICB7IHRpZXI6IFwiZ3JlYXRcIiwgbWluOiAyMDAgfSxcbiAgeyB0aWVyOiBcImdvb2RcIiwgbWluOiA1MCB9LFxuICB7IHRpZXI6IFwib2tcIiwgbWluOiAxMCB9LFxuICB7IHRpZXI6IFwicG9vclwiLCBtaW46IDAgfSxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBjbGFzc2lmeVNwZWVkKGJwczogbnVtYmVyKTogU3BlZWRUaWVyIHtcbiAgY29uc3QgbWJwcyA9IGJwcyAvIDFfMDAwXzAwMDtcbiAgcmV0dXJuIFRJRVJfVEhSRVNIT0xEU19NQlBTLmZpbmQoKHQpID0+IG1icHMgPj0gdC5taW4pIS50aWVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BlZWRUaWVyTGFiZWwodGllcjogU3BlZWRUaWVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRpZXIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0aWVyLnNsaWNlKDEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZG93bmxvYWRDb250ZXh0KHRpZXI6IFNwZWVkVGllcik6IHN0cmluZyB7XG4gIHN3aXRjaCAodGllcikge1xuICAgIGNhc2UgXCJwb29yXCI6XG4gICAgICByZXR1cm4gXCJtYXkgc3RydWdnbGUgd2l0aCBIRCB2aWRlb1wiO1xuICAgIGNhc2UgXCJva1wiOlxuICAgICAgcmV0dXJuIFwiSEQgc3RyZWFtaW5nLCB2aWRlbyBjYWxscyBmaW5lXCI7XG4gICAgY2FzZSBcImdvb2RcIjpcbiAgICAgIHJldHVybiBcIjRLIHN0cmVhbWluZywgbXVsdGktZGV2aWNlXCI7XG4gICAgY2FzZSBcImdyZWF0XCI6XG4gICAgICByZXR1cm4gXCJtdWx0aS00SywgZmFzdCBsYXJnZSBkb3dubG9hZHNcIjtcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICByZXR1cm4gXCJnaWdhYml0LWNsYXNzIGNvbm5lY3Rpb25cIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBsb2FkQ29udGV4dCh0aWVyOiBTcGVlZFRpZXIpOiBzdHJpbmcge1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgcmV0dXJuIFwidmlkZW8gY2FsbHMgbWF5IHN0dXR0ZXJcIjtcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHJldHVybiBcIkhEIHZpZGVvIGNhbGxzIE9LXCI7XG4gICAgY2FzZSBcImdvb2RcIjpcbiAgICAgIHJldHVybiBcImhpZ2gtcXVhbGl0eSBsaXZlIHN0cmVhbWluZ1wiO1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgcmV0dXJuIFwicHJvZmVzc2lvbmFsIHN0cmVhbWluZywgbGFyZ2UgdXBsb2Fkc1wiO1xuICAgIGNhc2UgXCJleGNlbGxlbnRcIjpcbiAgICAgIHJldHVybiBcInN5bW1ldHJpYyBnaWdhYml0XCI7XG4gIH1cbn1cblxuLyoqXG4gKiBSZW5kZXIgYSBsb2ctc2NhbGUgbWV0ZXIgZnJvbSAxIE1icHMgdG8gMTAgR2JwcyAoZm91ciBkZWNhZGVzKS5cbiAqIFJldHVybnMgYSBtdWx0aS1saW5lIGJsb2NrOiBiYXIgKyBheGlzIGxhYmVscywgbW9ub3NwYWNlLlxuICovXG5jb25zdCBNRVRFUl9XSURUSCA9IDI4O1xuY29uc3QgTE9HX01JTiA9IDA7IC8vIGxvZzEwKDEgTWJwcylcbmNvbnN0IExPR19NQVggPSA0OyAvLyBsb2cxMCgxMDAwMCBNYnBzID0gMTAgR2JwcylcblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckxvZ01ldGVyKGJwczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgbWJwcyA9IE1hdGgubWF4KDAuMSwgYnBzIC8gMV8wMDBfMDAwKTtcbiAgY29uc3QgbG9nVmFsID0gTWF0aC5sb2cxMChtYnBzKTtcbiAgY29uc3QgZnJhY3Rpb24gPSBNYXRoLm1heChcbiAgICAwLFxuICAgIE1hdGgubWluKDEsIChsb2dWYWwgLSBMT0dfTUlOKSAvIChMT0dfTUFYIC0gTE9HX01JTikpLFxuICApO1xuICBjb25zdCBwb3NpdGlvbiA9IE1hdGgucm91bmQoZnJhY3Rpb24gKiAoTUVURVJfV0lEVEggLSAxKSk7XG5cbiAgbGV0IGJhciA9IFwiXCI7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgTUVURVJfV0lEVEg7IGkrKykge1xuICAgIGlmIChpID09PSBwb3NpdGlvbikgYmFyICs9IFwiXHUyNUJDXCI7XG4gICAgZWxzZSBpZiAoaSAlIDcgPT09IDApXG4gICAgICBiYXIgKz0gXCJcdTI1MEFcIjsgLy8gZGVjYWRlIHRpY2sgYXQgMCwgNywgMTQsIDIxXG4gICAgZWxzZSBiYXIgKz0gXCJcdTI1MDBcIjtcbiAgfVxuXG4gIC8vIEF4aXMgbGFiZWxzOiAxTSgwKSAgMTBNKDcpICAxMDBNKDE0KSAgMUcoMjEpICAxMEcoMjcpXG4gIGNvbnN0IGF4aXMgPSBsYXlvdXRBeGlzKFtcbiAgICB7IGNvbDogMCwgdGV4dDogXCIxTVwiIH0sXG4gICAgeyBjb2w6IDcsIHRleHQ6IFwiMTBNXCIgfSxcbiAgICB7IGNvbDogMTQsIHRleHQ6IFwiMTAwTVwiIH0sXG4gICAgeyBjb2w6IDIxLCB0ZXh0OiBcIjFHXCIgfSxcbiAgICB7IGNvbDogMjcsIHRleHQ6IFwiMTBHXCIgfSxcbiAgXSk7XG5cbiAgcmV0dXJuIGAke2Jhcn1cXG4ke2F4aXN9YDtcbn1cblxuZnVuY3Rpb24gbGF5b3V0QXhpcyhsYWJlbHM6IEFycmF5PHsgY29sOiBudW1iZXI7IHRleHQ6IHN0cmluZyB9Pik6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmU6IHN0cmluZ1tdID0gQXJyYXkoTUVURVJfV0lEVEggKyAzKS5maWxsKFwiIFwiKTtcbiAgZm9yIChjb25zdCB7IGNvbCwgdGV4dCB9IG9mIGxhYmVscykge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgYyA9IGNvbCArIGk7XG4gICAgICBpZiAoYyA8IGxpbmUubGVuZ3RoKSBsaW5lW2NdID0gdGV4dFtpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxpbmUuam9pbihcIlwiKS50cmltRW5kKCk7XG59XG4iLCAiZXhwb3J0IHR5cGUgUmVzcG9uc2l2ZW5lc3NUaWVyID0gXCJsb3dcIiB8IFwibWVkaXVtXCIgfCBcImhpZ2hcIjtcblxuZXhwb3J0IHR5cGUgU3BlZWRUaWVyID0gXCJwb29yXCIgfCBcIm9rXCIgfCBcImdvb2RcIiB8IFwiZ3JlYXRcIiB8IFwiZXhjZWxsZW50XCI7XG5cbmV4cG9ydCB0eXBlIFRlc3RNb2RlID0gXCJwYXJhbGxlbFwiIHwgXCJzZXF1ZW50aWFsXCIgfCBcImRvd25sb2FkXCIgfCBcInVwbG9hZFwiO1xuXG5leHBvcnQgdHlwZSBJbnRlcmZhY2VUeXBlID1cbiAgfCBcIndpZmlcIlxuICB8IFwiZXRoZXJuZXRcIlxuICB8IFwidGh1bmRlcmJvbHRcIlxuICB8IFwidXNiXCJcbiAgfCBcImJsdWV0b290aFwiXG4gIHwgXCJvdGhlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5ldHdvcmtJbnRlcmZhY2Uge1xuICAvKiogQlNEIGRldmljZSBuYW1lIChlbjAsIGVuMiwgLi4uKSAqL1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IEludGVyZmFjZVR5cGU7XG4gIC8qKiBIYXJkd2FyZSBwb3J0IGxhYmVsLCBlLmcuIFwiV2ktRmlcIiwgXCJVU0IgMTAvMTAwLzEwMDAgTEFOXCIgKi9cbiAgaGFyZHdhcmVQb3J0OiBzdHJpbmc7XG4gIC8qKiBXaS1GaSBTU0lEIGlmIGFwcGxpY2FibGUsIGVsc2UgbnVsbCAqL1xuICBzc2lkOiBzdHJpbmcgfCBudWxsO1xuICAvKiogUHJpbWFyeSBJUHY0IGlmIHByZXNlbnQgKi9cbiAgaXB2NDogc3RyaW5nIHwgbnVsbDtcbiAgLyoqIFRydWUgaWYgdXAgKyBoYXMgYW4gaW5ldCBhZGRyZXNzICovXG4gIGFjdGl2ZTogYm9vbGVhbjtcbiAgLyoqIFRydWUgaWYgdGhpcyBpcyB0aGUgc3lzdGVtJ3MgZGVmYXVsdCByb3V0ZSAqL1xuICBpc0RlZmF1bHQ6IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIZXVyaXN0aWM6IFdpLUZpIGNvbm5lY3RlZCB0aHJvdWdoIHBob25lIHRldGhlcmluZyAvIFBlcnNvbmFsIEhvdHNwb3QuXG4gICAqIERldGVjdGVkIHZpYSBrbm93biBob3RzcG90IHN1Ym5ldCByYW5nZXMgKGlQaG9uZSAxNzIuMjAuMTAuMC8yOCxcbiAgICogQW5kcm9pZCAxOTIuMTY4LjQzLjAvMjQsIGV0Yy4pLiBUaGUgbGluayB0eXBlIGlzIHN0aWxsIFwid2lmaVwiIGF0IHRoZVxuICAgKiBPUyBsZXZlbCBcdTIwMTQgdGhpcyBqdXN0IGxldHMgdXMgbGFiZWwgaXQgY29ycmVjdGx5IHRvIGh1bWFucy5cbiAgICovXG4gIGlzSG90c3BvdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOZXR3b3JrVGVzdFJlc3VsdCB7XG4gIG1vZGU6IFRlc3RNb2RlO1xuICBkb3dubG9hZEJwczogbnVtYmVyIHwgbnVsbDtcbiAgdXBsb2FkQnBzOiBudW1iZXIgfCBudWxsO1xuICByZXNwb25zaXZlbmVzc1JwbTogbnVtYmVyIHwgbnVsbDtcbiAgcmVzcG9uc2l2ZW5lc3NUaWVyOiBSZXNwb25zaXZlbmVzc1RpZXIgfCBudWxsO1xuICBiYXNlUnR0TXM6IG51bWJlciB8IG51bGw7XG4gIC8qKiBJbnRlcmZhY2UgbmV0d29ya3F1YWxpdHkgcmVwb3J0cyBpdCB0ZXN0ZWQgKGZyb20gSlNPTikgKi9cbiAgaW50ZXJmYWNlTmFtZTogc3RyaW5nO1xuICB0ZXN0RW5kcG9pbnQ6IHN0cmluZztcbiAgZmluaXNoZWRBdDogbnVtYmVyO1xufVxuXG5leHBvcnQgdHlwZSBUZXN0U3RhdHVzID0gXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwiZXJyb3JcIiB8IFwiY2FuY2VsbGVkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVzdEVycm9yRGV0YWlscyB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgLyoqIExhc3QgcmF3IG5ldHdvcmtxdWFsaXR5IHN0ZG91dCB3ZSBzYXcsIGlmIGFueS4gSGVscGZ1bCBmb3IgZGVidWdnaW5nLiAqL1xuICByYXdPdXRwdXQ/OiBzdHJpbmc7XG4gIC8qKiBMYXN0IHJhdyBzdGRlcnIgd2Ugc2F3LiAqL1xuICByYXdTdGRlcnI/OiBzdHJpbmc7XG4gIC8qKiBDTEkgYXJncyB3ZSBpbnZva2VkLiAqL1xuICBhcmdzPzogc3RyaW5nW107XG4gIC8qKiBUcnVlIGlmIHdlIHJldHJpZWQgb25jZSBiZWZvcmUgc2hvd2luZyB0aGlzIGVycm9yLiAqL1xuICB3YXNSZXRyaWVkOiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBUZXN0UGhhc2UgPSBcIndhcm11cFwiIHwgXCJtZWFzdXJpbmdcIiB8IFwiZmluYWxpemluZ1wiIHwgXCJvdmVycnVuXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVzdFByb2dyZXNzIHtcbiAgcGhhc2U6IFRlc3RQaGFzZTtcbiAgZWxhcHNlZE1zOiBudW1iZXI7XG4gIGVzdGltYXRlZFRvdGFsTXM6IG51bWJlcjtcbiAgZnJhY3Rpb246IG51bWJlcjtcbiAgb3ZlcnJ1bjogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUZXN0U3RhdGUge1xuICBzdGF0dXM6IFRlc3RTdGF0dXM7XG4gIGN1cnJlbnQ6IE5ldHdvcmtUZXN0UmVzdWx0IHwgbnVsbDtcbiAgY3VycmVudElzU3RhbGU6IGJvb2xlYW47XG4gIGVycm9yOiBUZXN0RXJyb3JEZXRhaWxzIHwgbnVsbDtcbiAgcHJvZ3Jlc3M6IFRlc3RQcm9ncmVzcyB8IG51bGw7XG4gIHJ1bm5pbmdNb2RlOiBUZXN0TW9kZSB8IG51bGw7XG4gIHJ1bm5pbmdJbnRlcmZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsO1xuICAvKiogVGhlIGludGVyZmFjZSBhdHRhY2hlZCB0byBgY3VycmVudGAgKHdoYXQgd2FzIHVzZWQgdG8gcHJvZHVjZSBpdCkuICovXG4gIGN1cnJlbnRJbnRlcmZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfCBudWxsO1xufVxuXG4vKiogV2hhdCB3ZSBwZXJzaXN0IHRvIGhpc3RvcnkuanNvbmwsIG9uZSBwZXIgY29tcGxldGVkIChvciBmYWlsZWQpIHRlc3QuICovXG5leHBvcnQgaW50ZXJmYWNlIEhpc3RvcnlFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyO1xuICBmaW5pc2hlZEF0OiBudW1iZXI7XG4gIGR1cmF0aW9uTXM6IG51bWJlcjtcbiAgbW9kZTogVGVzdE1vZGU7XG4gIGludGVyZmFjZTogTmV0d29ya0ludGVyZmFjZTtcbiAgcmVzdWx0OiBOZXR3b3JrVGVzdFJlc3VsdCB8IG51bGw7XG4gIGVycm9yOiBzdHJpbmcgfCBudWxsO1xuICAvKiogU2V0IHdoZW4gdGhpcyBlbnRyeSB3YXMgcGFydCBvZiBhIGNvbXBhcmUtbmV0d29ya3MgcnVuLiAqL1xuICBjb21wYXJlUnVuSWQ6IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCB0eXBlIENvbXBhcmVJdGVtU3RhdHVzID1cbiAgfCBcInBlbmRpbmdcIlxuICB8IFwic3dpdGNoaW5nXCJcbiAgfCBcInJ1bm5pbmdcIlxuICB8IFwiZG9uZVwiXG4gIHwgXCJlcnJvclwiXG4gIHwgXCJ1bnJlYWNoYWJsZVwiIC8vIFdpLUZpIHN3aXRjaCBmYWlsZWQgKG5vdCBpbiByYW5nZSwgYXV0aCByZWZ1c2VkKVxuICB8IFwiY2FwdGl2ZVwiOyAvLyBXaS1GaSBzd2l0Y2hlZCBidXQgbGFuZGVkIG9uIGEgY2FwdGl2ZSBwb3J0YWxcblxuLyoqXG4gKiBXaGF0IHdlJ3JlIGNvbXBhcmluZy4gRWl0aGVyIGFuIGFscmVhZHktYWN0aXZlIGludGVyZmFjZSAobm8gc3dpdGNoaW5nXG4gKiBuZWVkZWQpIG9yIGEgc2F2ZWQgV2ktRmkgU1NJRCB3ZSdkIG5lZWQgdG8gc3dpdGNoIHRvLlxuICovXG5leHBvcnQgdHlwZSBDb21wYXJlVGFyZ2V0ID1cbiAgfCB7IGtpbmQ6IFwiYWN0aXZlXCI7IGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlIH1cbiAgfCB7IGtpbmQ6IFwia25vd25XaWZpXCI7IHNzaWQ6IHN0cmluZyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBhcmVJdGVtIHtcbiAgdGFyZ2V0OiBDb21wYXJlVGFyZ2V0O1xuICAvKiogVGhlIGludGVyZmFjZSBldmVudHVhbGx5IHVzZWQgdG8gcHJvZHVjZSB0aGUgcmVzdWx0IChhbHdheXMgV2ktRmkgZm9yIGtub3duV2lmaSB0YXJnZXRzKS4gKi9cbiAgaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2U7XG4gIHN0YXR1czogQ29tcGFyZUl0ZW1TdGF0dXM7XG4gIHJlc3VsdDogTmV0d29ya1Rlc3RSZXN1bHQgfCBudWxsO1xuICBlcnJvcjogc3RyaW5nIHwgbnVsbDtcbiAgcHJvZ3Jlc3M6IFRlc3RQcm9ncmVzcyB8IG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGFyZVN0YXRlIHtcbiAgcnVuSWQ6IHN0cmluZztcbiAgbW9kZTogVGVzdE1vZGU7XG4gIGl0ZW1zOiBDb21wYXJlSXRlbVtdO1xuICAvKiogSW5kZXggaW4gaXRlbXNbXSBjdXJyZW50bHkgcnVubmluZywgb3IgLTEgd2hlbiBkb25lL2lkbGUuICovXG4gIGFjdGl2ZUluZGV4OiBudW1iZXI7XG4gIHN0YXR1czogXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwiZG9uZVwiIHwgXCJjYW5jZWxsZWRcIjtcbiAgLyoqIFNTSUQgd2UnbGwgcmVzdG9yZSB0byBhZnRlciB0aGUgcnVuIChzbmFwc2hvdHRlZCBhdCBzdGFydCkuICovXG4gIG9yaWdpbmFsU1NJRDogc3RyaW5nIHwgbnVsbDtcbiAgLyoqIFRydWUgaWYgd2Ugc3VjY2Vzc2Z1bGx5IHJlc3RvcmVkIGF0IGVuZC4gKi9cbiAgZGlkUmVzdG9yZTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcmdldEtleSh0OiBDb21wYXJlVGFyZ2V0KTogc3RyaW5nIHtcbiAgcmV0dXJuIHQua2luZCA9PT0gXCJhY3RpdmVcIiA/IGBhY3RpdmU6JHt0LmlmYWNlLm5hbWV9YCA6IGB3aWZpOiR7dC5zc2lkfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXJnZXRJc1N3aXRjaCh0OiBDb21wYXJlVGFyZ2V0KTogYm9vbGVhbiB7XG4gIHJldHVybiB0LmtpbmQgPT09IFwia25vd25XaWZpXCI7XG59XG4iLCAiaW1wb3J0IHsgQWN0aW9uLCBBY3Rpb25QYW5lbCwgQ29sb3IsIERldGFpbCwgSWNvbiB9IGZyb20gXCJAcmF5Y2FzdC9hcGlcIjtcbmltcG9ydCB0eXBlIHsgSGlzdG9yeUVudHJ5LCBSZXNwb25zaXZlbmVzc1RpZXIsIFNwZWVkVGllciB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHtcbiAgZm9ybWF0RWxhcHNlZCxcbiAgZm9ybWF0TGF0ZW5jeSxcbiAgZm9ybWF0UmVsYXRpdmVUaW1lLFxuICBmb3JtYXRSZXNwb25zaXZlbmVzcyxcbiAgZm9ybWF0VGhyb3VnaHB1dCxcbiAgbW9kZUxhYmVsLFxufSBmcm9tIFwiLi4vbGliL2Zvcm1hdFwiO1xuaW1wb3J0IHtcbiAgY2xhc3NpZnlTcGVlZCxcbiAgZG93bmxvYWRDb250ZXh0LFxuICByZW5kZXJMb2dNZXRlcixcbiAgc3BlZWRUaWVyTGFiZWwsXG4gIHVwbG9hZENvbnRleHQsXG59IGZyb20gXCIuLi9saWIvc3BlZWRcIjtcbmltcG9ydCB7IGdlbmVyYXRlU3VtbWFyeSB9IGZyb20gXCIuLi9saWIvc3VtbWFyeVwiO1xuaW1wb3J0IHsgZGlzcGxheU5hbWUgfSBmcm9tIFwiLi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuaW1wb3J0IHsgTmV0d29ya0NvbnRleHRNZXRhZGF0YSB9IGZyb20gXCIuL05ldHdvcmtCYWRnZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gSGlzdG9yeUVudHJ5RGV0YWlsKHsgZW50cnkgfTogeyBlbnRyeTogSGlzdG9yeUVudHJ5IH0pIHtcbiAgcmV0dXJuIChcbiAgICA8RGV0YWlsXG4gICAgICBtYXJrZG93bj17cmVuZGVyTWFya2Rvd24oZW50cnkpfVxuICAgICAgbWV0YWRhdGE9e1xuICAgICAgICA8RGV0YWlsLk1ldGFkYXRhPlxuICAgICAgICAgIHtlbnRyeS5yZXN1bHQ/LmRvd25sb2FkQnBzICE9IG51bGwgJiYgKFxuICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0IHRpdGxlPVwiRG93bmxvYWRcIj5cbiAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICB0ZXh0PXtgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyl9IFx1MDBCNyAke3NwZWVkVGllckxhYmVsKGNsYXNzaWZ5U3BlZWQoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKSl9YH1cbiAgICAgICAgICAgICAgICBjb2xvcj17c3BlZWRUaWVyQ29sb3IoY2xhc3NpZnlTcGVlZChlbnRyeS5yZXN1bHQuZG93bmxvYWRCcHMpKX1cbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93RG93bn1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3Q+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7ZW50cnkucmVzdWx0Py51cGxvYWRCcHMgIT0gbnVsbCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLlRhZ0xpc3QgdGl0bGU9XCJVcGxvYWRcIj5cbiAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICB0ZXh0PXtgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpfSBcdTAwQjcgJHtzcGVlZFRpZXJMYWJlbChjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpKX1gfVxuICAgICAgICAgICAgICAgIGNvbG9yPXtzcGVlZFRpZXJDb2xvcihjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpKX1cbiAgICAgICAgICAgICAgICBpY29uPXtJY29uLkFycm93VXB9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0RldGFpbC5NZXRhZGF0YS5UYWdMaXN0PlxuICAgICAgICAgICl9XG4gICAgICAgICAge2VudHJ5LnJlc3VsdCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICAgIHRpdGxlPVwiTGF0ZW5jeVwiXG4gICAgICAgICAgICAgIHRleHQ9e2Zvcm1hdExhdGVuY3koZW50cnkucmVzdWx0LmJhc2VSdHRNcyl9XG4gICAgICAgICAgICAgIGljb249e0ljb24uR2F1Z2V9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAge2VudHJ5LnJlc3VsdD8ucmVzcG9uc2l2ZW5lc3NScG0gIT0gbnVsbCAmJlxuICAgICAgICAgICAgZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllciAmJiAoXG4gICAgICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuVGFnTGlzdCB0aXRsZT1cIlJlc3BvbnNpdmVuZXNzXCI+XG4gICAgICAgICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5UYWdMaXN0Lkl0ZW1cbiAgICAgICAgICAgICAgICAgIHRleHQ9e2Zvcm1hdFJlc3BvbnNpdmVuZXNzKFxuICAgICAgICAgICAgICAgICAgICBlbnRyeS5yZXN1bHQucmVzcG9uc2l2ZW5lc3NScG0sXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5LnJlc3VsdC5yZXNwb25zaXZlbmVzc1RpZXIsXG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgY29sb3I9e3Jlc3BvbnNpdmVuZXNzQ29sb3IoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzVGllcil9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9EZXRhaWwuTWV0YWRhdGEuVGFnTGlzdD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPERldGFpbC5NZXRhZGF0YS5TZXBhcmF0b3IgLz5cbiAgICAgICAgICA8TmV0d29ya0NvbnRleHRNZXRhZGF0YSBpZmFjZT17ZW50cnkuaW50ZXJmYWNlfSAvPlxuICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJNb2RlXCIgdGV4dD17bW9kZUxhYmVsKGVudHJ5Lm1vZGUpfSAvPlxuICAgICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICAgIHRpdGxlPVwiUnVuIGR1cmF0aW9uXCJcbiAgICAgICAgICAgIHRleHQ9e2Zvcm1hdEVsYXBzZWQoZW50cnkuZHVyYXRpb25Ncyl9XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICB0aXRsZT1cIldoZW5cIlxuICAgICAgICAgICAgdGV4dD17Zm9ybWF0UmVsYXRpdmVUaW1lKGVudHJ5LmZpbmlzaGVkQXQpfVxuICAgICAgICAgIC8+XG4gICAgICAgICAge2VudHJ5LmNvbXBhcmVSdW5JZCAmJiAoXG4gICAgICAgICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgICAgICAgIHRpdGxlPVwiQ29tcGFyZSBydW5cIlxuICAgICAgICAgICAgICB0ZXh0PXtlbnRyeS5jb21wYXJlUnVuSWQuc2xpY2UoMCwgOCl9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRGV0YWlsLk1ldGFkYXRhPlxuICAgICAgfVxuICAgICAgYWN0aW9ucz17XG4gICAgICAgIDxBY3Rpb25QYW5lbD5cbiAgICAgICAgICA8QWN0aW9uLkNvcHlUb0NsaXBib2FyZFxuICAgICAgICAgICAgdGl0bGU9XCJDb3B5IEVudHJ5IGFzIEpTT05cIlxuICAgICAgICAgICAgY29udGVudD17SlNPTi5zdHJpbmdpZnkoZW50cnksIG51bGwsIDIpfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQWN0aW9uUGFuZWw+XG4gICAgICB9XG4gICAgLz5cbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWFya2Rvd24oZW50cnk6IEhpc3RvcnlFbnRyeSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICBsaW5lcy5wdXNoKGAjICR7ZGlzcGxheU5hbWUoZW50cnkuaW50ZXJmYWNlKX1gKTtcbiAgbGluZXMucHVzaChcIlwiKTtcbiAgbGluZXMucHVzaChcbiAgICBgKiR7Zm9ybWF0UmVsYXRpdmVUaW1lKGVudHJ5LmZpbmlzaGVkQXQpfSBcdTAwQjcgJHttb2RlTGFiZWwoZW50cnkubW9kZSl9KmAsXG4gICk7XG4gIGxpbmVzLnB1c2goXCJcIik7XG5cbiAgaWYgKGVudHJ5LmVycm9yKSB7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKGVudHJ5LmVycm9yKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuICB9XG4gIGlmICghZW50cnkucmVzdWx0KSByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcblxuICBsaW5lcy5wdXNoKGA+ICR7Z2VuZXJhdGVTdW1tYXJ5KGVudHJ5LnJlc3VsdCl9YCk7XG4gIGxpbmVzLnB1c2goXCJcIik7XG5cbiAgaWYgKGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyAhPT0gbnVsbCkge1xuICAgIGNvbnN0IHQgPSBjbGFzc2lmeVNwZWVkKGVudHJ5LnJlc3VsdC5kb3dubG9hZEJwcyk7XG4gICAgbGluZXMucHVzaChcbiAgICAgIGAjIyMgXHUyMTkzIERvd25sb2FkICAke2Zvcm1hdFRocm91Z2hwdXQoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKX0gIFx1MDBCNyAgJHtzcGVlZFRpZXJMYWJlbCh0KX0gXHUyMDE0ICR7ZG93bmxvYWRDb250ZXh0KHQpfWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIGxpbmVzLnB1c2gocmVuZGVyTG9nTWV0ZXIoZW50cnkucmVzdWx0LmRvd25sb2FkQnBzKSk7XG4gICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICB9XG4gIGlmIChlbnRyeS5yZXN1bHQudXBsb2FkQnBzICE9PSBudWxsKSB7XG4gICAgY29uc3QgdCA9IGNsYXNzaWZ5U3BlZWQoZW50cnkucmVzdWx0LnVwbG9hZEJwcyk7XG4gICAgbGluZXMucHVzaChcbiAgICAgIGAjIyMgXHUyMTkxIFVwbG9hZCAgJHtmb3JtYXRUaHJvdWdocHV0KGVudHJ5LnJlc3VsdC51cGxvYWRCcHMpfSAgXHUwMEI3ICAke3NwZWVkVGllckxhYmVsKHQpfSBcdTIwMTQgJHt1cGxvYWRDb250ZXh0KHQpfWAsXG4gICAgKTtcbiAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgIGxpbmVzLnB1c2gocmVuZGVyTG9nTWV0ZXIoZW50cnkucmVzdWx0LnVwbG9hZEJwcykpO1xuICAgIGxpbmVzLnB1c2goXCJgYGBcIik7XG4gICAgbGluZXMucHVzaChcIlwiKTtcbiAgfVxuXG4gIGxpbmVzLnB1c2goXG4gICAgYCoqTGF0ZW5jeSoqICAke2Zvcm1hdExhdGVuY3koZW50cnkucmVzdWx0LmJhc2VSdHRNcyl9YCArXG4gICAgICAoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtICE9PSBudWxsXG4gICAgICAgID8gYCAgXHUwMEI3ICAqKlJlc3BvbnNpdmVuZXNzKiogICR7Zm9ybWF0UmVzcG9uc2l2ZW5lc3MoZW50cnkucmVzdWx0LnJlc3BvbnNpdmVuZXNzUnBtLCBlbnRyeS5yZXN1bHQucmVzcG9uc2l2ZW5lc3NUaWVyKX1gXG4gICAgICAgIDogXCJcIiksXG4gICk7XG5cbiAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIHJlc3BvbnNpdmVuZXNzQ29sb3IodGllcjogUmVzcG9uc2l2ZW5lc3NUaWVyKTogQ29sb3Ige1xuICBzd2l0Y2ggKHRpZXIpIHtcbiAgICBjYXNlIFwiaGlnaFwiOlxuICAgICAgcmV0dXJuIENvbG9yLkdyZWVuO1xuICAgIGNhc2UgXCJtZWRpdW1cIjpcbiAgICAgIHJldHVybiBDb2xvci5ZZWxsb3c7XG4gICAgY2FzZSBcImxvd1wiOlxuICAgICAgcmV0dXJuIENvbG9yLlJlZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBzcGVlZFRpZXJDb2xvcih0aWVyOiBTcGVlZFRpZXIpOiBDb2xvciB7XG4gIHN3aXRjaCAodGllcikge1xuICAgIGNhc2UgXCJwb29yXCI6XG4gICAgICByZXR1cm4gQ29sb3IuUmVkO1xuICAgIGNhc2UgXCJva1wiOlxuICAgICAgcmV0dXJuIENvbG9yLk9yYW5nZTtcbiAgICBjYXNlIFwiZ29vZFwiOlxuICAgICAgcmV0dXJuIENvbG9yLlllbGxvdztcbiAgICBjYXNlIFwiZ3JlYXRcIjpcbiAgICAgIHJldHVybiBDb2xvci5HcmVlbjtcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICByZXR1cm4gQ29sb3IuQmx1ZTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlIHsgTmV0d29ya1Rlc3RSZXN1bHQgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGNsYXNzaWZ5U3BlZWQgfSBmcm9tIFwiLi9zcGVlZFwiO1xuXG4vKipcbiAqIERldGVybWluaXN0aWMgcGxhaW4tRW5nbGlzaCB2ZXJkaWN0IGZvciBhIHJlc3VsdC4gT25lIHNlbnRlbmNlLlxuICogRGVzaWduZWQgZm9yIHNvbWVvbmUgd2hvIGRvZXNuJ3Qga25vdyB3aGF0IFJQTSBtZWFucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlU3VtbWFyeShyZXN1bHQ6IE5ldHdvcmtUZXN0UmVzdWx0KTogc3RyaW5nIHtcbiAgY29uc3QgZGxUaWVyID1cbiAgICByZXN1bHQuZG93bmxvYWRCcHMgIT09IG51bGwgPyBjbGFzc2lmeVNwZWVkKHJlc3VsdC5kb3dubG9hZEJwcykgOiBudWxsO1xuICBjb25zdCB1bFRpZXIgPVxuICAgIHJlc3VsdC51cGxvYWRCcHMgIT09IG51bGwgPyBjbGFzc2lmeVNwZWVkKHJlc3VsdC51cGxvYWRCcHMpIDogbnVsbDtcbiAgY29uc3QgcmVzcExvdyA9IHJlc3VsdC5yZXNwb25zaXZlbmVzc1RpZXIgPT09IFwibG93XCI7XG5cbiAgLy8gTm8gbWVhc3VyZW1lbnRzIGF0IGFsbCBcdTIwMTQgc2hvdWxkbid0IHJlYWxseSBoYXBwZW5cbiAgaWYgKGRsVGllciA9PT0gbnVsbCAmJiB1bFRpZXIgPT09IG51bGwpIHtcbiAgICByZXR1cm4gXCJDb3VsZG4ndCBtZWFzdXJlIHRocm91Z2hwdXQuIENvbm5lY3Rpb24gbWF5IGJlIHVuc3RhYmxlLlwiO1xuICB9XG5cbiAgLy8gU2luZ2xlIGRpcmVjdGlvbiBvbmx5XG4gIGlmIChkbFRpZXIgPT09IG51bGwpIHJldHVybiB2ZXJkaWN0VXBsb2FkKHVsVGllciEsIHJlc3BMb3cpO1xuICBpZiAodWxUaWVyID09PSBudWxsKSByZXR1cm4gdmVyZGljdERvd25sb2FkKGRsVGllciwgcmVzcExvdyk7XG5cbiAgLy8gQ29tYmluZWQgdmVyZGljdFxuICBjb25zdCBtaW4gPSBtaW5UaWVyKGRsVGllciwgdWxUaWVyKTtcbiAgbGV0IHZlcmRpY3Q6IHN0cmluZztcbiAgc3dpdGNoIChtaW4pIHtcbiAgICBjYXNlIFwicG9vclwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiU2xvdyBjb25uZWN0aW9uIFx1MjAxNCBiYXNpYyBicm93c2luZyBvbmx5LCBleHBlY3QgaXNzdWVzIHdpdGggdmlkZW8gY2FsbHMuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwib2tcIjpcbiAgICAgIHZlcmRpY3QgPVxuICAgICAgICBcIkRlY2VudCBjb25uZWN0aW9uIFx1MjAxNCBIRCBzdHJlYW1pbmcgYW5kIG9uZS1vbi1vbmUgdmlkZW8gY2FsbHMgc2hvdWxkIHdvcmsuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZ29vZFwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiU29saWQgY29ubmVjdGlvbiBcdTIwMTQgaGFuZGxlcyA0SyBzdHJlYW1pbmcgYW5kIG1vc3QgdmlkZW8gd29yayBjb21mb3J0YWJseS5cIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJncmVhdFwiOlxuICAgICAgdmVyZGljdCA9XG4gICAgICAgIFwiRmFzdCBjb25uZWN0aW9uIFx1MjAxNCBwbGVudHkgb2YgaGVhZHJvb20gZm9yIHN0cmVhbWluZywgY2FsbHMsIGFuZCBsYXJnZSB0cmFuc2ZlcnMuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiZXhjZWxsZW50XCI6XG4gICAgICB2ZXJkaWN0ID1cbiAgICAgICAgXCJFeGNlbGxlbnQgY29ubmVjdGlvbiBcdTIwMTQgZ2lnYWJpdC1jbGFzcywgbm8gcHJhY3RpY2FsIGJvdHRsZW5lY2tzLlwiO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBpZiAocmVzcExvdykge1xuICAgIHZlcmRpY3QgKz1cbiAgICAgIFwiIFJlc3BvbnNpdmVuZXNzIGlzIGxvdyB0aG91Z2ggXHUyMDE0IHZpZGVvIGNhbGxzIGFuZCBnYW1pbmcgbWF5IHN0dXR0ZXIgdW5kZXIgbG9hZCAoYnVmZmVyYmxvYXQpLlwiO1xuICB9XG4gIHJldHVybiB2ZXJkaWN0O1xufVxuXG5mdW5jdGlvbiB2ZXJkaWN0RG93bmxvYWQoXG4gIHRpZXI6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PixcbiAgcmVzcExvdzogYm9vbGVhbixcbik6IHN0cmluZyB7XG4gIGNvbnN0IGJhc2UgPSB7XG4gICAgcG9vcjogXCJEb3dubG9hZCBpcyBzbG93IFx1MjAxNCBIRCBzdHJlYW1pbmcgd2lsbCBzdHJ1Z2dsZS5cIixcbiAgICBvazogXCJEb3dubG9hZCBpcyBPSyBmb3IgSEQgc3RyZWFtaW5nIGFuZCBiYXNpYyB1c2UuXCIsXG4gICAgZ29vZDogXCJEb3dubG9hZCBpcyBzb2xpZCBcdTIwMTQgNEsgc3RyZWFtaW5nIHdvcmtzIGNvbWZvcnRhYmx5LlwiLFxuICAgIGdyZWF0OiBcIkRvd25sb2FkIGlzIGZhc3QgXHUyMDE0IHBsZW50eSBvZiBoZWFkcm9vbSBmb3IgaGVhdnkgdXNlLlwiLFxuICAgIGV4Y2VsbGVudDogXCJEb3dubG9hZCBpcyBnaWdhYml0LWNsYXNzLlwiLFxuICB9W3RpZXJdO1xuICByZXR1cm4gcmVzcExvdyA/IGAke2Jhc2V9IFJlc3BvbnNpdmVuZXNzIGlzIGxvdyAoYnVmZmVyYmxvYXQpLmAgOiBiYXNlO1xufVxuXG5mdW5jdGlvbiB2ZXJkaWN0VXBsb2FkKFxuICB0aWVyOiBOb25OdWxsYWJsZTxSZXR1cm5UeXBlPHR5cGVvZiBjbGFzc2lmeVNwZWVkPj4sXG4gIHJlc3BMb3c6IGJvb2xlYW4sXG4pOiBzdHJpbmcge1xuICBjb25zdCBiYXNlID0ge1xuICAgIHBvb3I6IFwiVXBsb2FkIGlzIHNsb3cgXHUyMDE0IHZpZGVvIGNhbGxzIGFuZCB1cGxvYWRzIHdpbGwgYmUgcGFpbmZ1bC5cIixcbiAgICBvazogXCJVcGxvYWQgaGFuZGxlcyBIRCB2aWRlbyBjYWxscy5cIixcbiAgICBnb29kOiBcIlVwbG9hZCBpcyBzb2xpZCBcdTIwMTQgZmluZSBmb3IgbGl2ZSBzdHJlYW1pbmcuXCIsXG4gICAgZ3JlYXQ6XG4gICAgICBcIlVwbG9hZCBpcyBmYXN0IFx1MjAxNCBwcm9mZXNzaW9uYWwgc3RyZWFtaW5nIGFuZCBsYXJnZSB1cGxvYWRzIHdvcmsgd2VsbC5cIixcbiAgICBleGNlbGxlbnQ6IFwiVXBsb2FkIGlzIGdpZ2FiaXQtY2xhc3MgXHUyMDE0IHN5bW1ldHJpYyBjb25uZWN0aW9uLlwiLFxuICB9W3RpZXJdO1xuICByZXR1cm4gcmVzcExvdyA/IGAke2Jhc2V9IFJlc3BvbnNpdmVuZXNzIGlzIGxvdyAoYnVmZmVyYmxvYXQpLmAgOiBiYXNlO1xufVxuXG5mdW5jdGlvbiBtaW5UaWVyKFxuICBhOiBOb25OdWxsYWJsZTxSZXR1cm5UeXBlPHR5cGVvZiBjbGFzc2lmeVNwZWVkPj4sXG4gIGI6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+Pixcbik6IE5vbk51bGxhYmxlPFJldHVyblR5cGU8dHlwZW9mIGNsYXNzaWZ5U3BlZWQ+PiB7XG4gIGNvbnN0IG9yZGVyID0gW1wicG9vclwiLCBcIm9rXCIsIFwiZ29vZFwiLCBcImdyZWF0XCIsIFwiZXhjZWxsZW50XCJdIGFzIGNvbnN0O1xuICByZXR1cm4gb3JkZXIuaW5kZXhPZihhKSA8IG9yZGVyLmluZGV4T2YoYikgPyBhIDogYjtcbn1cbiIsICJpbXBvcnQgeyBDb2xvciwgRGV0YWlsLCBJY29uIH0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHR5cGUgeyBOZXR3b3JrSW50ZXJmYWNlIH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBkaXNwbGF5TmFtZSwgaXNTU0lEUGVybWlzc2lvbk1pc3NpbmcgfSBmcm9tIFwiLi4vc2VydmljZXMvaW50ZXJmYWNlc1wiO1xuXG4vKipcbiAqIFN0YW5kYXJkIHNldCBvZiBtZXRhZGF0YSByb3dzIGRlc2NyaWJpbmcgdGhlIG5ldHdvcmsgYW4gYWN0aXZlL2NvbXBsZXRlZFxuICogdGVzdCB3YXMgcnVuIG9uLiBEcm9wIGluc2lkZSBhIDxEZXRhaWwuTWV0YWRhdGE+LlxuICovXG5leHBvcnQgZnVuY3Rpb24gTmV0d29ya0NvbnRleHRNZXRhZGF0YSh7IGlmYWNlIH06IHsgaWZhY2U6IE5ldHdvcmtJbnRlcmZhY2UgfSkge1xuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8RGV0YWlsLk1ldGFkYXRhLkxhYmVsXG4gICAgICAgIHRpdGxlPVwiTmV0d29ya1wiXG4gICAgICAgIHRleHQ9e2Rpc3BsYXlOYW1lKGlmYWNlKX1cbiAgICAgICAgaWNvbj17aWNvbkZvcihpZmFjZSl9XG4gICAgICAvPlxuICAgICAgPERldGFpbC5NZXRhZGF0YS5MYWJlbCB0aXRsZT1cIkludGVyZmFjZVwiIHRleHQ9e2lmYWNlLm5hbWV9IC8+XG4gICAgICB7aWZhY2UuaXB2NCAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJMb2NhbCBJUFwiIHRleHQ9e2lmYWNlLmlwdjR9IC8+XG4gICAgICApfVxuICAgICAge2lmYWNlLmlzRGVmYXVsdCAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWwgdGl0bGU9XCJEZWZhdWx0IHJvdXRlXCIgdGV4dD1cIlllc1wiIC8+XG4gICAgICApfVxuICAgICAge2lzU1NJRFBlcm1pc3Npb25NaXNzaW5nKGlmYWNlKSAmJiAoXG4gICAgICAgIDxEZXRhaWwuTWV0YWRhdGEuTGFiZWxcbiAgICAgICAgICB0aXRsZT1cIk5ldHdvcmsgbmFtZVwiXG4gICAgICAgICAgdGV4dD1cIkdyYW50IExvY2F0aW9uIFNlcnZpY2VzIHRvIHJlYWQgU1NJRFwiXG4gICAgICAgICAgaWNvbj17eyBzb3VyY2U6IEljb24uSW5mbywgdGludENvbG9yOiBDb2xvci5ZZWxsb3cgfX1cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgPC8+XG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpY29uRm9yKGlmYWNlOiBOZXR3b3JrSW50ZXJmYWNlKTogSWNvbiB7XG4gIGlmIChpZmFjZS5pc0hvdHNwb3QpIHJldHVybiBJY29uLk1vYmlsZTtcbiAgc3dpdGNoIChpZmFjZS50eXBlKSB7XG4gICAgY2FzZSBcIndpZmlcIjpcbiAgICAgIHJldHVybiBJY29uLldpZmk7XG4gICAgY2FzZSBcImV0aGVybmV0XCI6XG4gICAgICByZXR1cm4gSWNvbi5QbHVnO1xuICAgIGNhc2UgXCJ0aHVuZGVyYm9sdFwiOlxuICAgICAgcmV0dXJuIEljb24uQm9sdDtcbiAgICBjYXNlIFwidXNiXCI6XG4gICAgICByZXR1cm4gSWNvbi5Nb2JpbGU7XG4gICAgY2FzZSBcImJsdWV0b290aFwiOlxuICAgICAgcmV0dXJuIEljb24uQmx1ZXRvb3RoO1xuICAgIGNhc2UgXCJvdGhlclwiOlxuICAgICAgcmV0dXJuIEljb24uTmV0d29yaztcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLGNBU087QUFDUCxJQUFBQyxnQkFBd0U7OztBQ1Z4RSx5QkFBMkI7QUFDM0IsbUJBQXlEOzs7QUNEekQsZ0NBQXlCO0FBQ3pCLHVCQUEwQjtBQUcxQixJQUFNLG9CQUFnQiw0QkFBVSxrQ0FBUTtBQUV4QyxJQUFNLHFCQUFxQjtBQUMzQixJQUFNLGtCQUFrQjtB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V0FBVyxRQUFRLFlBQVk7QUFDckMsU0FBSyxLQUFLO0FBQUEsTUFDUixLQUFLO0FBQUEsUUFDSCxPQUFPLEdBQUcsY0FBYyxLQUFLLE9BQU8sU0FBUyxDQUFDLEdBQUcsV0FBVyxZQUFPLEVBQUU7QUFBQSxRQUNyRSxPQUFPLFdBQVcsa0JBQU0sUUFBUTtBQUFBLE1BQ2xDO0FBQUEsTUFDQSxTQUFTLFVBQVUsV0FBVyxpQkFBYyxFQUFFO0FBQUEsSUFDaEQsQ0FBQztBQUFBLEVBQ0g7QUFDQSxTQUFPO0FBQ1Q7QUFFQSxTQUFTQSxnQkFBZSxNQUF3QjtBQUM5QyxVQUFRLE1BQU07QUFBQSxJQUNaLEtBQUs7QUFDSCxhQUFPLGtCQUFNO0FBQUEsSUFDZixLQUFLO0FBQ0gsYUFBTyxrQkFBTTtBQUFBLElBQ2YsS0FBSztBQUNILGFBQU8sa0JBQU07QUFBQSxJQUNmLEtBQUs7QUFDSCxhQUFPLGtCQUFNO0FBQUEsSUFDZixLQUFLO0FBQ0gsYUFBTyxrQkFBTTtBQUFBLEVBQ2pCO0FBQ0Y7QUFFQSxTQUFTLGVBQ1AsTUFDQSxNQUNBLE9BQ2M7QUFDZCxTQUFPO0FBQUEsSUFDTCxJQUFJLEdBQUcsS0FBSyxJQUFJLFVBQVUsS0FBSyxNQUFNLENBQUM7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxZQUFZLEtBQUssUUFBUSxjQUFjLEtBQUssSUFBSTtBQUFBLElBQ2hELFlBQVk7QUFBQSxJQUNaO0FBQUEsSUFDQSxXQUFXLEtBQUs7QUFBQSxJQUNoQixRQUFRLEtBQUs7QUFBQSxJQUNiLE9BQU8sS0FBSztBQUFBLElBQ1osY0FBYztBQUFBLEVBQ2hCO0FBQ0Y7QUFFQSxTQUFTLGtCQUNQLE9BQ0EsZUFDQSxZQUNRO0FBQ1IsTUFBSSxNQUFNLFdBQVcsVUFBVyxRQUFPO0FBQ3ZDLE1BQUksTUFBTSxXQUFXO0FBQ25CLFdBQU87QUFDVCxNQUFJLGVBQWUsRUFBRyxRQUFPO0FBQzdCLFNBQU8sR0FBRyxhQUFhLElBQUksVUFBVTtBQUN2QzsiLAogICJuYW1lcyI6IFsiaW1wb3J0X2FwaSIsICJpbXBvcnRfcmVhY3QiLCAiaW1wb3J0X25vZGVfY2hpbGRfcHJvY2VzcyIsICJpbXBvcnRfbm9kZV91dGlsIiwgImV4ZWNGaWxlQXN5bmMiLCAiZXhlY0ZpbGVBc3luYyIsICJwYXRoIiwgImZzIiwgImltcG9ydF9hcGkiLCAiaW1wb3J0X2FwaSIsICJpbXBvcnRfYXBpIiwgImltcG9ydF9qc3hfcnVudGltZSIsICJpbXBvcnRfanN4X3J1bnRpbWUiLCAic3BlZWRUaWVyQ29sb3IiXQp9Cg==
