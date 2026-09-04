# tmux: projects, windows, persistence

One system. tmux owns projects, work units, and surviving a crash. kitty is
the viewport. There are no tmux panes by design; nvim owns splitting.

```
session = project   pg/constellation, tb/topos-theory, wr/eyntka
  window = role     nvim, claude, shell, serve/web
```

## What a project actually is

A project is a tmux session. That is the object, and it is a real one: it has
its own name, windows, and lifetime, and it is what gets saved and restored.

A directory is only how a project is *born*. The picker offers directories
because that is the convenient way to name and place a new session, not
because a project is a directory. Once it exists you can rename it to
something with no directory behind it at all, and it stays a first-class
project: it still appears at the top of the picker, still gets saved, still
restores. Nothing looks up its directory again.

So there is no second primitive to keep in your head. There is one object,
and directories are just the doorway.

## Getting in

```sh
tx                 # pick a project, attach or create it
tx constellation   # skip the picker when you know the name
```

`tx` works from a bare shell and from inside tmux. That is the only command
you need to remember; everything else is on `cmd+k`.

Two pickers work from anywhere in kitty, including from a tab with no tmux in
it at all. They answer different questions, which is why both exist:

- **`cmd+shift+k`** finds a tmux **window** across every session. It selects
  the window first, then focuses the kitty tab already showing that session,
  or opens a tab attached if none is. Window-level rather than session-level
  on purpose: reaching a window reaches its session too.
- **`cmd+shift+p`** switches across **all kitty tabs**, tmux and standalone
  alike, tagged by what is running in them. Once some tabs hold projects and
  others hold loose work, no tmux picker can see the whole picture; this one
  can.

## Promoting a loose claude tab

`cmd+shift+u`, pressed in a kitty tab running a standalone claude. It exits the
claude there, attaches that same tab to a project, and reopens the conversation
in the project's claude window. The prompt offers the name the directory
implies; type another to land in an existing project instead, which then gains
a claude window rather than being recreated.

The process itself cannot move: its pty belongs to the kitty window, and macOS
has no working `reptyr`. The conversation can, because Claude's state is the
transcript under `~/.claude/projects/<cwd>/` and not the process. So the only
thing promoting costs you is an in-flight response, which is why it refuses
while claude is mid-response.

It reopens on the `claude --resume` picker rather than on the conversation
itself, because a *live* session cannot be identified from outside: its
transcript carries no `summary` record until it ends, claude holds no open
handle on the file between writes, and macOS will not show another process's
environment. The session you just exited is the most recently written one, so
it is the top row.

Also a kitty binding rather than a `cmd+k` action, since `cmd+k` is the tmux
prefix and a tab worth promoting has no tmux in it to receive one.

## The one key

`cmd+k` opens a menu listing every action with its letter. Read it while you
are learning; type straight through it once your fingers know. Nothing here
has to be memorised, and there is no separate cheat sheet to keep in sync.

`cmd+k` `/` fuzzy searches the same actions, for when you know what you want
but not which letter it is. `actions.tsv` is the only place actions are
defined; both the menu and the search come from it.

**After editing `actions.tsv`, regenerate:**

```sh
~/.config/tmux/bin/menu.sh generate > ~/.config/tmux/menu.generated.tmux
```

The menu binding is generated rather than built at keypress time because
building it cost **126 ms** of fork, source and file read before the menu could
be drawn, which is long enough that a quickly typed second key lands in the
pane instead of the menu. Generating moves that to config-load time and leaves
the keypress path pure tmux. `install-verify.sh` fails if the generated file
and `actions.tsv` disagree, so the two cannot drift.

| Key | Action |
|---|---|
| `cmd+k` `p` | project picker: roots plus zoxide frecency |
| `cmd+k` `w` | find window in this project |
| `cmd+k` `W` | find window across all projects |
| `cmd+k` `c` | new claude window |
| `cmd+k` `e` | new editor window |
| `cmd+k` `t` | new terminal window |
| `cmd+k` `s` | start this project's declared servers |
| `cmd+k` `l` | follow a server log |
| `cmd+k` `S` | save state now (normally automatic every 5 min) |
| `cmd+k` `L` | event log: saves and restores |
| `cmd+k` `/` | fuzzy search these actions |
| `cmd+k` `k` | key probe: what bytes does a key send |
| `cmd+k` `r` | rename window (Escape cancels) |
| `cmd+k` `P` | rename project, i.e. the session |
| `cmd+k` `y` | park / unpark window |
| `cmd+k` `[` | copy mode; `q` or Escape leaves it |
| `cmd+k` `d` | detach |
| `cmd+k` `?` | this guide |
| `cmd+k` `R` | reload tmux.conf |

