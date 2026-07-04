-- Personal Abolish typo corrections.
-- These were moved from NoetherVim core since they reflect individual
-- typing patterns rather than universal defaults.
--
-- Add your own with:  :Abolish {typo} {correction}
-- Abolish handles all case variants automatically.
--
-- Context gating (NoetherVim core sets this up automatically):
--   The distro sets g:abolish_default_expr = "NoetherAbolishSpell", so every
--   :Abolish line below is registered as <expr> and only fires inside prose
--   buffers, comments, or @spell-tagged regions of code.  No change needed
--   here for that to take effect.
--
--   To opt a single line out of the gate (always expand, even in code):
--     Abolish -expr= some_typo some_correction
--
--   To force unconditional expansion in the current buffer at runtime:
--     [oA   (force on)     ]oA   (return to gated)
--
-- Plugin URL must match NoetherVim's distro spec exactly so lazy.nvim merges
-- the two specs into one plugin instance.  Currently: Chiarandini/vim-abolish
-- (fork adds the -expr= option; PR open at tpope/vim-abolish#126).
return {
	"Chiarandini/vim-abolish",
	config = function()
		vim.cmd([[
Abolish ot to
Abolish sa as
Abolish THe The
Abolish adn and
Abolish elt let
Abolish cna can
Abolish fro for
Abolish hte the
Abolish nad and
Abolish ofr for
Abolish teh the
Abolish tat that
Abolish ahve have
Abolish cric circ
Abolish habe have
Abolish htat that
Abolish hten then
Abolish htis this
Abolish jsut just
Abolish konw know
Abolish iwht with
Abolish iwth with
Abolish swho show
Abolish taht that
Abolish tehn then
Abolish waht what
Abolish wnat want
Abolish wtih with
Abolish habve have
Abolish doign doing
Abolish sicne since
Abolish whihc which
Abolish raelly really
Abolish howver however
Abolish neeed{ed} need{}
Abolish funciton function
Abolish iamge{,s} image{}
Abolish skrew{ing} screw{}
Abolish imporant important
Abolish invariatn invariant
Abolish funcitonal{,s} functional{}
Abolish knoweldge knowledge
Abolish {,sub}lienear {}linear
Abolish imm{e,i}daite immediate
Abolish percieve{,d} perceive{}
Abolish seperate{,d} separate{}
Abolish cor{,r}ol{,l}ary corollary
Abolish cor{,r}ol{,l}aries corollaries
Abolish {,sub}moduel{,s} {}module{}
Abolish responsiblity responsibility
Abolish {,sub,eigen}sapce{,s} {}space{}
Abolish {conditi,approximati}no{,s} {}on{s}
Abolish {,un}nec{ce,ces,e}sar{y,ily} {}nec{es}sar{}
Abolish {,un}suc{,c}esful{,l,ly} {}succ{,}essful{,,ly}
]])
	end,
}
