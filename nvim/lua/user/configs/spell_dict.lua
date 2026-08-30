-- zg: route a new word to the right dictionary, and offer to seed the plugin.
--
-- Maintainer-only workflow, which is why it lives in this config and not in
-- noethervim-tex: contributors add vocabulary by PR, and a plugin has no
-- business writing into its own source tree.
--
-- Two axes:
--   which file  accented words (decoded to Unicode) go to accents.utf-8.add,
--               everything else to en.utf-8.add, matching how the plugin
--               splits its own two dictionaries.
--   which tree  always this config, so the word works in this buffer straight
--               away, and optionally also the noethervim-tex *source* checkout
--               so it accumulates for a later commit.  Writing to the plugin
--               as loaded would be pointless: production runs the lazy clone,
--               which :Lazy update overwrites.
--
-- Bound across every writing filetype, not just tex.  Math vocabulary turns up
-- in notes at least as often as in a .tex file, and a chooser that only fires
-- in tex means the plugin dictionary silently misses everything written
-- elsewhere.

local M = {}

local NTEX_SRC = vim.fn.expand("~/programming/nvim-plugins/noethervim-tex/spell")
local PERSONAL = vim.fn.stdpath("config") .. "/spell"

local FILES = { "en.utf-8.add", "accents.utf-8.add" }

--- The forms one `zg` writes.  The rule belongs to the distro; ask it for it.
--- The inline fallback is the same rule, so plain `nvim` -- pinned to the
--- released NoetherVim clone -- keeps working until util.spell.variants ships.
local function variants(word)
  local ok, spell = pcall(require, "noethervim.util.spell")
  if ok and spell.variants then return spell.variants(word) end
  return { word, word .. "'s" }
end

--- Which of `forms` <dir>/<file> does not already list.
---
--- Membership is tested against the file's own lines rather than
--- spellbadword(), which answers for the loaded dictionaries as a whole: once
--- the personal file has the word, the plugin tree looks satisfied and would
--- never get it.
---@return string[] missing
local function missing_in(dir, file, forms)
  if vim.fn.isdirectory(dir) == 0 then return {} end
  local path = dir .. "/" .. file

  local have = {}
  if vim.fn.filereadable(path) == 1 then
    for _, line in ipairs(vim.fn.readfile(path)) do have[line] = true end
  end
  return vim.tbl_filter(function(f) return not have[f] end, forms)
end

--- Append `forms` to <dir>/<file>, letting vim recompile its .spl.
local function write_to(dir, file, forms)
  if #forms == 0 then return end
  local saved = vim.bo.spellfile
  vim.bo.spellfile = dir .. "/" .. file
  for _, form in ipairs(forms) do
    -- Passed as an argument list rather than interpolated into a command
    -- string: the possessive carries an apostrophe, and escaping it by hand is
    -- how it stopped reaching the spellfile upstream.
    pcall(vim.cmd, { cmd = "spellgood", args = { form }, mods = { silent = true } })
  end
  vim.bo.spellfile = saved
end

--- The word to add: the plugin knows how to read K\"ahler off the buffer and
--- decode it, but it is only loaded in a tex buffer, so treat it as optional.
local function word_under_cursor()
  local ok, accent = pcall(require, "noethervim-tex.accent_spell")
  if ok then
    local tok = accent.token_under_cursor()
    if tok then return tok.decoded, accent end
    return vim.fn.expand("<cword>"), accent
  end
  return vim.fn.expand("<cword>"), nil
end

local function report(word, file, forms, wrote, plugin_wrote)
  local trees = {}
  if #wrote > 0 then trees[#trees + 1] = "config" end
  if #plugin_wrote > 0 then trees[#trees + 1] = "plugin" end

  if #trees == 0 then
    return vim.notify(("%s: already in %s"):format(word, file),
      vim.log.levels.INFO, { title = "spell" })
  end

  local seen = {}
  for _, list in ipairs({ wrote, plugin_wrote }) do
    for _, f in ipairs(list) do seen[f] = true end
  end
  local written = vim.tbl_filter(function(f) return seen[f] end, forms)

  vim.notify(("%s -> %s (%s)"):format(
    table.concat(written, "  "), file, table.concat(trees, " + ")),
    vim.log.levels.INFO, { title = "spell" })
end

function M.add_under_cursor()
  local word, accent = word_under_cursor()
  if word == "" then return end

  local file = word:match("[\128-\255]") and "accents.utf-8.add" or "en.utf-8.add"
  local forms = variants(word)

  -- Resolved before prompting. The only decision is whether the plugin source
  -- gets the word too, so there is nothing to ask when it needs nothing;
  -- missing_in answers {} for an absent checkout, which folds in here as well.
  local mine   = missing_in(PERSONAL, file, forms)
  local theirs = missing_in(NTEX_SRC, file, forms)

  local function commit(also_plugin)
    write_to(PERSONAL, file, mine)
    if also_plugin then write_to(NTEX_SRC, file, theirs) end
    if accent then pcall(accent.refresh) end
    report(word, file, forms, mine, also_plugin and theirs or {})
  end

  if #theirs == 0 then
    if #mine > 0 then return commit(false) end
    return vim.notify(("%s: already in %s"):format(word, file),
      vim.log.levels.INFO, { title = "spell" })
  end

  -- Each choice names the trees it actually writes to. A word already in this
  -- config but not yet in the plugin is the common case for vocabulary added
  -- before the plugin option existed, and there "this config + noethervim-tex
  -- source" would name a destination that receives nothing.
  vim.ui.select({
    #mine > 0 and "this config" or "nothing (this config already has it)",
    #mine > 0 and "this config + noethervim-tex source" or "noethervim-tex source",
  }, { prompt = ("Add %q to:"):format(word) }, function(_, idx)
    if idx then commit(idx == 2) end
  end)
end

function M.setup()
  -- Mirror the plugin's two-file split locally, and read both everywhere, so a
  -- word added from any writing buffer is recognised in every writing buffer.
  vim.fn.mkdir(PERSONAL, "p")
  for _, file in ipairs(FILES) do
    local path = PERSONAL .. "/" .. file
    if vim.fn.filereadable(path) == 0 then vim.fn.writefile({}, path) end
    vim.opt.spellfile:append(path)
  end

  -- The distro maps zg buffer-locally from a FileType/BufWinEnter autocmd, so
  -- a global map here would stay shadowed.  vim.schedule defers past both.
  vim.api.nvim_create_autocmd("FileType", {
    group   = vim.api.nvim_create_augroup("user_spell_dict", { clear = true }),
    pattern = vim.tbl_keys(require("noethervim.util.filetypes").writing),
    callback = function(ev)
      vim.schedule(function()
        if not vim.api.nvim_buf_is_valid(ev.buf) then return end
        vim.keymap.set("n", "zg", M.add_under_cursor,
          { silent = true, buffer = ev.buf, desc = "spell: add (choose dictionary)" })
      end)
    end,
    desc = "spell: zg chooses which dictionary the word lands in",
  })
end

return M