Motions, no prefix. **Unshifted acts on the inner layer (tmux windows),
shifted acts on the outer layer (kitty tabs):**

| Key | Acts on | Action |
|---|---|---|
| `cmd+[` / `cmd+]` | tmux window | previous / next |
| `cmd+,` / `cmd+.` | tmux window | move left / right |
| `cmd+j` | tmux window | last-used |
| `shift+cmd+[` / `shift+cmd+]` | kitty tab | previous / next (kitty default) |
| `cmd+shift+,` / `cmd+shift+.` | kitty tab | move left / right |

So the pairing is exact: brackets navigate, comma and period move, and adding
shift lifts the same action from the tmux window to the kitty tab.

The wire format for the tmux motions is still `M-h` / `M-l` / `M-j`, because
those are already bound and already intercepted; changing which kitty chord
sends them costs no application key. Sending `ESC [` or `ESC ]` literally
would be unsafe, since those introduce CSI and OSC sequences.

`w` and `W` both exist on purpose. Each logs to
`~/.local/state/tmux/picker-usage.log`; on 2026-09-12 the counts decide which
one stays.

## Reading the status line

Same vocabulary as the old kitty tab bar, so nothing needs relearning.

| | |
|---|---|
| orange `✳` | claude ready |
| yellow spinner | claude working |
| red `!` | claude wants you |
| green `✎` | nvim |
| blue `›` | shell or anything else |
| grey `▸` | parked |

The glyph follows what is *running* in the window, not what the window is
called. A window named `shell` that you started Claude in shows orange, and
that is correct; a window named `claude` whose Claude has exited shows blue.

**How a Claude window is recognised, and why it is not the process name.**
Depending on the install, tmux reports the pane's command as `claude`,
`claude.exe`, or the bare version string of a re-execed binary such as
`2.1.251`, so any name match misses a whole class of window and it falls
through to the blue shell branch. `bin/session-state.sh` decides it instead
from the marker Claude keeps at the head of the pane title, and publishes
`@claude` per window; the format reads that option and nothing else. Same
one-writer path as `@working` below, so a Claude you just started lights up on
the next status tick rather than instantly.

**How "working" is detected, and why it is not the title.** Claude keeps a
static `✳ <topic>` in the terminal title whether it is idle or busy. Its
internal `busy` state is only published to the terminal tab behind a
server-side feature gate (`tengu_terminal_sidebar`) which is off, and
`showStatusInTerminalTab` is ANDed with that gate, so enabling the setting
does nothing. Verified by sampling a pane through a real run: the title never
changed, byte for byte, from idle to working and back.

So working is derived from output instead. A busy Claude redraws constantly,
so `#{window_activity}` stays within seconds of now; an idle one goes quiet.
The test is pure format arithmetic with no shell callout, since `%s` expands
to the current epoch inside a format:

```
#{?#{e|<:#{e|-:%s,#{window_activity}},3},working,ready}
```

**One writer, fixed cadence.** Every attached client draws the status bar, so
the `#()` callout fires once per client per interval; with six clients that is
six concurrent runs all reading and writing the same streak file. They raced,
and the debounce below depends on that file, so tabs lagged, flickered and
changed colour for no reason. A timestamp guard plus an atomic `mkdir` lock
means exactly one run does the work and the rest return in ~6 ms. Any client
can still drive it, so there is no daemon to supervise.

It is **debounced**, and that is not a detail. "Recent output" alone counts a
single repaint as work: focusing a kitty tab makes tmux forward a focus event,
Claude repaints in response, and the tab flashes yellow for no reason. So
working means output in **two consecutive samples**, which a one-shot repaint
never reaches. The trade is that work shorter than about two ticks (4s) does
not show, which is the right way round for a glance-level indicator.

Typing into a Claude pane is sustained output, so it still reads as working
while you type. That one is inherent to using output as the signal.

If a window's colour looks wrong, `bin/watch-title.sh` samples the title and
the glyph it produces, so you get data instead of a hunch.

The **window you are viewing** carries a subtle background (`#21262d`, one step
off the bar background `#0d1117`) rather than brighter text, which was too easy
to miss among coloured glyphs.

In the **kitty** bar, tabs running tmux carry a thin left rail (`▏`, U+258F)
before their glyph, so the two kinds of tab are told apart at rest:

