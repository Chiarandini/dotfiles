-- NoetherVim local-testing wrapper.
--
-- Invoked via `nvdn` (alias: NVIM_APPNAME=noethervim nvim).
-- Delegates to the production config at ~/.config/nvim/init.lua after
-- flipping `vim.g.noethervim_dev` so the NoetherVim distro is loaded from
-- the local working tree instead of the GitHub clone.
--
-- Directory layout:
--   lua/, ftplugin/, spell/, preamble/, LuaSnip/   -> symlinks to ~/.config/nvim/
--   lazy-lock.json                                  -> stays local (separate pins)
--   ~/.local/share/noethervim/                      -> separate plugin installs
--
-- Everything else (options, keymaps, bundles, user plugins) is the same as
-- production, so testing mirrors the real config exactly.

-- vim.g.noethervim_dashboard = false
vim.g.noethervim_dev = vim.fn.expand("~/programming/NoetherVim")
dofile(vim.fn.expand("~/.config/nvim/init.lua"))
