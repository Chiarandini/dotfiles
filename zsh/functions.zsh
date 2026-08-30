# ~/.config/zsh/functions.zsh
# Shell functions (as opposed to aliases). Sourced from ~/.zshrc.

# ─── zj: project session launcher ────────────────────────────────────────
# Usage: zj <project-name>
#
# - If a zellij session named <project-name> is already running, attach to it.
# - Otherwise, cd into ~/programming/<project-name>, then create a new zellij
#   session using ~/.config/zellij/layouts/<project-name>.kdl if it exists,
#   falling back to zellij's default layout if it doesn't.
#
# Example:
#     zj openclaw           # first call: creates session w/ openclaw layout
#     <do work, Ctrl-O d>   # detach
#     zj openclaw           # reattach, everything's still running
zj() {
    local name="${1:?Usage: zj <project-name>}"
    local layout="$HOME/.config/zellij/layouts/${name}.kdl"
    local proj_dir="$HOME/programming/$name"

    # Refuse to nest — zellij silently degrades --session to attach-only
    # when already inside a session, which produces confusing errors.
    if [[ -n "$ZELLIJ" ]]; then
        echo "zj: already inside a zellij session ('${ZELLIJ_SESSION_NAME:-?}')." >&2
        echo "    Detach first with Ctrl-g, Ctrl-o, d — then run zj again." >&2
        return 1
    fi

    if [[ ! -d "$proj_dir" ]]; then
        echo "zj: no project at $proj_dir" >&2
        return 1
    fi
    builtin cd "$proj_dir" || return 1

    # Strip ANSI color codes from list-sessions before matching.
    if zellij list-sessions 2>/dev/null | sed $'s/\x1b\\[[0-9;]*m//g' | grep -q "^${name}\\b"; then
        zellij attach "$name"
    elif [[ -f "$layout" ]]; then
        # `-n` (--new-session-with-layout) is the right flag for "create new
        # with layout". `--layout` alone means "add layout to existing session
        # as a new tab" — which errors if the session doesn't exist yet.
        zellij --session "$name" -n "$layout"
    else
        zellij --session "$name"
    fi
}

# ─── _rem: tab-completion for the `rem` reminders CLI ─────────────────────
# Completes verbs (ls/add/done/lists) and your actual Reminders list names for
# `rem ls`, `rem add`, and `rem done --list`. List names come from `rem lists`
# (names-only, fast). Cached to a FILE with a 30s TTL — not a shell var, because
# completion calls _rem_lists inside $(...) subshells where var-caching wouldn't
# survive, so zsh-autocomplete's per-keystroke completion would otherwise spawn
# an EventKit process on every key. Calls the wrapper by full path so it doesn't
# depend on the `rem` alias being expanded here.
_rem_bin="$HOME/programming/constellation/mcp-servers/apple-reminders/rem"
_rem_lists() {
    local cache="${TMPDIR:-/tmp}/rem-lists.${UID}.cache" now=0 mtime=0
    zmodload zsh/datetime 2>/dev/null; now=${EPOCHSECONDS:-0}
    zmodload zsh/stat 2>/dev/null
    [[ -f $cache ]] && mtime=$(zstat +mtime "$cache" 2>/dev/null)
    if [[ ! -s $cache || $now -eq 0 || $(( now - mtime )) -ge 30 ]]; then
        "$_rem_bin" lists 2>/dev/null > "$cache"
    fi
    cat "$cache" 2>/dev/null
}
_rem() {
    local state
    _arguments -C '1: :->verb' '*:: :->args' && return
    case $state in
        verb)
            local -a verbs
            verbs=('ls:items in a list' 'add:create a reminder'
                   'done:complete (or fzf picker)' 'lists:print list names')
            _describe 'rem command' verbs ;;
        args)
            local -a lists
            case $words[1] in
                ls)  lists=("${(@f)$(_rem_lists)}"); compadd -a lists ;;
                add) [[ $CURRENT -eq 2 ]] && { lists=("${(@f)$(_rem_lists)}"); compadd -a lists } ;;
                done)
                    if [[ $words[CURRENT-1] == --list ]]; then
                        lists=("${(@f)$(_rem_lists)}"); compadd -a lists
                    else
                        compadd -- --list
                    fi ;;
            esac ;;
    esac
}
(( $+functions[compdef] )) && compdef _rem rem

