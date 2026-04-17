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
