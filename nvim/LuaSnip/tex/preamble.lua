---@diagnostic disable: undefined-global, unused-local
-- ========================================================================
--   ______   ___ __ __       _________  ____ ____  ____   ___ ______  _____
-- |      | /  _|  |  |     / ___|    \|    |    \|    \ /  _|      |/ ___/
-- |      |/  [_|  |  |    (   \_|  _  ||  ||  o  |  o  /  [_|      (   \_
-- |_|  |_|    _|_   _|     \__  |  |  ||  ||   _/|   _|    _|_|  |_|\__  |
--   |  | |   [_|     |     /  \ |  |  ||  ||  |  |  | |   [_  |  |  /  \ |
--   |  | |     |  |  |     \    |  |  ||  ||  |  |  | |     | |  |  \    |
--   |__| |_____|__|__|      \___|__|__|____|__|  |__| |_____| |__|   \___|
-- ========================================================================
-- Document skeletons. One trigger per kind of document I start.
--
-- Pulling a named fragment out of ~/.config/nvim/preamble/ is not done here.
-- Type `@` at the start of a line above \begin{document} for a menu of the
-- fragments it finds, with a preview of each; it searches the project as well
-- as the library, and writes \input rather than a copy when the fragment
-- travels with the document.
--
-- What is left here is the part `@` does not do: the shape of a new document.
local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local fmta = require("luasnip.extras.fmt").fmta
local helper = require('noethervim-tex.luasnip_helper')
local tex_utils = helper.tex_utils

local in_preamble = {
	condition = tex_utils.in_preamble,
	show_condition = tex_utils.in_preamble,
}

--- The date a document was started, which is worth recording and tedious to
--- type.
local function today() return os.date('%c') end

--- The title block I use on books and papers: a `huge` bold title, or nothing
--- at all when the document does not want one.
local function title_choice(idx)
	return c(idx, {
		i(1),
		sn(nil, {
			t({ '\\title{', '\t\\begin{huge}', '\t\t\\bf{' }),
			i(1),
			t({ '}', '\t\\end{huge}', '}' }),
		}),
	})
end

return
{
--  ╔══════════════════════════════════════════════════════════╗
--  ║                   type of tex document                   ║
--  ╚══════════════════════════════════════════════════════════╝
	s( -- create book
		{ trig = 'book', dscr = 'create (one-sided) book' },
		fmta([[
		\documentclass[oneside]{book}
		\title{
			\begin{huge}
				\bf{<>}
			\end{huge}
			}
		\providecommand{\documentauthor}{Author Name}
		\author{\documentauthor}

		<>

		\begin{document}
		\maketitle
		\tableofcontents

		\newpage

		Welcome! New book created on <><>

		%\shipoutAnswer

		\newpage
		%\printbibliography % needs package 'biblatex'
		\end{document}
		]],
		{
			i(1, 'title'),
			i(2),
			f(today),
			i(0),
		}),
		in_preamble
	),
	s( -- for generic article
		{ trig = 'article', dscr = 'create a paper (ex. hw, research). Note there is a "hw" snippet' },
		fmta([[
		\documentclass[oneside]{article}
		<>
		\providecommand{\documentauthor}{Author Name}
		\author{\documentauthor}

		<>

		\begin{document}

		Welcome! New document created on <><>

		\newpage
		%\printbibliography % needs package 'biblatex'
		\end{document}
		]],
		{
			title_choice(1),
			i(2),
			f(today),
			i(0),
		}),
		in_preamble
	),
	s( -- for generic paper
		{ trig = 'paper', dscr = 'create a research paper. Note there is a "hw" and "article" snippet' },
		fmta([[
		\documentclass[oneside]{article}
		<>
		\providecommand{\documentauthor}{Author Name}
		\author{\documentauthor}

		<>

		\begin{document}
		% new paper started on <>
		\begin{abstract}
			<>
		\end{abstract}

		\newpage
		%\printbibliography % needs package 'biblatex'
		\end{document}
		]],
		{
			title_choice(1),
			i(2),
			f(today),
			i(0),
		}),
		in_preamble
	),
	s( -- for hw
		{ trig = 'hw', dscr = 'create homework' },
		fmta([[
		\documentclass[oneside]{article}
		\providecommand{\documentauthor}{Author Name}
		\author{\documentauthor}
		\title{<>}

		<>

		\begin{document}
		%\maketitle
		\begin{enumerate}
			\item <>
		\end{enumerate}

		\end{document}
		]],
		{
			i(1),
			i(2),
			i(0),
		}),
		in_preamble
	),
	s( -- for slides
		{ trig = 'beamer', dscr = 'create beamer slides' },
		fmta([[
		\documentclass{beamer}
		\providecommand{\documentauthor}{Author Name}
		\author{\documentauthor}
		\title{<>}
		\institute{<>}
		\date{}

		<>

		\begin{document}
		%\maketitle
		\frame{\titlepage}
		<>
		\end{document}
		]],
		{
			i(1),
			i(2),
			i(3),
			i(0),
		}),
		in_preamble
	),
}