# ─── nvim: "run a command in this dir on quit" handoff ────────────────────
# Neovim can't inject a command into its parent shell, so Oil's `gR` keymap
# (see ~/.config/nvim/ftplugin/oil.lua) hands one back through a file: it
# writes "<dir>\n<command>" to $NVIM_RUN_ON_EXIT, then quits. Here we point
# that env var at a fresh temp file before launching; once Neovim exits we
# cd into <dir> and run <command> in the REAL terminal — no nested :terminal,
# you're fully back in the shell (e.g. yazi, claude, lazygit).
#
# Transparent for every other launch: the file stays empty unless `gr` fires,
# and every alias/function that ultimately calls `nvim` (oil, nvdn, nvims, n,
# W) routes through here for free. `command nvim` avoids recursion; `builtin
# cd` sidesteps the zoxide `cd`. Git's $EDITOR launches use the raw binary
# (functions aren't exported), so commit editing is untouched.
nvim() {
    local handoff
    handoff="$(mktemp "${TMPDIR:-/tmp}/nvim-onexit.XXXXXX")" \
        || { command nvim "$@"; return $?; }

    NVIM_RUN_ON_EXIT="$handoff" command nvim "$@"
    local ret=$?

    if [[ -s "$handoff" ]]; then
        local dir cmd
        dir="$(sed -n '1p' -- "$handoff")"
        cmd="$(sed -n '2,$p' -- "$handoff")"
        rm -f -- "$handoff"
        [[ -n "$dir" && -d "$dir" ]] && builtin cd -- "$dir"
        if [[ -n "$cmd" ]]; then
            print -s -- "$cmd"   # save to shell history
            eval "$cmd"
            return $?
        fi
        return $ret
    fi

    rm -f -- "$handoff"
    return $ret
}