```
▏⠿ 2 topos              a tmux project
▏✎ short story          a tmux project
 ◐ Toronto apartments   a plain Claude tab
```

It is a character rather than a background tint because a tint cannot work
here: `draw_tab_with_separator` reads `inactive_bg` from `draw_data`, not from
`tab`, and applies it to the separator only, so it colours a sliver at the tab
edge. The mark is drawn by us, in the tab's own state colour, and needs nothing
from kitty's internals. It is `TMUX_MARK` in `taborg/tabbar.py`.

Project name sits at the far left. That is the context that used to live in
your head as tab position.

## Copy mode

Copy mode is tmux's scrollback: it freezes the pane so you can scroll, search
and select text with vi keys. You are in it whenever the pane stops responding
to typing and shows a position counter in the corner. **`q` or Escape leaves
it.** Nothing is modified by entering or leaving; it is a viewer.

`v` starts a selection, `y` copies and exits.

## Is it actually saving?

`cmd+k` `L` shows the event log, or `tail -f ~/.local/state/tmux/events.log`:

```
2026-08-29T18:22:30  saved      sessions=4 windows=8
2026-08-29T19:05:11  restoring  from tmux_resurrect_20260829T190455.txt
```

A `saved` line lands every 5 minutes while a client is attached, and on
`cmd+k` `S`. A `restoring` line lands when a fresh tmux server pulls state
back. If you ever wonder whether the safety net is real, that file is the
answer.

## Adding a project

Nothing to register. Any depth-1 directory under a root in `roots.tsv` shows
up in the picker, as does anything zoxide already knows. Session names are
`<kind>/<basename>`; the kind prefix is what keeps
`textbooks/algebraic-geometry` and `writing/textbooks/algebraic-geometry`
apart.

To add a whole tree, add a line to `roots.tsv`.

Live sessions are listed first, marked `●`. Picking one jumps to it; only
picking a directory can create anything. If that session is already showing in
another kitty tab, the picker focuses **that tab** rather than attaching a
second client, because two clients on one session mirror each other.

**The textbooks trees.** `~/Documents/academic/textbooks` (`$TEXTBOOKS`) is
frozen and must not be edited. `roots.tsv` therefore points `tb/` at
`textbooks - BACKUP`, the working copy. The frozen tree is still reachable
under `tbf/`, so a session name says out loud which one you are in:
`tb/topos-theory` is editable, `tbf/topos-theory` is not.

New projects open with an `nvim` and a `claude` window already running. To
stop that, delete the two `send-keys` lines in `bin/sessionizer.sh`.

## Adding a server

Add a row to `serves.tsv`:

```
session<TAB>name<TAB>cwd<TAB>port<TAB>command
pg/website-nate	dev	~/programming/website-nate/nate-website	4200	npm start
```

Declare the port. It is load-bearing twice over:

- **Before starting**, `cmd+k s` checks nobody else holds it. Most dev servers,
  `serve` and `ng serve` among them, quietly bind a **random** port when theirs
  is taken rather than failing, and you then spend an hour debugging a
  different server than the one you think you are looking at.
- **After starting**, it waits for the port to actually listen. Launching is
  not the same as serving: `npm start` can fail a `prestart` gate and exit
  seconds later. Without this check the popup reports a confident "started"
  for a server that is already dead. On failure it prints the tail of the log,
  so you get the reason rather than a mystery.

If the port is held, `cmd+k s` says which case it is, because they are not the
same problem. A holder whose cwd is the declared project is reported as
**already serving** (nothing to do, it was started outside tmux); anything else
is reported as **SKIPPED** with the offending process and its cwd.

Use `-` if the server genuinely has no fixed port.

**Renaming a project is checked, quietly.** `serves.tsv` is keyed by session
name, so `cmd+k P` detaches a project from its declared servers. The
`session-renamed` hook catches it and says so in the status line:

```
serves.tsv still says 'pg/website-nate' but that project is now
'pg/renamed-test' - update serves.tsv
```

It only speaks when a declared session is missing **and** its directory is
open under another name. A project you simply have not opened yet stays
silent, which is what stops it becoming noise. The rule is derived from live
tmux state plus the registry on every call, so there is nothing cached to go
stale, and one function (`orphan_serves` in `bin/lib.sh`) serves both the hook
and `cmd+k s`.

**Closing the popup does not stop anything.** Servers run in their own
`serve/*` windows; the popup is only a report. Likewise `cmd+k l` opens the
log in `less` (`q` quits, `F` follows), which only reads a file.

