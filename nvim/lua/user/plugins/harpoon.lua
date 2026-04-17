-- User Zero harpoon direct-jump keys
-- <C-number> sequences are not reliable across terminal emulators, so direct
-- mark jumps are intentionally excluded from the NoetherVim distro.
-- Alt+number works well in most terminals; adjust to whatever yours supports.

return {
  {
    "ThePrimeagen/harpoon",
    branch = "harpoon2",
    keys = {
      { "<M-1>", function() require("harpoon"):list():select(1) end, desc = "harpoon mark 1" },
      { "<M-2>", function() require("harpoon"):list():select(2) end, desc = "harpoon mark 2" },
      { "<M-3>", function() require("harpoon"):list():select(3) end, desc = "harpoon mark 3" },
      { "<M-4>", function() require("harpoon"):list():select(4) end, desc = "harpoon mark 4" },
    },
  },
}
