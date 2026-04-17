
return {
  {
    "nvim-telescope/telescope.nvim",
    keys = {
      -- bibtex citation from insert mode (requires telescope-bibtex.nvim)
      { "<c-s-c>", "<cmd>Telescope bibtex theme=cursor<cr>",              mode = "i", desc = "citation from bibtex" },
      -- clipboard history from insert mode (requires neoclip)
      { "<c-s-v>", "<cmd>Telescope neoclip theme=cursor<cr>",             mode = "i", desc = "clipboard history" },
      -- harpoon UI via telescope extension (alias to <c-w><c-h>)
      { "<space>h", "<cmd>Telescope harpoon marks<cr>",                               desc = "harpoon marks" },
      -- homework finder: uses fd with multi-pattern regex
      {
        "<space>fdh",
        function()
          require("telescope.builtin").find_files({
            cwd = vim.fn.expand("~/Documents/"),
            find_command = {
              "fd", "--type", "f", "--ignore-case",
              "hw|homework|prob.*set|pset|ps|assign|asn|lab|proj|quiz|exam|midterm|final|tut|sheet",
            },
            prompt_title = "Find Homework (All)",
          })
        end,
        desc = "[d]oc [h]omework",
      },
    },
  },

}
