return {
  "alex-popov-tech/store.nvim",
  dependencies = {
    -- Don't add OXY2DEV/markview.nvim here -- it auto-attaches to every
    -- markdown buffer (preview.filetypes defaults include "markdown") and
    -- collides with render-markdown.nvim from the noethervim markdown bundle,
    -- producing doubled bullets ("1.1.") and eaten heading prefixes.
    -- Store sets filetype=markdown on its preview pane, so render-markdown
    -- picks up the README rendering on its own.
    -- Optional: inline image rendering in README previews (Kitty, Ghostty, WezTerm only)
    { "3rd/image.nvim", lazy = true, opts = { integrations = { markdown = { enabled = false } } } },
  },
  opts = {
    layout = "tab", -- recommended when using image preview
  },
  cmd = "Store",
  keys = {
    {
      "<space>P",
      "<cmd>Store<cr>",
      desc = "neovim plugin store",
    },
  },
}