# ─── nvs: nvim, restoring this directory's session ────────────────────────
# persistence.nvim keys sessions by cwd, so this reopens whatever was last
# open here. tmux-resurrect restores nvim panes by typing `nvs` into the
# pane's shell (process_restore_helpers.sh:38), which is why this is a
# function and not a script in ~/.local/bin: going through the shell keeps
# the nvim() handoff wrapper above, and a bare script would bypass it.
nvs() {
    if (( $# )); then
        nvim "$@"
    else
        nvim -c "lua require('persistence').load()"
    fi
}

# ─── tx: enter a tmux project ─────────────────────────────────────────────
# The single entry point: picks a project (roots + zoxide) and attaches, or
# creates it. Works from a bare shell and from inside tmux. With an argument,
# attaches to a matching session directly and skips the picker.
# Guide: ~/.config/tmux/README.md
tx() {
    if (( $# )); then
        local match
        match="$(tmux list-sessions -F '#{session_name}' 2>/dev/null \
                 | grep -i -- "$1" | head -1)"
        if [[ -n "$match" ]]; then
            if [[ -n "$TMUX" ]]; then
                tmux switch-client -t "=$match"
            else
                tmux attach-session -t "=$match"
            fi
            return $?
        fi
        print -u2 "tx: no session matching '$1'; opening the picker"
    fi
    ~/.config/tmux/bin/sessionizer.sh
}

# ─── c / ci: cd to a named directory (dirmarks) ───────────────────────────
# Usage:
#     c                      fzf picker over every bookmark
#     c <name>               cd there (exact → unique prefix → unique substring)
#     c <name>/sub/dir       cd into a subdirectory of a bookmark
#     c <anything else>      falls through to zoxide's `cd` — never in the way
#     c add [name] [path]    default: basename of $PWD, $PWD   (-n "note")
#     c rm <name>...         c mv <old> <new>    c set <name> [path]
#     c note <name> [text]   c ls    c check    c edit    c help
#
#     ci <name> [depth]      "change inside": fuzzy-pick a SUBDIRECTORY of a
#     ci                     bookmark and cd there (depth 1 by default)
#
#     cn [name]              "cd, then nvim": same targeting as `c`, then opens
#                            `nvim .` so you land in an Oil buffer
#
# The three verbs differ only in what happens once a directory is chosen, so
# they share one targeting path (_dm_navigate) and one picker (_dm_pick_marks)
# — a bookmark resolves the same way no matter which one you typed.
#
# `ci` reads as vim's `ci` — change *inside*. It exists because a bookmark
# like `textbooks` is a container of 59 sibling projects: naming each one
# would be upkeep, and browsing them is not the same act as jumping to a
# name you already decided on. Also reachable as tab / ^l inside `c`.
#
# The bookmarks live in ~/.config/dirmarks and are owned by the `dirmarks`
# script (~/.config/scripts/dirmarks, symlinked onto $PATH from
# ~/.local/bin) — the same data and verbs Neovim's `:C`
# and `:Ci` use, so the two front-ends cannot drift apart.
#
# The subcommand words above always win over a bookmark of the same name;
# `dirmarks add` refuses to create one, so the ambiguity can't arise.

# Options shared by both pickers, assigned once at source time. Every stream
# fed to them is "display<TAB>abspath[<TAB>name]": field 1 is what fzf shows
# and searches, field 2 feeds the preview and becomes the result.
typeset -ga _DM_FZF
_DM_FZF=(
	--ansi --delimiter=$'\t' --with-nth=1
	--height='~70%' --layout=reverse --border
	--preview='eza -lh --icons --git --color=always {2} 2>/dev/null || ls -lahLG {2}'
	--preview-window='right,55%,border-left'
	--bind='ctrl-k:up,ctrl-j:down'
	--bind='ctrl-u:preview-half-page-up,ctrl-d:preview-half-page-down'
)

# cd to a chosen directory, honouring the key that selected it.
_dm_go() {
	local key=$1 dir=$2
	[[ -n $dir ]]  || { print -u2 -- "c: nothing selected"; return 1 }
	[[ -d $dir ]]  || { print -u2 -- "c: no such directory: $dir"; return 1 }
	builtin cd -- "$dir" || return 1
	[[ $key == ctrl-o ]] && nvim .
	return 0
}

# Picker over the bookmarks themselves. $1 says what <CR> means, which is the
# only thing separating the three verbs:
#     (empty)   cd there            `c`
#     descend   go inside it        `ci`
#     open      cd there + nvim .   `cn`
_dm_pick_marks() {
	local mode=$1 out key line dir name kidmode=""
	local -a f
	[[ $mode == open ]] && kidmode=open
	out=$(dirmarks ls --fzf | fzf "${_DM_FZF[@]}" --prompt='  cd  ' \
		--expect=ctrl-o,ctrl-e,ctrl-y,ctrl-l,tab \
		--bind='ctrl-x:execute-silent(dirmarks rm {3})+reload(dirmarks ls --fzf)' \
		--bind='ctrl-a:execute(dirmarks add)+reload(dirmarks ls --fzf)' \
		--header='enter cd · tab/^l into · ^o cd+nvim · ^a add $PWD · ^x delete · ^e edit · ^y copy')
	[[ -z $out ]] && return 0

	key=${out%%$'\n'*}
	line=${out#*$'\n'}
	f=("${(@ps:\t:)line}")            # display, abspath, name
	dir=$f[2]; name=$f[3]

	case $key in
		ctrl-e)     dirmarks edit; return $? ;;
		ctrl-y)     print -rn -- "$dir" | copy_to_clipboard
		            print -r -- "copied: $dir"; return 0 ;;
		ctrl-l|tab) _dm_pick_children "$name" 1 "$kidmode"; return $? ;;
	esac
	[[ $mode == descend ]] && { _dm_pick_children "$name" 1 "$kidmode"; return $? }
	# `cn` asks for exactly what ^o already does, so route it through the same
	# key rather than duplicating the "cd, then nvim" step.
	[[ $mode == open && -z $key ]] && key=ctrl-o
	_dm_go "$key" "$dir"
}

# Picker over one bookmark's subdirectories. Deliberately one column of
# relative paths, not the three-column bookmark view: this is browsing a
# directory, not choosing from the curated list.
_dm_pick_children() {
	local name=$1 depth=${2:-1} mode=$3 list out key line dir
	local -a f
	list=$(dirmarks children "$name" "$depth") || return 1
	[[ -n $list ]] || { print -u2 -- "c: no subdirectories under '$name'"; return 1 }

	out=$(print -r -- "$list" | fzf "${_DM_FZF[@]}" --prompt="  $name/  " \
		--expect=ctrl-o,ctrl-y \
		--header="inside $name · enter cd · ^o cd+nvim · ^y copy path")
	[[ -z $out ]] && return 0

	key=${out%%$'\n'*}
	line=${out#*$'\n'}
	f=("${(@ps:\t:)line}")            # relative path, abspath
	dir=$f[2]

	[[ $key == ctrl-y ]] && {
		print -rn -- "$dir" | copy_to_clipboard
		print -r -- "copied: $dir"; return 0
	}
	[[ $mode == open && -z $key ]] && key=ctrl-o
	_dm_go "$key" "$dir"
}

# Targeting shared by `c` and `cn`, so a name can never resolve one way for
# one verb and another way for the other. $1 is what to do after landing:
# "" (stay in the shell) or "open" (drop into nvim's Oil buffer).
_dm_navigate() {
	local mode=$1; shift
	local dir rc

	# Anything that already looks like a path (or `-`) is plain navigation:
	# hand it to zoxide untouched rather than second-guessing it.
	if [[ $1 == - || $1 == .* || $1 == /* || $1 == '~'* || -d $1 ]]; then
		cd "$@" || return $?
	else
		dir=$(dirmarks resolve "$1"); rc=$?
		if (( rc == 2 )); then
			return 1                  # ambiguous — dirmarks already explained
		elif (( rc == 0 )) && [[ -n $dir ]]; then
			[[ -d $dir ]] || { print -u2 -- "c: $1 → $dir (gone; fix with \`c set $1\`)"; return 1 }
			builtin cd -- "$dir" || return 1
		else
			cd "$@" || return $?      # not a bookmark → zoxide's frecency
		fi
	fi

	[[ $mode == open ]] && { nvim .; return $? }
	return 0
}

c() {
	(( $# == 0 )) && { _dm_pick_marks; return $? }

	case $1 in
		add|rm|remove|edit|ls|list|mv|rename|set|note|check|file|names|path|resolve|children|fmt|help|-h|--help)
			dirmarks "$@"; return $? ;;
	esac
	_dm_navigate "" "$@"
}

ci() {
	(( $# == 0 )) && { _dm_pick_marks descend; return $? }
	_dm_pick_children "$1" "${2:-1}"
}

# `cn` deliberately has no subcommands: `cn add` would mean "bookmark this,
# then open an editor on it", which is not a thing anyone wants. Management
# stays on `c`.
cn() {
	(( $# == 0 )) && { _dm_pick_marks open; return $? }
	_dm_navigate open "$@"
}

# Bookmark names as "name:path" completion candidates. Parsed inline rather
# than by shelling out to `dirmarks names`, because zsh-autocomplete
# re-completes on every keystroke and a fork per keypress is exactly the lag
# these commands exist to avoid. Read-only, so it cannot corrupt the file —
# `dirmarks` stays the only writer.
_dm_names() {
	setopt localoptions extendedglob
	local file=${DIRMARKS_FILE:-$HOME/.config/dirmarks}
	local line name rest p
	reply=()
	[[ -f $file ]] || return
	for line in ${(f)"$(<$file)"}; do
		line=${line//$'\t'/  }
		[[ -z ${line//[[:space:]]/} || ${line##[[:space:]]#} == '#'* ]] && continue
		name=${line%%[[:space:]][[:space:]]*}
		rest=${${line#$name}##[[:space:]]#}
		p=${rest%%[[:space:]][[:space:]]*}
		reply+=("$name:$p")
	done
}

# Bookmark names, or real directories after "<name>/". Returns 0 when it
# handled a "<name>/…" completion, so the caller knows to add nothing else.
_dm_complete_marks() {
	setopt localoptions extendedglob
	if compset -P '(#b)([^/]##)/'; then
		local base=$(dirmarks path $match[1] 2>/dev/null)
		[[ -n $base ]] && _path_files -/ -W $base
		return 0
	fi
	local -a reply
	_dm_names
	_describe -t dirmarks 'directory' reply
	return 1
}

_c() {
	_dm_complete_marks && return
	local -a verbs
	verbs=(
		'add:bookmark $PWD (or a given path)'
		'rm:delete a bookmark'      'mv:rename a bookmark'
		'set:repoint a bookmark'    'note:set the note column'
		'ls:print the table'        'edit:open the list in $EDITOR'
		'check:validate the list'   'help:usage'
	)
	_describe -t commands 'dirmarks command' verbs
}

# No verbs on `cn` — only places to go.
_cn() { _dm_complete_marks }

_ci() {
	local -a reply
	if (( CURRENT == 2 )); then
		_dm_names
		_describe -t dirmarks 'container' reply
	else
		_message 'depth (default 1)'
	fi
}

if (( $+functions[compdef] )); then
	compdef _c  c
	compdef _ci ci
	compdef _cn cn
fi

# ─── whereref: find who references a path fragment ────────────────────────
# The zero-upkeep "registry" for file reorganizations. Before or after moving
# a dir, run e.g. `whereref Documents/textbooks` to list every config, skill,
# and doc that hard-codes it. Your greppable configs ARE the registry — always
# current, nothing to maintain. Searches the roots that actually hold path
# strings and skips backups/caches/transcripts/archives that self-heal or
# don't matter. Pair with the $-anchors in ~/.config/paths.env: send the few
# hard code deps through an anchor (edit one line on a move), and use this to
# sweep the long tail of prose that can't read an env var.
whereref() {
    local frag="${1:?Usage: whereref <path-fragment>   e.g. whereref Documents/textbooks}"
    rg -n --hidden -S "$frag" \
        ~/.config ~/.claude/skills ~/programming ~/Documents/vault ~/Documents/academic \
        -g '!**/.git/**' -g '!**/node_modules/**' -g '!**/.venv/**' -g '!**/venv/**' \
        -g '!**/target/**' -g '!**/dist/**' -g '!**/build/**' \
        -g '!**/.claude/backups/**' -g '!**/.claude/file-history/**' \
        -g '!**/.claude/projects/**' -g '!**/.claude/todos/**' \
        -g '!**/.claude/shell-snapshots/**' -g '!**/.claude/sessions/**' \
        -g '!**/taborg/state-backup*' -g '!**/_archive/**' -g '!**/*.DS_Store'
}

# ─── pages: EYNTKA series page-count odometer ─────────────────────────────
# The private "how many pages have I written" counter. Walks up from $PWD to
# find the textbooks repo's .eyntka/ dir (no hardcoded path — works from any
# subfolder, and survives moving the repo). With no args it prints the
# distinct-live total AND records a dated snapshot to a gitignored log, then
# shows the WIP-inclusive view for fun (display-only, so the tracked history
# stays the single canonical number). Any args pass straight through, e.g.
#   pages --history      # the growth log over time
#   pages --flat         # hide the per-member mega breakdown
#   pages --mode=all     # just the WIP-inclusive number (records its own log)
#   pages --no-log       # print without recording
pages() {
    local dir="$PWD"
    while [[ "$dir" != "/" && ! -d "$dir/.eyntka" ]]; do dir="${dir:h}"; done
    local sp="$dir/.eyntka/scripts/series-pages.sh"
    if [[ ! -x "$sp" ]]; then
        print -u2 "pages: not inside the EYNTKA textbooks repo (no .eyntka/series-pages.sh found)"
        return 1
    fi
    if (( $# )); then
        "$sp" "$@"                              # explicit flags → run once, pass through
    else
        "$sp"                                   # distinct-live: full view + records a snapshot
        "$sp" --mode=all --no-log --brief       # WIP-inclusive: one-line summary
    fi
}
# tab-completion: `pages --<TAB>` lists the flags (and `--mode=<TAB>` the modes)
if (( $+functions[compdef] )); then
    _pages() {
        _arguments -s \
            '--mode=-[which set of books to count]:mode:(distinct site all)' \
            '--flat[hide the per-member mega breakdown]' \
            '--brief[print just a one-line total summary]' \
            '--no-log[print without recording a snapshot]' \
            '--history[show the growth log over time, then exit]' \
            '--help[show usage]'
    }
    compdef _pages pages
fi

# ─── pdf: open a PDF from the current directory ───────────────────────────
# The command itself is a script (~/.config/scripts/pdf, on $PATH via
# ~/.local/bin) — nothing here needs the shell's state, and keeping it a
# script means Neovim's `:!pdf` and any non-zsh caller get the same thing.
#   pdf              the only PDF here opens; several → fzf picker w/ preview
#   pdf <query>      a unique name match opens straight away
#   pdf -r / -a / -p recurse · force the picker · print the path
# Only the completion lives here, because compdef does.
if (( $+functions[compdef] )); then
    _pdf() {
        _arguments -s \
            '(-r --recursive)'{-r,--recursive}'[look in subdirectories too]' \
            '(-a --all)'{-a,--all}'[always show the picker, even for one match]' \
            '(-p --print)'{-p,--print}'[print the path instead of opening it]' \
            '(- *)'{-h,--help}'[show usage]' \
            '*:pdf:_files -g "*.pdf(-.)"'
    }
    compdef _pdf pdf
fi
