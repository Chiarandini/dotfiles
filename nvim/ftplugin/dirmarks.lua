-- ft=dirmarks — the ~/.config/dirmarks bookmark list (see
-- lua/user/configs/dirmarks.lua, and `dirmarks help` in the shell).
--
-- Columns are highlighted live, a path whose directory is gone turns red,
-- :w realigns through the same formatter `c add` uses, and <CR> cds to the
-- directory on the current line.
require("user.configs.dirmarks").on_buffer()
