# dotfiles

My machine, reproducible from scratch. This is everything in `~/.config`: shell, kitty, tmux, Neovim, yabai, LaTeX templates, and the scripts that put a new Mac back together. It's macOS-only; yabai and the Brewfiles wouldn't survive a move to Linux.

If you came here from [NoetherVim](https://github.com/Chiarandini/NoetherVim), `nvim/` is my personal config on top of the distro.

## What's in here

- `.zshrc`, `zsh/`: zsh with the starship prompt, atuin for history, zoxide standing in for `cd`, and direnv.
- `kitty/`: my terminal. The tab bar shows at a glance which tabs are nvim and which are a Claude that's thinking or waiting on me ([kitty/taborg](kitty/taborg/README.md)).
- `tmux/`: one session per project, and it survives a crash. The plugins are vendored, not fetched. The whole system is written up in [tmux/README.md](tmux/README.md).
- `nvim/`: my Neovim config. `noethervim/` is a thin wrapper (`nvdn`) that loads the distro from my local checkout instead of GitHub, so I can test changes before pushing them. `nvdemo/` is the config I record NoetherVim's demo GIFs with.
- `yabai/`, `skhd/`: tiling and global hotkeys, including [the lights](#lights-from-the-keyboard).
- `scripts/`: small commands that live in `~/.local/bin`. `tb` finds a definition or theorem in my textbooks, `lib` opens a book from the library, `pdf` opens a PDF in the current directory, `airdrop` opens the AirDrop picker with files already loaded, and the yabai ones are [below](#yabai).
- `dirmarks`: named directories, shared by `c` in the shell and `:C` in nvim.
- `paths.env`: where the movable folders live (`$TEXTBOOKS`, `$PAPERS`, …), so moving one is a one-line edit.
- `launchd/`: LaunchAgents. Right now that's just the yabai watchdog.
- `claude/`: Claude Code settings, symlinked into `~/.claude`.
- `Brewfile*`, `.mise.toml`: everything that gets installed ([below](#keeping-it-current)).

Plus smaller configs for ranger, yazi, zellij, btop, htop, zathura, mpv, git, gh, and Inkscape figures.

## Setting up a new Mac

### Before wiping the old one

Some things aren't in this repo or on Google Drive, so they get moved by hand:

- `~/.ssh`. This one comes first, since cloning needs it (step 1 below).
- GPG keys:
  ```bash
  # old Mac
  gpg --export-secret-keys --armor > ~/gpg-secret-keys.asc
  gpg --export-ownertrust > ~/gpg-ownertrust.txt
  # new Mac, after AirDropping both
  gpg --import ~/gpg-secret-keys.asc
  gpg --import-ownertrust ~/gpg-ownertrust.txt
  ```
- `~/.netrc`. It has credentials in it, so never commit it.
- `~/.claude.json` and `~/.claude/`. `settings.json` comes from this repo, but the login, memory and history don't.
- Anki: sync to AnkiWeb on the old Mac, then log in and sync on the new one.
- Zotero: sync the library, and copy any PDF attachments that aren't in Zotero's cloud to Google Drive first.
- Brave: signing in brings back bookmarks, passwords and extensions.
- The Obsidian vault (`~/Documents/vault`): make sure it's fully synced.

### Steps

1. Copy the SSH keys. On the old Mac, show hidden files in Finder (`Cmd+Shift+.`), compress `.ssh` and AirDrop the zip over. On the new one, unzip it into `~` and tighten the permissions, or ssh refuses to use the keys:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/id_*
   ssh-add --apple-use-keychain ~/.ssh/id_ed25519
   ```
2. Install the Xcode command line tools (that's where `git` comes from), then clone:
   ```bash
   xcode-select --install
   git clone git@github.com:Chiarandini/dotfiles.git ~/.config
   ```
3. Run the installer:
   ```bash
   ~/.config/install.sh            # desktop
   ~/.config/install.sh --full     # desktop, plus Brewfile.games
   ~/.config/install-headless.sh   # headless box (air): no GUI apps, no yabai
   ```
   It asks for the admin password up front. Then it links the home-dir dotfiles, installs the Brewfile, languages through mise, Rust through rustup, Neovim through bob, and the LaunchAgents, and starts yabai and skhd. At the end it runs `install-verify.sh`, which checks that all of that actually worked.

   Two things to know. `Brewfile.personal` (alt-tab, Neovide, sioyek, …) isn't part of either installer, so run `brew bundle --file ~/.config/Brewfile.personal` separately. And `install.sh` runs `brew bundle --cleanup`, which uninstalls anything that isn't in `Brewfile`. That's right on a fresh Mac, but not on one that's already set up.
4. Give yabai and skhd Accessibility access: System Settings → Privacy & Security → Accessibility.
5. Space switching (`cmd+1`, `cmd+2`, …) goes through yabai's scripting addition, which only loads with SIP partly disabled. The steps (Recovery Mode, `csrutil`, and an `nvram` boot-arg on Apple Silicon) are in [yabai's wiki](https://github.com/koekeishiya/yabai/wiki/Disabling-System-Integrity-Protection).
6. Log into Google Drive, set up the "Computers" sync, and restart.

## Keeping it current

### A new app or CLI tool

Add a line to the right Brewfile by hand: `Brewfile` for the core, `Brewfile.personal` for GUI extras, `Brewfile.games`, and `Brewfile.headless` too if air needs it. Don't use `brew bundle dump --force`, which would dump everything installed into `Brewfile`, flattening the split and losing the comments.

### A language or version

Edit `.mise.toml` and run `mise install`. Rust is the exception: rustup owns it, and `.mise.toml` says why.

### Python

Nothing is installed globally. Each project gets its own environment, and command-line tools go through pipx:

```bash
uv venv && uv pip install numpy matplotlib   # inside a project
pipx install yt-dlp                          # a tool I want everywhere
```

### Anything a machine needs to have

Add a check to `install-verify.sh`, not just a step to `install.sh`. Every failure here that cost real time was silent. TPM was reading a path it couldn't see, so tmux-resurrect did nothing for three years, and Claude's notification channel defaulted to one that never rang. An installer that only runs commands can't catch either of those. [BOOTSTRAP.md](BOOTSTRAP.md) has the rule and what it checks.

## yabai

`.yabairc` runs `sudo yabai --load-sa`, which needs a sudoers entry pinned to the hash of the yabai binary. `fix-yabai-sa` writes that entry, loads the scripting addition and restarts yabai. `install.sh` runs it once, and the `brew` wrapper in `.zshrc` runs it again whenever yabai is upgraded or reinstalled, since that changes the hash. If it breaks anyway, run `fix-yabai-sa` by hand.

When yabai stops responding (space switches do nothing, `yabai -m` hangs), it's usually because launchd started a second daemon before the first one exited, and the two wedge the socket. `fix-yabai` kills both and brings back exactly one. The `yabai-watchdog` LaunchAgent checks every 15 seconds and runs `fix-yabai` on its own.

For anything milder:

```bash
yabai --restart-service
skhd --restart-service
```

## Lights from the keyboard

The HomeKit bulbs are on global hotkeys, through three layers:

```
skhd chord  →  Apple Shortcut  →  Home accessory / Home scene
```

- Home.app scenes hold anything involving more than one light ("all off", "reading"). They get edited in Home.
- Shortcuts.app has a thin named wrapper for each: a single toggle for a light, or "run scene" for a scene.
- skhd binds a chord to `shortcuts run "<name>"`.

| Chord | Action                                       |
|-------|----------------------------------------------|
| `⌘⌃C` | Toggle ceiling lights                        |
| `⌘⌃B` | Toggle bed lamp                              |
| `⌘⌃D` | Toggle desk lamp                             |
| `⌘⌃A` | All on                                       |
| `⌘⌃O` | All off                                      |
| `⌘⌃S` | Beatsaber scene (max bright white, for VR)   |
| `⌘⌃R` | Reading scene (bed lamp only, warm and low)  |

The Shortcut names (`Toggle Ceiling Lights`, `Scene Reading`, …) have to match the strings in `skhd/skhdrc` exactly, spaces and capitals included. The first time each one runs, macOS asks for Automation access to Home; after that it's silent.

To add a light, make a Shortcut with one "Control Home" action set to **Toggle** that light, name it `Toggle <Thing>`, and add a line to `skhd/skhdrc`:

```
cmd + ctrl - <letter> : shortcuts run "Toggle <Thing>"
```

A new scene works the same way, except the scene gets built in Home.app first (`+` → Add Scene), the Shortcut's action is **Run Scene**, and its name is `Scene <Mood>`. Either way, reload skhd with `pkill -USR1 skhd`.

Why not an skhd mode? The first version used a `homekit` mode (a prefix chord, then one letter). Don't go back to it. The skhd that Homebrew ships here (v0.3.9) doesn't reliably run the `; default` transition after a shell command, so the mode got stuck and every bound letter quietly ate my typing ("not working" came out as "n wking"). `⌘⌃` + letter is mostly free in this skhdrc, so direct binds are simpler and safe.

## The LaTeX preambles

The preambles in `nvim/preamble/` and the snippets in `nvim/LuaSnip/tex/` use `\documentauthor` rather than my name. If you borrow them, set yours at the top of the document:

```latex
\renewcommand{\documentauthor}{Your Name}
```

Or put that line in `nvim/preamble/personal-info.tex` (it's gitignored) and `\input` it.
