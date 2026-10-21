-- User Zero personal Oil extensions
-- AirDrop, dual-pane browser, Move command, and select mode on
-- <Space><Space>. Select mode itself and the multi-file Finder clipboard
-- (Y) are upstream in the distro.

-- ── Dual-pane oil browser ─────────────────────────────────────────────────
-- Opens a snacks directory picker twice, then opens the two chosen dirs
-- as side-by-side Oil buffers rooted at ~/Documents.
--
-- Implementation note: Snacks.picker.files injects `--type f --type l` into
-- fd's args, and extra --type flags combine as OR rather than AND, so we
-- can't just pass `--type d`. We shell out to fd ourselves and feed the
-- results as plain items to the generic Snacks.picker().
local function open_dual_oil()
  local target_cwd = vim.fn.expand("~/Documents")
  local Snacks     = require("snacks")
  local oil        = require("oil")

  local function list_dirs()
    local out = vim.fn.systemlist({
      "fd", "--type", "d", "--hidden", "--exclude", ".git",
      ".", target_cwd,
    })
    local items = {}
    for _, path in ipairs(out) do
      if path:sub(-1) == "/" then path = path:sub(1, -2) end
      local rel = path:sub(#target_cwd + 2)  -- strip "target_cwd/" prefix
      table.insert(items, { text = rel ~= "" and rel or path, file = path })
    end
    return items
  end

  local function pick_dir(title, on_selected)
    local items = list_dirs()
    if #items == 0 then
      vim.notify("[dual-oil] no directories found under " .. target_cwd, vim.log.levels.WARN)
      return
    end
    Snacks.picker({
      title   = title,
      items   = items,
      format  = function(item) return { { item.text } } end,
      confirm = function(picker, item)
        picker:close()
        if not item then return end
        on_selected(item.file)
      end,
    })
  end

  pick_dir("Select Left Directory", function(dir1)
    pick_dir("Select Right Directory", function(dir2)
      oil.open(dir1)
      vim.cmd("vsplit")
      oil.open(dir2)
    end)
  end)
end

vim.api.nvim_create_user_command("Move", open_dual_oil, { desc = "Dual Oil browser" })
	vim.keymap.set("n", "<space>m", open_dual_oil, { desc = "Dual Oil browsers" })

-- ── AirDrop file(s) from Oil ──────────────────────────────────────────────
-- Acts on what the distro's multi-file keys (Y, gz, gZ) act on, via
-- noethervim.util.oil_select.targets(): the select-mode selection, else the
-- visual range, else the entry under the cursor.
local function airdrop()
  local dir, targets = require("noethervim.util.oil_select").targets()
  if not dir then
    vim.notify("AirDrop: could not resolve Oil directory", vim.log.levels.WARN)
    return
  end
  local paths = {}
  local skipped = 0
  for _, t in ipairs(targets) do
    if t.type == "directory" then
      skipped = skipped + 1
    else
      table.insert(paths, t.path)
    end
  end
  if #paths == 0 then
    vim.notify("AirDrop: no files to send", vim.log.levels.WARN)
    return
  end
  local cmd = { vim.env.HOME .. "/.local/bin/airdrop" }
  vim.list_extend(cmd, paths)
  vim.system(cmd, { detach = true })
  local msg = string.format("AirDrop: %d file(s)", #paths)
  if skipped > 0 then
    msg = msg .. string.format(" (skipped %d dir(s))", skipped)
  end
  vim.notify(msg)
end

-- ── Fuzzy "/" over the current Oil listing (non-recursive) ────────────────
-- Override `/` in Oil buffers so it fuzzy-matches only the entries currently
-- shown in the buffer — files *and* folders, respecting the hidden toggle —
-- rather than doing a normal in-buffer search. Deliberately non-recursive,
-- unlike the distro's `gf` (recursive Snacks.picker.files).
--
-- Inside the picker:
--   <CR>    open — like pressing <CR> on the entry in Oil (enter dir / open file)
--   <S-CR>  jump — land the Oil cursor on the entry WITHOUT opening it
--
-- The picker itself lives in the distro (noethervim.util.oil_pick) so that
-- filtered variants can share it — the LaTeX bundle's `gt` is this same
-- picker narrowed to .tex, with the same two keys. Here it runs unfiltered.
--
-- Rebind the jump key here (single, obvious override point). <CR> stays Snacks'
-- built-in confirm. <S-CR> needs a terminal that distinguishes it from <CR>
-- (kitty keyboard protocol — same requirement as the distro's browse picker).
local FUZZY_KEYS = {
  jump = "<S-CR>",
}

local function fuzzy_pick_in_oil()
  require("noethervim.util.oil_pick").pick({ keys = FUZZY_KEYS })
end

vim.api.nvim_create_autocmd("FileType", {
  pattern = "oil",
  callback = function(args)
    vim.keymap.set({ "n", "x" }, "ga", airdrop, {
      buffer = args.buf,
      desc = "AirDrop file(s): entry, visual range, or selection",
    })
    vim.keymap.set("n", "/", fuzzy_pick_in_oil, {
      buffer = args.buf,
      desc = "Fuzzy-find entries in this dir",
    })
  end,
})

-- ── Select mode on <Space><Space> ────────────────────────────────────────
-- The distro binds select mode to `gm` (SearchLeader is side-effect free by
-- its own rules); this puts it on the key Finder-style file managers use.
-- Shadows the global <Space><Space> file browser only inside Oil.
return {
  "stevearc/oil.nvim",
  opts = {
    skip_confirm_for_simple_edits = true,
    keymaps = {
      ["<Space><Space>"] = {
        desc = "select mode: toggle entry",
        mode = "n",
        callback = function() require("noethervim.util.oil_select").enter() end,
      },
    },
  },
}
