-- User Zero personal Oil extensions
-- AirDrop, dual-pane browser, and Move command. Multi-file Finder
-- clipboard (visual Y) is upstream in the distro.

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
local function airdrop_range(bufnr, start_line, end_line)
  local oil = require("oil")
  local dir = oil.get_current_dir(bufnr)
  if not dir then
    vim.notify("AirDrop: could not resolve Oil directory", vim.log.levels.WARN)
    return
  end
  local paths = {}
  local skipped = 0
  for lnum = start_line, end_line do
    local entry = oil.get_entry_on_line(bufnr, lnum)
    if entry then
      if entry.type == "directory" then
        skipped = skipped + 1
      else
        table.insert(paths, dir .. entry.name)
      end
    end
  end
  if #paths == 0 then
    vim.notify("AirDrop: no files in range", vim.log.levels.WARN)
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

local function airdrop_under_cursor()
  local bufnr = vim.api.nvim_get_current_buf()
  local lnum = vim.api.nvim_win_get_cursor(0)[1]
  airdrop_range(bufnr, lnum, lnum)
end

vim.api.nvim_create_autocmd("FileType", {
  pattern = "oil",
  callback = function(args)
    vim.keymap.set("n", "ga", airdrop_under_cursor, {
      buffer = args.buf,
      desc = "AirDrop file under cursor",
    })
    -- Visual-mode keymap goes through a buffer-local :range command so that
    -- `:` in visual mode auto-prefixes `'<,'>` and gives us line1/line2.
    vim.api.nvim_buf_create_user_command(args.buf, "AirDropRange", function(opts)
      airdrop_range(args.buf, opts.line1, opts.line2)
    end, { range = true })
    vim.keymap.set("x", "ga", ":AirDropRange<CR>", {
      buffer = args.buf,
      silent = true,
      desc = "AirDrop selected files",
    })
  end,
})

return {}
