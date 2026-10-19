-- zg: route a new word to the right dictionary, and offer to seed the plugin.
--
-- Maintainer-only workflow, which is why it lives in this config and not in
-- noethervim-tex: contributors add vocabulary by PR, and a plugin has no
-- business writing into its own source tree.
--
-- Three axes:
--   which file  accented words (decoded to Unicode) go to accents.utf-8.add,
--               everything else to en.utf-8.add, matching how the plugin
--               splits its own two dictionaries.
--   which tree  always this config, so the word works in this buffer straight
--               away, and optionally also the noethervim-tex *source* checkout
--               so it accumulates for a later commit.  Writing to the plugin
--               as loaded would be pointless: production runs the lazy clone,
--               which :Lazy update overwrites.
--   how wide    a word can instead be confined to the document it belongs to,
--               or to its folder.  A character name, a co-author's surname
--               or a one-paper coinage is noise in the global dictionary: it
--               stops being flagged everywhere, including where it *is* a
--               typo.  See `attach` for how vim is told to read them.
--
-- Bound across every writing filetype, not just tex.  Math vocabulary turns up
-- in notes at least as often as in a .tex file, and a chooser that only fires
-- in tex means the plugin dictionary silently misses everything written
-- elsewhere.

local M = {}

-- Spelled as the repo is, which is also how lazy resolves the dev checkout.
local NTEX_SRC = vim.fn.expand("~/programming/nvim-plugins/NoetherVim-tex/spell")
local PERSONAL = vim.fn.stdpath("config") .. "/spell"

local FILES = { "en.utf-8.add", "accents.utf-8.add" }

-- The folder dictionary needs a fixed name, and a visible one would collide:
-- <dirname>.utf-8.add is exactly what the per-file rule produces for the
-- thesis.tex sitting in thesis/.  A dotfile cannot clash with a document and
-- stays out of Obsidian's file explorer.
local DIR_DICT = ".spell.utf-8.add"

--- The forms one `zg` writes.  The rule belongs to the distro; ask it for it.
--- The inline fallback is the same rule, so plain `nvim` -- pinned to the
--- released NoetherVim clone -- keeps working until util.spell.variants ships.
local function variants(word)
  local ok, spell = pcall(require, "noethervim.util.spell")
  if ok and spell.variants then return spell.variants(word) end
  return { word, word .. "'s" }
end

--- Where this buffer's own two dictionaries live, or nil when the buffer is
--- not a document that can have any.
---
--- A commit message, a mail draft and a scratch buffer are all `writing`
--- filetypes, so they reach this code, but "this file" means nothing for a
--- buffer that is thrown away on write -- and COMMIT_EDITMSG would accumulate
--- one shared dictionary for every repository on the machine.
---@return { file: string, dir: string }|nil
local function document_paths(buf)
  buf = buf or 0
  if vim.bo[buf].buftype ~= "" then return nil end

  local ft = vim.bo[buf].filetype
  if ft == "gitcommit" or ft == "gitsendemail" or ft == "mail" then return nil end

  local name = vim.api.nvim_buf_get_name(buf)
  -- oil://, fugitive:// and friends name a buffer, not a place to write.
  if name == "" or name:match("^%a[%w+.-]*://") then return nil end

  local path = vim.fn.fnamemodify(name, ":p")
  local dir  = vim.fn.fnamemodify(path, ":h")
  if vim.fn.isdirectory(dir) == 0 then return nil end

  -- chapter1.tex -> chapter1.utf-8.add.  Deliberately keyed on the stem, not
  -- the full name, so a document and its notes.md alongside share one list.
  return {
    file = dir .. "/" .. vim.fn.fnamemodify(path, ":t:r") .. ".utf-8.add",
    dir  = dir .. "/" .. DIR_DICT,
  }
end