Then `cmd+k` `s`. It is idempotent, so pressing it twice starts nothing new.
Output always goes to `~/.local/state/tmux/serve/<session>-<name>.log`, which
outlives both the window and a crash; `cmd+k` `l` follows it.

## What happens when it crashes

State saves every 5 minutes and on demand via `cmd+k` `S`. On the next tmux
start everything is restored automatically: sessions, windows, their names,
cwds, and pane scrollback.

- **nvim** reopens its buffers, because resurrect types `nvs` into the
  restored shell and persistence.nvim keys sessions by directory. Sessions are
  also saved every 2 minutes and on every write, not only on exit, which is
  the gap that lost the buffers on 2026-08-29.
- **claude** resumes with `claude --continue`, which picks up the most recent
  conversation for that window's directory. Conversation history is on disk
  regardless; `csf` searches all of it.
- **servers are deliberately not restarted.** The restored `serve/*` window
  tells you what should be running; `cmd+k` `s` starts it. Not knowing what
  was running was the expensive part, not the restarting.

## Layout

| Path | Role |
|---|---|
| `tmux.conf` | keys, menu, status line, persistence settings |
| `roots.tsv` | which trees become projects, and their kind prefix |
| `serves.tsv` | declared dev servers |
| `bin/sessionizer.sh` | project picker, attach or create |
| `bin/find-window.sh` | window picker, `--project` scopes it |
| `bin/serve.sh` | `start` and `logs` |
| `bin/newwin.sh` | new window for a role |
| `bin/promote.sh` | lift a standalone claude tab into a project |
| `bin/park.sh` | park toggle |
| `bin/lib.sh` | shared helpers, registry parsing, naming |
| `plugins/` | resurrect and continuum, plain git clones |
| `~/.local/state/tmux/` | serve logs, picker usage log |
| `~/.local/share/tmux/resurrect/` | saved state |

## Notes that will save you an hour later

- **No plugin *manager*; the plugins themselves are very much here.**
  resurrect and continuum are the entire persistence engine and are sourced
  directly at the bottom of `tmux.conf`. Only TPM was dropped: the vendored
  copy reads only `/etc/tmux.conf` and `~/.tmux.conf`, never
  `~/.config/tmux/tmux.conf`, so it always found zero plugins, which is why
  resurrect was inert from 2023 to 2026. Update with
  `git -C plugins/<name> pull`.
- **Two kitty tabs attached to the same session are mirrors, not two views.**
  They share a current window, so switching in one switches the other, and a
  bell in that session alerts both tabs. That is tmux working as designed, not
  a bug. If you want two independent views of one project, make a grouped
  session: `tmux new-session -t <name>`.
- **`set-option -t "=name"` silently does nothing.** `set-option`'s `-t` is a
  target-*pane*, and `=name` does not resolve as one: it prints
  `no such session` and returns 1. Nothing checked that return, so `@bootstrap`
  was never set and no session created by `tx` launched its programs. So
  `sessionizer.sh`, `bootstrap.sh` and `promote.sh` all pass a bare `$name` to
  `set-option`. `send-keys` takes a real session target and keeps its `=`.
- **Claude reports as `claude.exe`**, because the binary is compiled and named
  that way. Any format matching on `pane_current_command` must use a prefix
  match, not equality, or every Claude window silently falls through to the
  plain style.
- **A session with no client attached has 80x24 windows**, whatever your
  terminal is. Programs started into one restore and lay themselves out at
  that size, which is where "E36: Not enough room" comes from. This is why
  new sessions launch their programs from the `client-attached` hook rather
  than at creation.
- **Commands are typed into each window's shell**, not run as the pane's
  command. That is how resurrect relaunches things, and it keeps the `nvim`
  zsh wrapper in `~/.config/zsh/functions.zsh` that carries Oil's `gR`
  hand-back. Running nvim as a bare pane command silently breaks it.
- **NoetherVim's `bundles.terminal.tmux` stays off.** `only-tmux.nvim` would
  rename windows out from under the naming here, and `vim-tmux-navigator` is
  inert without panes. See the note at `~/.config/nvim/init.lua:119`.
- **Window names are ours.** `automatic-rename` and `allow-rename` are off, so
  nothing rewrites them.
