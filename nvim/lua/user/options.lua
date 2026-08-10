
--enable new experiemntalt ui
require('vim._core.ui2').enable()
-- Personal option overrides moved from NoetherVim core.
vim.o.autochdir     = true   -- default: false
vim.o.sidescrolloff = 36     -- default: 8
vim.o.scroll        = 16     -- default: removed (vim default: half window height)
vim.o.smarttab      = false  -- default: removed (vim default: true)

vim.o.autowriteall=false
vim.o.confirm=false

vim.bo.tabstop    = 2  -- default: 4
-- formatoptions left at distro default ("croq1jn"): keeps `r` so <CR>
-- continues comment leaders, paired with the global <S-CR> escape.

-- ── Personal spell dictionary ────────────────────────────────────────────────
vim.opt.spellfile:append(vim.fn.stdpath("config") .. "/spell/en.utf-8.add")

-- ── VimTeX (must be set before any .tex file opens) ──────────────────────────
vim.g.vimtex_view_method        = 'skim'
-- activate = 1: bring the *target* PDF to Skim's front on forward search so the
-- viewer's `app.documents[0].go(...)` (see vimtex/view/skim.vim) syncs the right
-- document when several PDFs are open -- with activate = 0 it could sync whatever
-- happened to be frontmost. Trade-off: Skim takes focus on <localleader>lv.
vim.g.vimtex_view_skim_activate = 1
vim.g.vimtex_view_skim_sync     = 0
vim.cmd("let g:vimtex_mappings_disable = { 'i': [']]']}")
vim.cmd([=[
let g:vimtex_syntax_custom_cmds = [
	  \ {'name': 'vct', 'mathmode': 1, 'argstyle': 'bold'},
	  \ {'name': 'bf', 'mathmode': 1, 'argstyle': 'bold'},
	  \ {'name': 'division', 'cmdre': 'division>', 'mathmode': 1, 'concealchar': '÷'},
	  \ {'name': 'R', 'cmdre': 'R>', 'mathmode': 1, 'concealchar': 'ℝ'},
	  \ {'name': 'Q', 'cmdre': 'Q>', 'mathmode': 1, 'concealchar': 'ℚ'},
	  \ {'name': 'T', 'cmdre': 'T>', 'mathmode': 1, 'concealchar': '𝕋'},
	  \ {'name': 'Z', 'cmdre': 'Z>', 'mathmode': 1, 'concealchar': 'ℤ'},
	  \ {'name': 'F', 'cmdre': 'F>', 'mathmode': 1, 'concealchar': '𝔽'},
	  \ {'name': 'C', 'cmdre': 'C>', 'mathmode': 1, 'concealchar': 'ℂ'},
	  \ {'name': 'Rw', 'cmdre': 'Rw>', 'mathmode': 1, 'concealchar': '⇒'},
	  \ {'name': 'Lw', 'cmdre': 'Lw>', 'mathmode': 1, 'concealchar': '⇐'},
	  \ {'name': 'A', 'cmdre': 'A>', 'mathmode': 1, 'concealchar': '𝔸'},
	  \ {'name': 'fp', 'cmdre': 'fp>', 'mathmode': 1, 'concealchar': '𝔭'},
	  \ {'name': 'fa', 'cmdre': 'fa>', 'mathmode': 1, 'concealchar': '𝔞'},
	  \ {'name': 'fb', 'cmdre': 'fb>', 'mathmode': 1, 'concealchar': '𝔟'},
	  \ {'name': 'fq', 'cmdre': 'fq>', 'mathmode': 1, 'concealchar': '𝔮'},
	  \ {'name': 'fm', 'cmdre': 'fm>', 'mathmode': 1, 'concealchar': '𝔪'},
	  \ {'name': 'FP', 'cmdre': 'FP>', 'mathmode': 1, 'concealchar': '𝔓'},
	  \ {'name': 'wto', 'cmdre': 'wto>', 'mathmode': 1, 'concealchar': '⇀'},
	  \ {'name': 'sse', 'cmdre': 'sse>', 'mathmode': 1, 'concealchar': '⊆'},
	  \ {'name': 'actson', 'cmdre': 'actson>', 'mathmode': 1, 'concealchar': '↷'},
	  \ {'name': 'qn', 'conceal': v:true},
	  \]
]=])
