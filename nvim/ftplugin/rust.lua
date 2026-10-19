-- Rust run/debug maps. rustaceanvim ships its own ftplugin/rust.lua and both
-- run; this one only adds keys.
--
-- Lowercase picks from a list, uppercase repeats the last pick. The repeat
-- form is a bang on the command (`:RustLsp! runnables`), not a `last` argument.

---@param subcmd string
---@param bang? boolean
local function rustlsp(subcmd, bang)
  return function()
    -- :RustLsp is created when rust-analyzer finishes initialising and removed
    -- when it exits, so on a cold crate it does not exist for the first few
    -- seconds and pressing the key would report E492.
    if vim.fn.exists(":RustLsp") ~= 2 then
      vim.notify("rust-analyzer is still starting", vim.log.levels.WARN)
      return
    end
    vim.cmd(("RustLsp%s %s"):format(bang and "!" or "", subcmd))
  end
end

local function map(lhs, rhs, desc)
  vim.keymap.set("n", lhs, rhs, { buffer = true, silent = true, desc = desc })
end

map("<LocalLeader>rr", rustlsp("runnables"),         "Rust: pick a runnable")
map("<LocalLeader>rd", rustlsp("debuggables"),       "Rust: pick a debuggable")
map("<LocalLeader>rt", rustlsp("testables"),         "Rust: pick a testable")
map("<LocalLeader>rR", rustlsp("runnables", true),   "Rust: re-run last runnable")
map("<LocalLeader>rD", rustlsp("debuggables", true), "Rust: re-debug last")
map("<LocalLeader>rT", rustlsp("testables", true),   "Rust: re-run last testable")
