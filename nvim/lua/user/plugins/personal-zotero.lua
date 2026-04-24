-- Only override to the local working tree under `nvdn` (which sets
-- vim.g.noethervim_dev). Plain `nvim` falls through to the bundle's canonical
-- GitHub spec (`Chiarandini/snacks-zotero.nvim`).
if not vim.g.noethervim_dev then
  return {}
end

return {
  -- Active under nvdn: resolved via lazy's dev.path to the local working tree.
  { "snacks-zotero.nvim", dev = true },

  -- Disabled: local telescope-zotero fork. Disabled at the bundle level as
  -- well, but kept here so `dev = true` resolution still works if the bundle
  -- spec is ever flipped back on.
  -- { "telescope-zotero.nvim", dev = true },
}