--- Put this buffer's document dictionaries on its 'spellfile'.
---
--- 'spellfile' is buffer-local and nothing persists it, so this has to run
--- again on every open: a word added yesterday is flagged again this morning
--- unless the file is re-listed.  Listing a path is all it takes -- vim reads
--- the compiled .spl of every entry, with no 'spelllang' entry needed -- and
--- naming one that does not exist yet is not an error, so both go on
--- unconditionally rather than only once the user has added something.
---
--- Appended, never prepended: a bare `zg` writes to the *first* entry, which
--- has to stay the personal dictionary.
local function attach(buf)
  buf = buf or 0
  local paths = document_paths(buf)
  if not paths then return end

  local entries = vim.split(vim.bo[buf].spellfile, ",", { trimempty = true })
  local seen = {}
  for _, e in ipairs(entries) do seen[e] = true end

  for _, p in ipairs({ paths.dir, paths.file }) do
    if not seen[p] then entries[#entries + 1] = p end
  end
  vim.bo[buf].spellfile = table.concat(entries, ",")
end

--- Which of `forms` `path` does not already list.
---
--- Membership is tested against the file's own lines rather than
--- spellbadword(), which answers for the loaded dictionaries as a whole: once
--- the personal file has the word, the plugin tree looks satisfied and would
--- never get it.
---@return string[] missing
local function missing_at(path, forms)
  local have = {}
  if vim.fn.filereadable(path) == 1 then
    for _, line in ipairs(vim.fn.readfile(path)) do have[line] = true end
  end
  return vim.tbl_filter(function(f) return not have[f] end, forms)
end

--- As `missing_at`, for a tree that may not be checked out at all.
local function missing_in(dir, file, forms)
  if vim.fn.isdirectory(dir) == 0 then return {} end
  return missing_at(dir .. "/" .. file, forms)
end

--- Append `forms` to `path`, letting vim recompile its .spl.
local function write_path(path, forms)
  if #forms == 0 then return end
  -- :spellgood will not create a missing parent -- it fails with E484 and
  -- writes nothing.  Only reachable for the folder dictionary of a directory
  -- that vanished under us, but the failure is silent, so guard it.
  vim.fn.mkdir(vim.fn.fnamemodify(path, ":h"), "p")

  local saved = vim.bo.spellfile
  vim.bo.spellfile = path
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

--- Every place the word could go, with the forms each one still lacks.
---
--- Resolved before prompting so the chooser can offer only destinations that
--- would actually receive something; `missing_in` answers {} for an absent
--- checkout, which folds in here as well.
local function destinations(file, forms)
  local d = {
    { key = "config", prompt = "this config", short = "config",
      path = PERSONAL .. "/" .. file, missing = missing_in(PERSONAL, file, forms) },
    { key = "plugin", prompt = "noethervim-tex source", short = "plugin",
      path = NTEX_SRC .. "/" .. file, missing = missing_in(NTEX_SRC, file, forms) },
  }

  local paths = document_paths(0)
  if paths then
    d[#d + 1] = {
      key = "file", short = vim.fn.fnamemodify(paths.file, ":t"),
      prompt = ("this file only (%s)"):format(vim.fn.fnamemodify(paths.file, ":t")),
      path = paths.file, missing = missing_at(paths.file, forms),
    }
    d[#d + 1] = {
      key = "folder", short = vim.fn.fnamemodify(paths.dir, ":h:t") .. "/",
      prompt = ("this folder only (%s/)"):format(vim.fn.fnamemodify(paths.dir, ":h:t")),
      path = paths.dir, missing = missing_at(paths.dir, forms),
    }
  end

  local by_key = {}
  for _, dest in ipairs(d) do by_key[dest.key] = dest end
  return by_key
end

--- Say which forms were written and where.  The possessive is invisible
--- otherwise, and a silent zg reads as a no-op.
local function report(word, file, chosen)
  local forms, seen, where = {}, {}, {}
  for _, dest in ipairs(chosen) do
    where[#where + 1] = dest.short
    for _, f in ipairs(dest.missing) do
      if not seen[f] then
        seen[f] = true
        forms[#forms + 1] = f
      end
    end
  end

  if #forms == 0 then
    return vim.notify(("%s: already in %s"):format(word, file),
      vim.log.levels.INFO, { title = "spell" })
  end
  vim.notify(("%s -> %s"):format(
    table.concat(forms, "  "), table.concat(where, " + ")),
    vim.log.levels.INFO, { title = "spell" })
end

function M.add_under_cursor()
  local word, accent = word_under_cursor()
  if word == "" then return end

  local file  = word:match("[\128-\255]") and "accents.utf-8.add" or "en.utf-8.add"
  local forms = variants(word)
  local by_key = destinations(file, forms)

  -- The document dictionaries have to be listed before anything is written to
  -- them, or the restore at the end of `write_path` drops the file straight
  -- back out and the word stays flagged until the buffer is reopened.
  attach(0)

  local function commit(chosen)
    for _, dest in ipairs(chosen) do write_path(dest.path, dest.missing) end
    if accent then pcall(accent.refresh) end
    report(word, file, chosen)
  end

  -- Each choice names the trees it actually writes to.  A word already in this
  -- config but not yet in the plugin is the common case for vocabulary added
  -- before the plugin option existed, and there "this config + noethervim-tex
  -- source" would name a destination that receives nothing.
  local choices = {}
  local function offer(prompt, chosen)
    choices[#choices + 1] = { prompt = prompt, chosen = chosen }
  end

  local config, plugin = by_key.config, by_key.plugin
  if #config.missing > 0 then offer(config.prompt, { config }) end
  if #plugin.missing > 0 then
    if #config.missing > 0 then
      offer("this config + noethervim-tex source", { config, plugin })
    else
      offer(plugin.prompt, { plugin })
    end
  end
  for _, key in ipairs({ "file", "folder" }) do
    local dest = by_key[key]
    if dest and #dest.missing > 0 then offer(dest.prompt, { dest }) end
  end

  if #choices == 0 then
    return report(word, file, {})
  end
  -- Nothing to decide: skip the prompt rather than show a one-item list.
  if #choices == 1 then
    return commit(choices[1].chosen)
  end

  vim.ui.select(choices, {
    prompt = ("Add %q to:"):format(word),
    format_item = function(c) return c.prompt end,
  }, function(c)
    if c then commit(c.chosen) end
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
  -- a global map here would stay shadowed.  vim.schedule defers past both --
  -- and past noethervim-tex's own spellfile registration, so `attach` extends
  -- the full list rather than a half-built one.
  vim.api.nvim_create_autocmd("FileType", {
    group   = vim.api.nvim_create_augroup("user_spell_dict", { clear = true }),
    pattern = vim.tbl_keys(require("noethervim.util.filetypes").writing),
    callback = function(ev)
      vim.schedule(function()
        if not vim.api.nvim_buf_is_valid(ev.buf) then return end
        attach(ev.buf)
        vim.keymap.set("n", "zg", M.add_under_cursor,
          { silent = true, buffer = ev.buf, desc = "spell: add (choose dictionary)" })
      end)
    end,
    desc = "spell: zg chooses which dictionary the word lands in",
  })
end

return M
