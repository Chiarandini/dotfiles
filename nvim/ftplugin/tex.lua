-- User Zero personal LaTeX ftplugin
-- These keymaps are personal and not part of the NoetherVim distribution.

vim.o.textwidth = 100

local opts = function(desc) return { silent = true, buffer = true, desc = desc } end

-- Edit the sibling .bib file
vim.keymap.set("n", "<leader>eb", ":vs ../*.bib<cr>", opts("edit bibliography"))

-- Inkscape figure creation (castel.dev workflow)
vim.keymap.set("i", "<c-s-f>", function()
  vim.cmd([[silent exec '.!inkscape-figures create "'.getline('.').'" "' . './figures/"']])
  vim.cmd("w")
end, opts("create inkscape figure"))

vim.keymap.set(
  'n',
  '<space>eb',
  '<cmd>vs $TEXTBOOKS/.eyntka/shared.bib<cr>',
  opts('edit shard bib')
)

vim.keymap.set("n", "<c-s-f>", function()
  vim.cmd([[silent exec '!inkscape-figures edit "' . './figures/" > /dev/null 2>&1 &']])
  vim.cmd("redraw!")
end, opts("edit inkscape figure"))

-- Abolish substitutions (personal shorthand)
-- Deferred so vim-abolish has finished loading on the session's first tex buffer.
local bufnr = vim.api.nvim_get_current_buf()
vim.schedule(function()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  if vim.fn.exists(":Abolish") ~= 2 then return end
  vim.api.nvim_buf_call(bufnr, function()
    vim.cmd("Abolish -buffer bc because")
  end)
end)

-- zg: route a new word to the right dictionary, and offer to seed the plugin.
--
-- Maintainer-only workflow, which is why it lives here and not in
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
local NTEX_SRC = vim.fn.expand("~/programming/nvim-plugins/noethervim-tex/spell")
local personal_spell = vim.fn.stdpath("config") .. "/spell"

-- Mirror the plugin's split locally. Appended after the default en file, so a
-- plain :spellgood elsewhere still lands where it always has.
local personal_accents = personal_spell .. "/accents.utf-8.add"
if vim.fn.filereadable(personal_accents) == 0 then
  vim.fn.mkdir(personal_spell, "p")
  vim.fn.writefile({}, personal_accents)
end
if not vim.tbl_contains(vim.split(vim.bo.spellfile, ","), personal_accents) then
  vim.opt_local.spellfile:append(personal_accents)
end

--- Append `word` to a specific .add, letting vim recompile its .spl.
local function spellgood_into(dir, file, word)
  local path = dir .. "/" .. file
  if vim.fn.isdirectory(dir) == 0 then return false end
  local saved = vim.bo.spellfile
  vim.bo.spellfile = path
  local ok = pcall(vim.cmd, "silent spellgood " .. word)
  vim.bo.spellfile = saved
  return ok
end

local function add_word()
  -- The plugin knows how to read K\"ahler off the buffer and decode it.
  local accent = require("noethervim-tex.accent_spell")
  local tok = accent.token_under_cursor()
  local word = tok and tok.decoded or vim.fn.expand("<cword>")
  if word == "" then return end

  local file = word:match("[\128-\255]") and "accents.utf-8.add" or "en.utf-8.add"

  local choices = { "this config only" }
  if vim.fn.isdirectory(NTEX_SRC) == 1 then
    table.insert(choices, "this config + noethervim-tex source")
  end

  local function commit(also_plugin)
    spellgood_into(personal_spell, file, word)
    if also_plugin then spellgood_into(NTEX_SRC, file, word) end
    pcall(accent.refresh)
    vim.notify(("%q -> %s%s"):format(word, file, also_plugin and " (config + plugin)" or ""),
      vim.log.levels.INFO)
  end

  if #choices == 1 then return commit(false) end
  vim.ui.select(choices, { prompt = ("Add %q to:"):format(word) }, function(_, idx)
    if idx then commit(idx == 2) end
  end)
end

vim.schedule(function()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  vim.keymap.set("n", "zg", add_word,
    { silent = true, buffer = bufnr, desc = "spell: add (choose dictionary)" })
end)

-- Route :PDF through VimTeX's viewer instead of a raw `open`.
--
-- NoetherVim's latex bundle defines a buffer-local :PDF that shells out to
-- `open <basename>.pdf`, which never touches VimTeX -- so it doesn't establish
-- the forward/inverse SyncTeX link, and its `%:t:r` basename is wrong for
-- \subfile buffers or a non-empty out_dir. Going through :VimtexView instead
-- lets VimTeX resolve the correct output PDF and wire the same sync link that
-- <localleader>lv uses.
--
-- We then ALSO raise the viewer with a plain OS `open`, to restore the
-- foreground-focus the old `open`-based :PDF gave. :VimtexView only raises Skim
-- via g:vimtex_view_skim_activate -> a background `osascript app.activate()`,
-- which macOS honours far less reliably than LaunchServices `open` (worse
-- across Spaces). `open` on an already-open PDF just fronts it -- no reload.
--
-- The distro creates its :PDF in a FileType autocmd registered *after* this
-- ftplugin, so we defer with vim.schedule() to guarantee our version is the one
-- that survives.
vim.schedule(function()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  vim.api.nvim_buf_create_user_command(bufnr, "PDF", function()
    -- Resolve the output PDF. Prefer VimTeX's path (main-file / out_dir aware);
    -- fall back to the current file's basename when VimTeX isn't attached.
    local pdf
    if vim.fn.exists("b:vimtex") == 1 and vim.fn.exists(":VimtexView") == 2 then
      vim.cmd("VimtexView")                          -- sync + establish the link
      local ok, out = pcall(vim.fn.eval, "b:vimtex.viewer.out()")
      if ok and out ~= "" then pdf = out end
    end
    pdf = pdf or (vim.fn.expand("%:t:r") .. ".pdf")

    -- Not compiled yet -> nothing to focus (VimtexView, if it ran, already
    -- warned). Avoids macOS's "file does not exist" popup on a raw `open`.
    if vim.fn.filereadable(pdf) == 0 then return end

    if vim.fn.has("macunix") == 1 then
      vim.fn.jobstart({ "open", pdf }, { detach = true })
    elseif vim.fn.has("win32") == 1 then
      vim.fn.jobstart({ "cmd.exe", "/c", "start", "", pdf }, { detach = true })
    else
      vim.fn.jobstart({ "xdg-open", pdf }, { detach = true })
    end
  end, { desc = "open compiled PDF (via VimTeX viewer, focused)" })
end)
