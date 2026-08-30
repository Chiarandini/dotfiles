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

-- zg (choose which dictionary a new word lands in) used to live here, tex-only.
-- It now covers every writing filetype: lua/user/configs/spell_dict.lua.

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