- The bell needs `"preferredNotifChannel": "terminal_bell"` in
  `~/.claude/settings.json`. Without it Claude never rings, and the red `!`
  never fires no matter how the terminal is configured. `taskCompleteNotifEnabled`
  is the separate switch for "finished" as opposed to "needs you", and Claude
  only treats a task as notification-worthy past `messageIdleNotifThresholdMs`,
  which defaults to 60s. Short tasks are silent by design.
- **Pasting images into Claude does not work inside tmux. Use a plain kitty
  tab (`cmd+t`).** This is the accepted side of a real trade-off, not an
  oversight. Claude requests keyboard mode `Ext 2`, in which tmux re-encodes
  *every* modified key, so `Ctrl+V` arrives as `^[[118;5u` rather than the raw
  `0x16` its paste handler expects. Turning `extended-keys off` restores
  `Ctrl+V` and breaks Shift+Enter instead; there is no setting that gives both,
  and workarounds fail because tmux applies the mode on the way out (a root
  binding sending hex, and literal `send-keys`, were both still re-encoded).
  Shift+Enter is used far more often, so it wins. Outside tmux both work, which
  is why the escape hatch is simply a non-tmux tab.

- **Shift+Enter needs BOTH halves, and they fail independently.**
  - *kitty to tmux*: tmux asks the terminal for extended keys using xterm's
    `modifyOtherKeys`, but kitty deliberately does not implement it ("modifyOtherKeys
    should not be used", kitty's own docs); it uses its own keyboard protocol.
    So the request is ignored and Shift+Enter arrives as a plain CR. Fixed by
    sending the sequence explicitly from kitty:
    `map shift+enter send_text all \x1b[13;2u`. Those are exactly the bytes
    kitty's protocol uses, so it is correct in and out of tmux.
  - *tmux to application*: `extended-keys` must be `on`. tmux's default is
    `off`, where the manual says "only standard keys are reported", so tmux
    would flatten the key back to CR before the application saw it. It must
    not be `always` either: with extended keys enabled Neovim's `TermResponse`
    autocmd stops firing and terminal query replies leak into the buffer as
    literal text (`kitty(0.46.0)` typed into a file, snacks.nvim issue 2332).
    snacks works around that, but its check is a literal `find(" on$")` at
    `snacks/image/terminal.lua:259`, so `always` silently defeats it.

  Diagnose with `cmd+k` `k`, which prints the bytes a key actually produces.
  Shift+Enter should show `^[[13;2u`; a bare newline means the kitty half is
  broken, while `^[[13;2u` that the app ignores means the app is at fault.
  Beware that `tmux send-keys S-Enter` does **not** test this: it injects into
  tmux's key layer and skips kitty entirely, so it passes even when the real
  path is broken.
- **Never append to `terminal-features` or `terminal-overrides`.** `set -ga` /
  `set -as` append on *every* reload, so sourcing the config nine times left
  nine copies of the same RGB entry. Both are set as whole arrays here, tmux's
  own defaults restated, so re-sourcing is idempotent. Verified truecolor
  survives unquantized: `printf '\033[38;2;173;92;217m'` comes back out of
  `capture-pane -e` as `38;2;173;92;217`, not `38;5;N`.
- **`status-keys` is not an editor.** It only picks the line-editing keys for
  tmux's one-line prompt, the one `cmd+k r` opens. tmux infers it from
  `$EDITOR`, saw vi, and in vi mode Escape merely leaves the prompt's insert
  mode instead of cancelling. It is set to `emacs` so Escape cancels. Nothing
  else is affected; copy mode is still vi via `mode-keys`.
- **An empty tmux target is not "no target".** `display-message -p -t ""` does
  not fail or return blank; tmux resolves it to whatever it considers the
  *current* client, roughly the most recently active one. `focus-client.sh`
  used `-t "${TMUX_PANE:-}"` to identify itself and skip that client; run from
  a kitty overlay, where `TMUX_PANE` is unset, that regularly resolved to the
  very session being jumped to, so the one client displaying it was skipped and
  `cmd+shift+k` opened a duplicate tab for a session already on screen. Guard
  on `[ -n "$TMUX_PANE" ]` before using it as a target. Skipping self was wrong
  anyway: if a session is displayed anywhere, focusing that tab is the answer.
- **There can be more than one kitty instance.** skhd binds `alt+f2` to
  `open -n -a kitty`, each with its own `/tmp/mykitty-<pid>` socket, so
  `ls -t | head -1` can query the wrong one. `focus-client.sh` searches all of
  them; the overlay-launched pickers get the right socket from
  `KITTY_LISTEN_ON`, which kitty sets and which survives into tmux panes.
- **The event log records bells too**, with which window rang and which
  windows are flagged. If a bell shows up somewhere surprising, `cmd+k L` has
  the answer.

## Two bars, one source of truth

The kitty tab bar and the tmux status line are not duplicates. They are two
levels of the same hierarchy:

| Bar | Shows | Answers |
|---|---|---|
| kitty tabs | one entry per tmux session | which project wants me |
| tmux status | one entry per window | what in this project wants me |

The kitty tab carries the session's **most urgent** state, attention beating
working beating ready beating nvim beating idle. Same glyphs, same colours as
the window bar, so `!` means the same thing at both levels.

It also carries **how many Claudes are in the project**, from two up:

```
⠿ 2 topos      two Claudes, at least one working
✳ 3 textbooks  three Claudes, all idle
⠿ tmux         one Claude, working
```

A "1" on every tab would be noise, so the count only appears when there is
more than one to distinguish.

Crucially the state is computed **once, in tmux**, and shipped to kitty as a
single leading glyph in the window title. `taborg/tabbar.py` only maps that
glyph to a colour (`TMUX_GLYPHS`); it does not inspect processes or titles to
work anything out for itself. That is why having two bars is not the "two
systems" problem: there is one predicate, in one place, rendered twice.

After editing `tabbar.py`, reload with `cmd+shift+f5`.

## Local patch to tmux-resurrect (do not lose this)

`plugins/tmux-resurrect/scripts/save.sh` carries a one-line local fix that is
not upstream. **`git pull` in that plugin will revert it silently.**

Both readers (`save.sh:192`, `restore.sh:178`) parse records with
`IFS=<tab> read`. A tab is IFS *whitespace*, so two adjacent tabs collapse into
one. A pane with an **empty title** therefore shifts every later field left:
`dir` receives `pane_active`, and that pane comes back in the wrong directory.
Resurrect already guards its other possibly-empty fields with a leading `:`
(`window_flags`, `pane_current_path`); `pane_title` was missing that guard, so
the patch substitutes `-` when the title is empty.

Measured, on a real restore of 6 sessions: 13 of 15 panes correct before the
patch, 16 of 16 after, including a pane whose title was deliberately blanked.

`crash-test.sh before` checks the patch is still present and warns if not.

The plugins are **vendored** in `tmux/plugins/`, not cloned at setup time, so
a fresh `git clone` of the dotfiles works with no bootstrap and no patch to
apply. Provenance, pinned commits and the update procedure are in
`tmux/plugins/VENDORED.md`.

Cloning them was the old arrangement and it is what failed silently for three
years, so the setup step was removed from `install.sh` rather than fixed.

**Why patch locally instead of upstreaming.** This is a known bug with four
open fixes already waiting: #520 (2024-08-30), #564, #581, and #583
(2026-08-01), the last of which describes the identical root cause and
proposes the same `:`-prefix guard. None are merged. `master` has had no
commit since **2023-03-06**, the repo's last push was 2024-08-13, and it
carries 301 open issues and PRs against 13k stars. A fifth PR would change
nothing. A `git pull` here is currently a no-op, since the clone is already at
upstream HEAD, so the patch is safer than it looks; if upstream ever revives
and merges one of those PRs, the conflict is the signal to drop the patch.

**The standing risk this implies:** the crash-recovery layer depends on an
effectively unmaintained plugin. Most of what actually matters is already
recoverable without it, because restore here is cwd-driven: persistence.nvim
keys sessions by directory and Claude resumes by directory. Resurrect only
supplies the session and window skeleton plus scrollback, and
`crash-test.sh` already writes exactly that skeleton to
`~/.local/state/tmux/crash-test-before.txt`. A declarative rebuild from that
manifest plus `roots.tsv` is a viable fallback if resurrect ever breaks.

## Rehearsing a crash

```sh
~/.config/tmux/bin/crash-test.sh before   # forces a save, records a baseline
tmux kill-server
tmux start-server ; sleep 10
~/.config/tmux/bin/crash-test.sh after    # diffs what came back
```

Run it from a kitty tab that is **not** inside tmux, or you kill your own
observer. `after` diffs sessions, windows and cwds against the baseline, so
the result is a comparison rather than an impression.

## Retired

taborg's **keys** are retired, commented out in `kitty.conf`, because tmux owns
tab management. Its **tab bar** is kept: it is the project-level view described
above, and it is now a thin renderer rather than a second brain.

The old 2023 resurrect saves are in `resurrect/_stale-2023/`.
