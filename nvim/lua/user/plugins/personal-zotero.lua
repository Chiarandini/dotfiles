-- Personal snacks-zotero tuning.
--
-- EYNTKA textbook series: every book compiles against ONE shared, Zotero-backed
-- bibliography, `<repo>/.eyntka/series.bib` (see the series' EYNTKA-Series-Rules.md
-- "Citations"). So when editing a .tex file inside an EYNTKA repo, <space>fz must
-- insert the \cite key and append the entry to that single series bib — NOT to a
-- per-document `references.bib`. This is an EYNTKA-specific policy, so it lives in
-- the personal layer, not the shared NoetherVim bundle. Everywhere else, fall back
-- to the plugin's default per-document locator.
--
-- Applies to both `nvim` and `nvdn`; the dev block at the bottom only swaps the
-- plugin *source* (local working tree vs the canonical GitHub spec).

-- Nearest EYNTKA repo root for the current buffer: walk up for a `.eyntka/` dir.
-- Returns `<root>/.eyntka/series.bib`, or nil when not inside an EYNTKA repo.
local function eyntka_series_bib()
  local buf = vim.api.nvim_buf_get_name(0)
  local start = (buf ~= "" and vim.fn.fnamemodify(buf, ":p:h")) or vim.fn.getcwd()
  local eyntka = vim.fs.find(".eyntka", { path = start, upward = true, type = "directory" })[1]
  return eyntka and (eyntka .. "/series.bib") or nil
end

-- In an EYNTKA repo → the shared series bib; else the plugin's default locator.
local function locate_tex_bib()
  return eyntka_series_bib() or require("snacks_zotero.bib").locate_tex_bib()
end

local specs = {
  -- Merge extra opts into the bundle's spec (same plugin, matched by name).
  {
    "Chiarandini/snacks-zotero.nvim",
    opts = {
      -- Zotero export scope. sync-bib.sh defaults to the whole "My Library" too,
      -- so the picker and the bulk sync stay in step. Once a dedicated EYNTKA
      -- Zotero collection exists, pin both to it:
      --   collection = "EYNTKA",
      ft = {
        tex = { locate_bib = locate_tex_bib },
        plaintex = { locate_bib = locate_tex_bib },
        latex = { locate_bib = locate_tex_bib },
      },
    },
  },
}

-- Dev override: under `nvdn` (vim.g.noethervim_dev), resolve the plugin from the
-- local working tree via lazy's dev.path instead of GitHub. Only swaps the
-- source; the opts above still apply in both modes.
if vim.g.noethervim_dev then
  table.insert(specs, { "snacks-zotero.nvim", dev = true })
end

-- Disabled: local telescope-zotero fork. Kept here so `dev = true` resolution
-- still works if the bundle spec is ever flipped back on.
-- table.insert(specs, { "telescope-zotero.nvim", dev = true })

return specs
