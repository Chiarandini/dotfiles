var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/test-ai-connection.tsx
var test_ai_connection_exports = {};
__export(test_ai_connection_exports, {
  default: () => TestAiConnection
});
module.exports = __toCommonJS(test_ai_connection_exports);
var import_api = require("@raycast/api");
var import_react = require("react");
var TRIALS = [
  {
    name: "Tiny (Haiku 4.5)",
    model: import_api.AI.Model["Anthropic_Claude_4.5_Haiku"],
    prompt: "Reply with exactly the word OK and nothing else."
  },
  {
    name: "Small batch JSON (Haiku 4.5)",
    model: import_api.AI.Model["Anthropic_Claude_4.5_Haiku"],
    prompt: [
      'Classify each file by topic. Respond ONLY with a JSON array: [{"index":N,"topic":"..."}, ...].',
      "Files:",
      "1. On_Species.pdf",
      "2. Riemann_Hypothesis.pdf",
      "3. Capital.pdf"
    ].join("\n")
  },
  {
    name: "Tiny (GPT-4o mini)",
    model: import_api.AI.Model["OpenAI_GPT-4o_mini"],
    prompt: "Reply with exactly the word OK and nothing else."
  }
];
function TestAiConnection() {
  const [results, setResults] = (0, import_react.useState)(
    () => Object.fromEntries(TRIALS.map((t) => [t.name, { phase: "idle" }]))
  );
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    (async () => {
      for (const trial of TRIALS) {
        if (controller.signal.aborted) return;
        setResults((r) => ({ ...r, [trial.name]: { phase: "running" } }));
        const startedAt = Date.now();
        console.log(`[test-ai] ${trial.name}: starting (model=${trial.model})`);
        try {
          const response = await import_api.AI.ask(trial.prompt, {
            model: trial.model,
            creativity: "low",
            signal: controller.signal
          });
          const elapsedMs = Date.now() - startedAt;
          console.log(
            `[test-ai] ${trial.name}: OK in ${elapsedMs}ms (${response.length} bytes): ${response.slice(0, 80).replace(/\n/g, " ")}`
          );
          setResults((r) => ({
            ...r,
            [trial.name]: { phase: "done", elapsedMs, response }
          }));
        } catch (err) {
          const elapsedMs = Date.now() - startedAt;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(
            `[test-ai] ${trial.name}: FAIL in ${elapsedMs}ms: ${msg}`
          );
          setResults((r) => ({
            ...r,
            [trial.name]: { phase: "error", elapsedMs, error: msg }
          }));
        }
      }
      setIsLoading(false);
      (0, import_api.showToast)({ style: import_api.Toast.Style.Success, title: "Test complete" });
    })();
    return () => controller.abort();
  }, []);
  const markdown = (0, import_react.useMemo)(() => {
    const lines = ["# Raycast AI Connection Test", ""];
    for (const trial of TRIALS) {
      const r = results[trial.name];
      lines.push(`## ${trial.name}`);
      lines.push(`- **Model:** \`${trial.model}\``);
      if (r.phase === "idle") lines.push("- _Queued\u2026_");
      else if (r.phase === "running") lines.push("- \u23F3 _Running\u2026_");
      else if (r.phase === "done") {
        lines.push(`- \u2705 **Succeeded** in ${r.elapsedMs}ms`);
        lines.push("- **Response (first 200 chars):**");
        lines.push("");
        lines.push("```");
        lines.push((r.response ?? "").slice(0, 200));
        lines.push("```");
      } else if (r.phase === "error") {
        lines.push(`- \u274C **Failed** in ${r.elapsedMs}ms`);
        lines.push("- **Error:**");
        lines.push("");
        lines.push("```");
        lines.push(r.error ?? "(no error message)");
        lines.push("```");
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
    lines.push(
      "Full logs are in the terminal running `npm run dev` (look for `[test-ai]` lines)."
    );
    return lines.join("\n");
  }, [results]);
  return /* @__PURE__ */ _jsx(
    import_api.Detail,
    {
      isLoading,
      markdown,
      navigationTitle: "Test AI Connection",
      actions: /* @__PURE__ */ _jsx(import_api.ActionPanel, null, /* @__PURE__ */ _jsx(
        import_api.Action.CopyToClipboard,
        {
          title: "Copy Results as JSON",
          icon: import_api.Icon.Clipboard,
          content: JSON.stringify(results, null, 2)
        }
      ))
    }
  );
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vcHJvZ3JhbW1pbmcvcmF5Y2FzdEV4dGVuc2lvbnMvcGRmLWxpYnJhcnkvc3JjL3Rlc3QtYWktY29ubmVjdGlvbi50c3giXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIE1pbmltYWwgQUkuYXNrIHNhbml0eSBjaGVjayBcdTIwMTQgcHJvdmVzIHRoZSBSYXljYXN0IEFJIHBpcGUgd29ya3MgaW5kZXBlbmRlbnRseSBvZlxuLy8gdGhlIE9yZ2FuaXplIExvb3NlIEZpbGVzIGNvbW1hbmQuIFJ1biB0aGlzIGZpcnN0IHdoZW4gY2xhc3NpZmljYXRpb24gaGFuZ3Mgb3IgZmFpbHM7XG4vLyBsb2dzIGFwcGVhciBpbiB0aGUgYG5wbSBydW4gZGV2YCB0ZXJtaW5hbC5cblxuaW1wb3J0IHtcbiAgQWN0aW9uLFxuICBBY3Rpb25QYW5lbCxcbiAgQUksXG4gIERldGFpbCxcbiAgSWNvbixcbiAgc2hvd1RvYXN0LFxuICBUb2FzdCxcbn0gZnJvbSBcIkByYXljYXN0L2FwaVwiO1xuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VTdGF0ZSB9IGZyb20gXCJyZWFjdFwiO1xuXG50eXBlIFBoYXNlID0gXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwiZG9uZVwiIHwgXCJlcnJvclwiO1xuXG5pbnRlcmZhY2UgVHJpYWwge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1vZGVsOiBBSS5Nb2RlbDtcbiAgcHJvbXB0OiBzdHJpbmc7XG59XG5cbmNvbnN0IFRSSUFMUzogVHJpYWxbXSA9IFtcbiAge1xuICAgIG5hbWU6IFwiVGlueSAoSGFpa3UgNC41KVwiLFxuICAgIG1vZGVsOiBBSS5Nb2RlbFtcIkFudGhyb3BpY19DbGF1ZGVfNC41X0hhaWt1XCJdLFxuICAgIHByb21wdDogXCJSZXBseSB3aXRoIGV4YWN0bHkgdGhlIHdvcmQgT0sgYW5kIG5vdGhpbmcgZWxzZS5cIixcbiAgfSxcbiAge1xuICAgIG5hbWU6IFwiU21hbGwgYmF0Y2ggSlNPTiAoSGFpa3UgNC41KVwiLFxuICAgIG1vZGVsOiBBSS5Nb2RlbFtcIkFudGhyb3BpY19DbGF1ZGVfNC41X0hhaWt1XCJdLFxuICAgIHByb21wdDogW1xuICAgICAgJ0NsYXNzaWZ5IGVhY2ggZmlsZSBieSB0b3BpYy4gUmVzcG9uZCBPTkxZIHdpdGggYSBKU09OIGFycmF5OiBbe1wiaW5kZXhcIjpOLFwidG9waWNcIjpcIi4uLlwifSwgLi4uXS4nLFxuICAgICAgXCJGaWxlczpcIixcbiAgICAgIFwiMS4gT25fU3BlY2llcy5wZGZcIixcbiAgICAgIFwiMi4gUmllbWFubl9IeXBvdGhlc2lzLnBkZlwiLFxuICAgICAgXCIzLiBDYXBpdGFsLnBkZlwiLFxuICAgIF0uam9pbihcIlxcblwiKSxcbiAgfSxcbiAge1xuICAgIG5hbWU6IFwiVGlueSAoR1BULTRvIG1pbmkpXCIsXG4gICAgbW9kZWw6IEFJLk1vZGVsW1wiT3BlbkFJX0dQVC00b19taW5pXCJdLFxuICAgIHByb21wdDogXCJSZXBseSB3aXRoIGV4YWN0bHkgdGhlIHdvcmQgT0sgYW5kIG5vdGhpbmcgZWxzZS5cIixcbiAgfSxcbl07XG5cbmludGVyZmFjZSBUcmlhbFJlc3VsdCB7XG4gIHBoYXNlOiBQaGFzZTtcbiAgZWxhcHNlZE1zPzogbnVtYmVyO1xuICByZXNwb25zZT86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFRlc3RBaUNvbm5lY3Rpb24oKSB7XG4gIGNvbnN0IFtyZXN1bHRzLCBzZXRSZXN1bHRzXSA9IHVzZVN0YXRlPFJlY29yZDxzdHJpbmcsIFRyaWFsUmVzdWx0Pj4oKCkgPT5cbiAgICBPYmplY3QuZnJvbUVudHJpZXMoVFJJQUxTLm1hcCgodCkgPT4gW3QubmFtZSwgeyBwaGFzZTogXCJpZGxlXCIgYXMgUGhhc2UgfV0pKSxcbiAgKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCB0cmlhbCBvZiBUUklBTFMpIHtcbiAgICAgICAgaWYgKGNvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybjtcbiAgICAgICAgc2V0UmVzdWx0cygocikgPT4gKHsgLi4uciwgW3RyaWFsLm5hbWVdOiB7IHBoYXNlOiBcInJ1bm5pbmdcIiB9IH0pKTtcbiAgICAgICAgY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc29sZS5sb2coYFt0ZXN0LWFpXSAke3RyaWFsLm5hbWV9OiBzdGFydGluZyAobW9kZWw9JHt0cmlhbC5tb2RlbH0pYCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBBSS5hc2sodHJpYWwucHJvbXB0LCB7XG4gICAgICAgICAgICBtb2RlbDogdHJpYWwubW9kZWwsXG4gICAgICAgICAgICBjcmVhdGl2aXR5OiBcImxvd1wiLFxuICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zdCBlbGFwc2VkTXMgPSBEYXRlLm5vdygpIC0gc3RhcnRlZEF0O1xuICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgYFt0ZXN0LWFpXSAke3RyaWFsLm5hbWV9OiBPSyBpbiAke2VsYXBzZWRNc31tcyAoJHtyZXNwb25zZS5sZW5ndGh9IGJ5dGVzKTogJHtyZXNwb25zZS5zbGljZSgwLCA4MCkucmVwbGFjZSgvXFxuL2csIFwiIFwiKX1gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgc2V0UmVzdWx0cygocikgPT4gKHtcbiAgICAgICAgICAgIC4uLnIsXG4gICAgICAgICAgICBbdHJpYWwubmFtZV06IHsgcGhhc2U6IFwiZG9uZVwiLCBlbGFwc2VkTXMsIHJlc3BvbnNlIH0sXG4gICAgICAgICAgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zdCBlbGFwc2VkTXMgPSBEYXRlLm5vdygpIC0gc3RhcnRlZEF0O1xuICAgICAgICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIGBbdGVzdC1haV0gJHt0cmlhbC5uYW1lfTogRkFJTCBpbiAke2VsYXBzZWRNc31tczogJHttc2d9YCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHNldFJlc3VsdHMoKHIpID0+ICh7XG4gICAgICAgICAgICAuLi5yLFxuICAgICAgICAgICAgW3RyaWFsLm5hbWVdOiB7IHBoYXNlOiBcImVycm9yXCIsIGVsYXBzZWRNcywgZXJyb3I6IG1zZyB9LFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgIHNob3dUb2FzdCh7IHN0eWxlOiBUb2FzdC5TdHlsZS5TdWNjZXNzLCB0aXRsZTogXCJUZXN0IGNvbXBsZXRlXCIgfSk7XG4gICAgfSkoKTtcbiAgICByZXR1cm4gKCkgPT4gY29udHJvbGxlci5hYm9ydCgpO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgbWFya2Rvd24gPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXCIjIFJheWNhc3QgQUkgQ29ubmVjdGlvbiBUZXN0XCIsIFwiXCJdO1xuICAgIGZvciAoY29uc3QgdHJpYWwgb2YgVFJJQUxTKSB7XG4gICAgICBjb25zdCByID0gcmVzdWx0c1t0cmlhbC5uYW1lXTtcbiAgICAgIGxpbmVzLnB1c2goYCMjICR7dHJpYWwubmFtZX1gKTtcbiAgICAgIGxpbmVzLnB1c2goYC0gKipNb2RlbDoqKiBcXGAke3RyaWFsLm1vZGVsfVxcYGApO1xuICAgICAgaWYgKHIucGhhc2UgPT09IFwiaWRsZVwiKSBsaW5lcy5wdXNoKFwiLSBfUXVldWVkXHUyMDI2X1wiKTtcbiAgICAgIGVsc2UgaWYgKHIucGhhc2UgPT09IFwicnVubmluZ1wiKSBsaW5lcy5wdXNoKFwiLSBcdTIzRjMgX1J1bm5pbmdcdTIwMjZfXCIpO1xuICAgICAgZWxzZSBpZiAoci5waGFzZSA9PT0gXCJkb25lXCIpIHtcbiAgICAgICAgbGluZXMucHVzaChgLSBcdTI3MDUgKipTdWNjZWVkZWQqKiBpbiAke3IuZWxhcHNlZE1zfW1zYCk7XG4gICAgICAgIGxpbmVzLnB1c2goXCItICoqUmVzcG9uc2UgKGZpcnN0IDIwMCBjaGFycyk6KipcIik7XG4gICAgICAgIGxpbmVzLnB1c2goXCJcIik7XG4gICAgICAgIGxpbmVzLnB1c2goXCJgYGBcIik7XG4gICAgICAgIGxpbmVzLnB1c2goKHIucmVzcG9uc2UgPz8gXCJcIikuc2xpY2UoMCwgMjAwKSk7XG4gICAgICAgIGxpbmVzLnB1c2goXCJgYGBcIik7XG4gICAgICB9IGVsc2UgaWYgKHIucGhhc2UgPT09IFwiZXJyb3JcIikge1xuICAgICAgICBsaW5lcy5wdXNoKGAtIFx1Mjc0QyAqKkZhaWxlZCoqIGluICR7ci5lbGFwc2VkTXN9bXNgKTtcbiAgICAgICAgbGluZXMucHVzaChcIi0gKipFcnJvcjoqKlwiKTtcbiAgICAgICAgbGluZXMucHVzaChcIlwiKTtcbiAgICAgICAgbGluZXMucHVzaChcImBgYFwiKTtcbiAgICAgICAgbGluZXMucHVzaChyLmVycm9yID8/IFwiKG5vIGVycm9yIG1lc3NhZ2UpXCIpO1xuICAgICAgICBsaW5lcy5wdXNoKFwiYGBgXCIpO1xuICAgICAgfVxuICAgICAgbGluZXMucHVzaChcIlwiKTtcbiAgICB9XG4gICAgbGluZXMucHVzaChcIi0tLVwiKTtcbiAgICBsaW5lcy5wdXNoKFwiXCIpO1xuICAgIGxpbmVzLnB1c2goXG4gICAgICBcIkZ1bGwgbG9ncyBhcmUgaW4gdGhlIHRlcm1pbmFsIHJ1bm5pbmcgYG5wbSBydW4gZGV2YCAobG9vayBmb3IgYFt0ZXN0LWFpXWAgbGluZXMpLlwiLFxuICAgICk7XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG4gIH0sIFtyZXN1bHRzXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8RGV0YWlsXG4gICAgICBpc0xvYWRpbmc9e2lzTG9hZGluZ31cbiAgICAgIG1hcmtkb3duPXttYXJrZG93bn1cbiAgICAgIG5hdmlnYXRpb25UaXRsZT1cIlRlc3QgQUkgQ29ubmVjdGlvblwiXG4gICAgICBhY3Rpb25zPXtcbiAgICAgICAgPEFjdGlvblBhbmVsPlxuICAgICAgICAgIDxBY3Rpb24uQ29weVRvQ2xpcGJvYXJkXG4gICAgICAgICAgICB0aXRsZT1cIkNvcHkgUmVzdWx0cyBhcyBKU09OXCJcbiAgICAgICAgICAgIGljb249e0ljb24uQ2xpcGJvYXJkfVxuICAgICAgICAgICAgY29udGVudD17SlNPTi5zdHJpbmdpZnkocmVzdWx0cywgbnVsbCwgMil9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9BY3Rpb25QYW5lbD5cbiAgICAgIH1cbiAgICAvPlxuICApO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFJQSxpQkFRTztBQUNQLG1CQUE2QztBQVU3QyxJQUFNLFNBQWtCO0FBQUEsRUFDdEI7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLE9BQU8sY0FBRyxNQUFNLDRCQUE0QjtBQUFBLElBQzVDLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sT0FBTyxjQUFHLE1BQU0sNEJBQTRCO0FBQUEsSUFDNUMsUUFBUTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRixFQUFFLEtBQUssSUFBSTtBQUFBLEVBQ2I7QUFBQSxFQUNBO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixPQUFPLGNBQUcsTUFBTSxvQkFBb0I7QUFBQSxJQUNwQyxRQUFRO0FBQUEsRUFDVjtBQUNGO0FBU2UsU0FBUixtQkFBb0M7QUFDekMsUUFBTSxDQUFDLFNBQVMsVUFBVSxRQUFJO0FBQUEsSUFBc0MsTUFDbEUsT0FBTyxZQUFZLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLE9BQWdCLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDNUU7QUFDQSxRQUFNLENBQUMsV0FBVyxZQUFZLFFBQUksdUJBQVMsSUFBSTtBQUUvQyw4QkFBVSxNQUFNO0FBQ2QsVUFBTSxhQUFhLElBQUksZ0JBQWdCO0FBQ3ZDLEtBQUMsWUFBWTtBQUNYLGlCQUFXLFNBQVMsUUFBUTtBQUMxQixZQUFJLFdBQVcsT0FBTyxRQUFTO0FBQy9CLG1CQUFXLENBQUMsT0FBTyxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sSUFBSSxHQUFHLEVBQUUsT0FBTyxVQUFVLEVBQUUsRUFBRTtBQUNoRSxjQUFNLFlBQVksS0FBSyxJQUFJO0FBQzNCLGdCQUFRLElBQUksYUFBYSxNQUFNLElBQUkscUJBQXFCLE1BQU0sS0FBSyxHQUFHO0FBQ3RFLFlBQUk7QUFDRixnQkFBTSxXQUFXLE1BQU0sY0FBRyxJQUFJLE1BQU0sUUFBUTtBQUFBLFlBQzFDLE9BQU8sTUFBTTtBQUFBLFlBQ2IsWUFBWTtBQUFBLFlBQ1osUUFBUSxXQUFXO0FBQUEsVUFDckIsQ0FBQztBQUNELGdCQUFNLFlBQVksS0FBSyxJQUFJLElBQUk7QUFDL0Isa0JBQVE7QUFBQSxZQUNOLGFBQWEsTUFBTSxJQUFJLFdBQVcsU0FBUyxPQUFPLFNBQVMsTUFBTSxZQUFZLFNBQVMsTUFBTSxHQUFHLEVBQUUsRUFBRSxRQUFRLE9BQU8sR0FBRyxDQUFDO0FBQUEsVUFDeEg7QUFDQSxxQkFBVyxDQUFDLE9BQU87QUFBQSxZQUNqQixHQUFHO0FBQUEsWUFDSCxDQUFDLE1BQU0sSUFBSSxHQUFHLEVBQUUsT0FBTyxRQUFRLFdBQVcsU0FBUztBQUFBLFVBQ3JELEVBQUU7QUFBQSxRQUNKLFNBQVMsS0FBSztBQUNaLGdCQUFNLFlBQVksS0FBSyxJQUFJLElBQUk7QUFDL0IsZ0JBQU0sTUFBTSxlQUFlLFFBQVEsSUFBSSxVQUFVLE9BQU8sR0FBRztBQUMzRCxrQkFBUTtBQUFBLFlBQ04sYUFBYSxNQUFNLElBQUksYUFBYSxTQUFTLE9BQU8sR0FBRztBQUFBLFVBQ3pEO0FBQ0EscUJBQVcsQ0FBQyxPQUFPO0FBQUEsWUFDakIsR0FBRztBQUFBLFlBQ0gsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFLE9BQU8sU0FBUyxXQUFXLE9BQU8sSUFBSTtBQUFBLFVBQ3hELEVBQUU7QUFBQSxRQUNKO0FBQUEsTUFDRjtBQUNBLG1CQUFhLEtBQUs7QUFDbEIsZ0NBQVUsRUFBRSxPQUFPLGlCQUFNLE1BQU0sU0FBUyxPQUFPLGdCQUFnQixDQUFDO0FBQUEsSUFDbEUsR0FBRztBQUNILFdBQU8sTUFBTSxXQUFXLE1BQU07QUFBQSxFQUNoQyxHQUFHLENBQUMsQ0FBQztBQUVMLFFBQU0sZUFBVyxzQkFBUSxNQUFNO0FBQzdCLFVBQU0sUUFBa0IsQ0FBQyxnQ0FBZ0MsRUFBRTtBQUMzRCxlQUFXLFNBQVMsUUFBUTtBQUMxQixZQUFNLElBQUksUUFBUSxNQUFNLElBQUk7QUFDNUIsWUFBTSxLQUFLLE1BQU0sTUFBTSxJQUFJLEVBQUU7QUFDN0IsWUFBTSxLQUFLLGtCQUFrQixNQUFNLEtBQUssSUFBSTtBQUM1QyxVQUFJLEVBQUUsVUFBVSxPQUFRLE9BQU0sS0FBSyxrQkFBYTtBQUFBLGVBQ3ZDLEVBQUUsVUFBVSxVQUFXLE9BQU0sS0FBSywwQkFBZ0I7QUFBQSxlQUNsRCxFQUFFLFVBQVUsUUFBUTtBQUMzQixjQUFNLEtBQUssNkJBQXdCLEVBQUUsU0FBUyxJQUFJO0FBQ2xELGNBQU0sS0FBSyxtQ0FBbUM7QUFDOUMsY0FBTSxLQUFLLEVBQUU7QUFDYixjQUFNLEtBQUssS0FBSztBQUNoQixjQUFNLE1BQU0sRUFBRSxZQUFZLElBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUMzQyxjQUFNLEtBQUssS0FBSztBQUFBLE1BQ2xCLFdBQVcsRUFBRSxVQUFVLFNBQVM7QUFDOUIsY0FBTSxLQUFLLDBCQUFxQixFQUFFLFNBQVMsSUFBSTtBQUMvQyxjQUFNLEtBQUssY0FBYztBQUN6QixjQUFNLEtBQUssRUFBRTtBQUNiLGNBQU0sS0FBSyxLQUFLO0FBQ2hCLGNBQU0sS0FBSyxFQUFFLFNBQVMsb0JBQW9CO0FBQzFDLGNBQU0sS0FBSyxLQUFLO0FBQUEsTUFDbEI7QUFDQSxZQUFNLEtBQUssRUFBRTtBQUFBLElBQ2Y7QUFDQSxVQUFNLEtBQUssS0FBSztBQUNoQixVQUFNLEtBQUssRUFBRTtBQUNiLFVBQU07QUFBQSxNQUNKO0FBQUEsSUFDRjtBQUNBLFdBQU8sTUFBTSxLQUFLLElBQUk7QUFBQSxFQUN4QixHQUFHLENBQUMsT0FBTyxDQUFDO0FBRVosU0FDRTtBQUFBLElBQUM7QUFBQTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsTUFDQSxpQkFBZ0I7QUFBQSxNQUNoQixTQUNFLHFCQUFDLDhCQUNDO0FBQUEsUUFBQyxrQkFBTztBQUFBLFFBQVA7QUFBQSxVQUNDLE9BQU07QUFBQSxVQUNOLE1BQU0sZ0JBQUs7QUFBQSxVQUNYLFNBQVMsS0FBSyxVQUFVLFNBQVMsTUFBTSxDQUFDO0FBQUE7QUFBQSxNQUMxQyxDQUNGO0FBQUE7QUFBQSxFQUVKO0FBRUo7IiwKICAibmFtZXMiOiBbXQp9Cg==
