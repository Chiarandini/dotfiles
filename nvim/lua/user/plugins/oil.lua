-- User Zero personal Oil extensions
-- macOS Finder clipboard, dual-pane browser, and Move command.

-- ── Dual-pane oil browser ─────────────────────────────────────────────────
-- Opens a Telescope directory picker twice, then opens the two chosen dirs
-- as side-by-side Oil buffers rooted at ~/Documents.
local function open_dual_oil()
  local target_cwd = vim.fn.expand("~/Documents")
  local builtin     = require("telescope.builtin")
  local actions     = require("telescope.actions")
  local action_state = require("telescope.actions.state")
  local oil         = require("oil")
  local dir_cmd     = { "fd", "--type", "d", "--hidden", "--exclude", ".git" }

  builtin.find_files({
    prompt_title = "Select Left Directory",
    cwd          = target_cwd,
    find_command = dir_cmd,
    attach_mappings = function(prompt_bufnr)
      actions.select_default:replace(function()
        actions.close(prompt_bufnr)
        local sel1 = action_state.get_selected_entry()
        local dir1 = sel1.path or (target_cwd .. "/" .. sel1.value)

        builtin.find_files({
          prompt_title = "Select Right Directory",
          cwd          = target_cwd,
          find_command = dir_cmd,
          attach_mappings = function(prompt_bufnr2)
            actions.select_default:replace(function()
              actions.close(prompt_bufnr2)
              local sel2 = action_state.get_selected_entry()
              local dir2 = sel2.path or (target_cwd .. "/" .. sel2.value)
              oil.open(dir1)
              vim.cmd("vsplit")
              oil.open(dir2)
            end)
            return true
          end,
        })
      end)
      return true
    end,
  })
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
