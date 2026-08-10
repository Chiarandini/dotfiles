-- User Zero personal Oil ftplugin
-- macOS-specific: copy current file as a Finder file object to the clipboard.

vim.keymap.set("n", "<C-y>", function()
  local oil   = require("oil")
  local entry = oil.get_cursor_entry()
  local dir   = oil.get_current_dir()
  if not entry or not dir then return end

  local path         = vim.fn.fnamemodify(dir .. entry.name, ":p")
  if entry.type == "directory" then path = path:gsub("/$", "") end
  local path_escaped = path:gsub('"', '\\"')

  local cmd = string.format(
    'osascript -e \'tell application "Finder" to set the clipboard to ( POSIX file "%s" )\'',
    path_escaped
  )
  local result = vim.fn.system(cmd)
  if vim.v.shell_error == 0 then
    print("Copied file object: " .. entry.name)
  else
    print("Error: " .. result)
  end
end, { buffer = true, desc = "Copy file to macOS Finder clipboard" })

-- ── Run a shell command in this dir, then quit Neovim ─────────────────────
-- Neovim can't inject a command into its parent shell, so we hand off through
-- a file: write "<dir>\n<command>" to $NVIM_RUN_ON_EXIT, then quit. The zsh
-- `nvim` wrapper (~/.config/zsh/functions.zsh) reads it after Neovim exits,
-- cd's into <dir>, and runs <command> in the real terminal — no :terminal.
--
-- Bound to `gR`, not `gr`: `gr` is a prefix of a dozen maps (built-in LSP
-- grn/gra/grr/gri/grt/grx + the distro's grR/grA/grE/… smart-action group),
-- so a bare `gr` would stall for `timeoutlen` on every press. `gR` has no
-- longer maps and only shadows built-in virtual-replace (moot in Oil).
vim.keymap.set("n", "gR", function()
  local handoff = vim.env.NVIM_RUN_ON_EXIT
  if not handoff or handoff == "" then
    vim.notify(
      "run-on-exit: launch nvim via the zsh wrapper to use this.",
      vim.log.levels.WARN
    )
    return
  end

  local dir = require("oil").get_current_dir()
  if not dir then
    vim.notify("run-on-exit: not in an Oil directory", vim.log.levels.WARN)
    return
  end

  vim.ui.input({
    prompt = "Run in " .. vim.fn.fnamemodify(dir, ":~") .. " (on quit): ",
  }, function(cmd)
    if not cmd or cmd == "" then return end
    -- line 1 = dir, line 2+ = command
    vim.fn.writefile({ dir, cmd }, handoff)
    -- Quit everything. If a buffer is unsaved, qall throws — clear the handoff
    -- so the shell doesn't run a stale command, and warn.
    if not pcall(vim.cmd, "qall") then
      vim.fn.writefile({}, handoff)
      vim.notify(
        "run-on-exit: unsaved changes — save/close buffers first.",
        vim.log.levels.WARN
      )
    end
  end)
end, { buffer = true, desc = "Run shell cmd in this dir after quitting nvim (gR)" })
