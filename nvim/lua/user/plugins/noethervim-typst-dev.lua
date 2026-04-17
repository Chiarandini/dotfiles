-- Redirect the NoetherVim-Typst companion plugin to the local dev copy.
-- lazy.nvim merges this spec with the one from the typst bundle; `dir`
-- takes precedence over the repo URL so no GitHub clone is attempted.
-- Delete this file once Chiarandini/NoetherVim-Typst is published.

return {
  {
    "Chiarandini/NoetherVim-Typst",
    dir = vim.fn.expand("~/programming/custom_plugins/noethervim-typst"),
  },
}
