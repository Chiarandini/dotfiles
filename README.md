# 💻 macOS Dotfiles & Automated Setup

This repository contains my personal macOS configuration, dotfiles, and an automated bootstrap script designed to turn a fresh, out-of-the-box Mac into a fully configured developer environment in minutes.

> **Platform:** macOS (Apple Silicon preferred). The Homebrew bundle, yabai/skhd window management, and `sudo yabai --load-sa` flow are all macOS-specific; adapting this setup for Linux would require substantial rework.

## The Philosophy
The goal of this setup is to be **100% reproducible and declarative**.
*   **System Apps & Tools:** Managed by Homebrew (`Brewfile`).
*   **Language Runtimes:** Managed by `mise` (Node, Python, Ruby, etc.). No languages are installed via brew.
*   **Global Packages:** Strictly limited. Python CLI tools use `pipx`, and Python libraries are strictly isolated to project virtual environments using `uv`.
*   **Window Management:** Tiling environment managed by Yabai and skhd.

---

## What's Configured

- **Shell:** Zsh with a modular setup (`.zshrc`, `zsh/aliases.zsh`) and the Starship prompt.
- **Terminal emulators:** Kitty (primary) and iTerm2.
- **Editor:** Neovim — personal distribution lives at `nvim/` (also exposed as `noethervim/` via `NVIM_APPNAME` for local testing of the [NoetherVim](https://github.com/Chiarandini/NoetherVim) distro).
- **Terminal multiplexer:** tmux (plugins managed by TPM on first launch; not committed).
- **Window management:** yabai + skhd tiling WM.
- **Runtimes:** mise for Node / Python / Ruby; `pipx` + `uv` for Python tooling.
- **File manager:** ranger.
- **Git:** `.gitconfig`, plus a custom `gh` CLI setup.
- **LaTeX:** preamble templates + LuaSnip snippets for books, articles, homework, blog posts, and Beamer slides (see "Customizing author name" below).
- **Productivity:** Raycast, atuin shell history, direnv, zoxide, thefuck.
- **Other niceties:** btop, neofetch, htop, mc, zathura, skhd, Inkscape figures / shortcut manager.

## Customizing Author Name (LaTeX)

The LaTeX preambles under `nvim/preamble/` and the LuaSnip snippets in `nvim/LuaSnip/tex/` use `\documentauthor` instead of a hardcoded name. To set your own name, put this line at the top of any document that `\input`s the preambles:

```latex
\renewcommand{\documentauthor}{Your Name}
```

If you prefer a central override, create `nvim/preamble/personal-info.tex` (already gitignored) containing the `\renewcommand` and `\input` it from your documents.

---

## Installation Guide (Fresh Mac Setup)

Follow these steps in exact order when setting up a new machine (e.g., migrating to the M5).

### Phase 1: The Secure Transfer (SSH Keys)
Before we can download this repository, the new Mac needs your developer identity to authenticate with GitHub. Do not use Google Drive for this.

**On the OLD Mac:**
1. Open Finder -> Go to Home (`Cmd + Shift + H`).
2. Press `Cmd + Shift + .` to show hidden files.
3. Right-click the `.ssh` folder and select **Compress ".ssh"**.
4. AirDrop the resulting `Archive.zip` to the NEW Mac.

**On the NEW Mac:**
1. Double-click the `Archive.zip` in your Downloads folder to extract `.ssh`.
2. Drag the `.ssh` folder into your Home directory (`~`).
3. Open Terminal and lock down the permissions (crucial, or Git will reject them):
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/id_*
   ssh-add --apple-use-keychain ~/.ssh/id_ed25519  # Or id_rsa
   ```

### Phase 2: The Initial Pull
Now we can install Git and pull down this repository.

1. Trigger the installation of Apple's Xcode Command Line Tools (this provides `git`):
   ```bash
   xcode-select --install
   ```
2. Wait for the native Apple GUI installation to finish.
3. Clone this repository to your local machine:
   ```bash
   git clone git@github.com:Chiarandini/dotfiles.git ~/.config
   ```

### Phase 3: The Automated Bootstrap
Now we hand the process over to the script.

1. Navigate into the cloned directory:
   ```bash
   cd ~/.config
   ```
2. Make the installation script executable:
   ```bash
   chmod +x install.sh
   ```
3. Run the script. You have two choices:

   **Standard Developer Install (Lean)**
   ```bash
   ./install.sh
   ```

   **Full Install (Includes Games from Brewfile.games)**
   ```bash
   ./install.sh --full
   ```
   *The script will ask for your administrator password upfront.  Downloading the apps will take some time.*

### Phase 3.5: Manual Data Migration (Before Running the Script)
Before or after running the script, manually transfer these items that are **not** backed up by Google Drive or this repo:

1. **SSH Keys** — See Phase 1 above (AirDrop `.ssh`).
2. **GPG Keys** — If you use GPG for signing or encryption:
   ```bash
   # On OLD Mac:
   gpg --export-secret-keys --armor > ~/gpg-secret-keys.asc
   gpg --export-ownertrust > ~/gpg-ownertrust.txt
   # AirDrop both files to new Mac, then on NEW Mac:
   gpg --import ~/gpg-secret-keys.asc
   gpg --import-ownertrust ~/gpg-ownertrust.txt
   ```
3. **`~/.netrc`** — Contains credentials (e.g., Heroku tokens). AirDrop or copy securely. Never commit this file.
4. **Claude Code settings** — AirDrop `~/.claude.json` and the `~/.claude/` directory to restore your API key and preferences.
5. **Obsidian vaults** — If your vault is stored locally (not in iCloud/Google Drive), copy it over manually.
6. **Anki** — Open Anki and sync to AnkiWeb before switching. Log in on the new machine and sync again.
7. **Zotero** — Sync your library via your Zotero account. If you have local PDF attachments not synced to Zotero's cloud, back them up to Google Drive.
8. **Brave Browser** — Sign into your Brave account to sync bookmarks, passwords, and extensions automatically.

### Phase 4: Post-Installation & Syncing
Once the terminal script says "Bootstrap complete!", perform these final manual steps:

1. **Accessibility Permissions:** Yabai and skhd require deep system access. Go to `System Settings` -> `Privacy & Security` -> `Accessibility` and toggle the switches ON for **yabai** and **skhd**.
2. **Google Drive Sync:** Open the newly installed Google Drive app, log in, and configure "Computers" sync to pull down your heavy media (Documents, Music, etc.).
3. **Restart:** Restart your Mac to ensure all background services, path variables, and kernel extensions load correctly.

---

## Maintenance

**Adding new apps:**
If you install a new app or CLI tool via Homebrew and want to save it to this repository permanently, run:
```bash
cd ~/.config && brew bundle dump --force
```

**Adding new languages:**
If you need a new programming language or want to update a global version, simply edit the `.mise.toml` file and run:
```bash
mise install
```

---

## Python Development Cheat Sheet

> **Note:** To keep the system fast and stable, Python libraries are **not** installed globally on this machine. Below are the common stacks I use, along with the commands to install them inside project-specific virtual environments.

### The Workflow (Starting a new project)
Whenever starting a new Python script or project, initialize an isolated bubble using `uv`:
```bash
mkdir my-new-project
cd my-new-project
uv venv             # Creates the virtual environment
```

### Common Library Stacks (Copy & Paste to install)

**Web Scraping & Automation**
If building a bot, scraper, or making API calls:
```bash
uv pip install selenium requests python-dotenv
```
*(Note: Installing selenium automatically pulls in webdriver-manager, urllib3, trio, etc.)*

**Data Science & Plotting**
If doing math, handling arrays, or drawing graphs:
```bash
uv pip install numpy matplotlib
```
*(Note: Installing matplotlib automatically pulls in pillow, contourpy, kiwisolver, etc.)*

**Global CLI Tools**
If you need a standalone Python tool available everywhere in the terminal, use `pipx` (do not use pip):
```bash
pipx install yt-dlp
```

## 🪟 Yabai & skhd Setup (Manual Post-Install)

Because Yabai deeply modifies macOS window management, there are a few manual security configurations required on a fresh installation.

### 1. Grant Accessibility Permissions
Before starting the services, macOS must trust the applications.
1. Open `System Settings` -> `Privacy & Security` -> `Accessibility`.
2. Turn on the toggles for both **yabai** and **skhd**.

### 2. Configure the Scripting Addition (sudoers hash)
Your `.yabairc` contains the command `sudo yabai --load-sa`. For this to run without a password prompt, a sudoers entry with the SHA-256 hash of the yabai binary is needed. This is handled automatically:

- **`install.sh`** runs `fix-yabai-sa` during bootstrap to set it up on a fresh machine.
- **The `brew` wrapper in `.zshrc`** detects `brew upgrade`/`brew reinstall` of yabai and re-runs `fix-yabai-sa` to update the hash.
- **If it ever breaks manually**, just run:
  ```bash
  fix-yabai-sa
  ```
  The script (located at `scripts/fix-yabai-sa` in this repo, symlinked to `~/.local/bin/`) computes the current binary hash, updates `/private/etc/sudoers.d/yabai`, loads the SA, and restarts yabai.

### 3. Apple Silicon (M-Series) Note
If you want to use Yabai's most advanced features (like instantly focusing spaces or animating windows), macOS requires you to partially disable System Integrity Protection (SIP).
1. Turn off your Mac.
2. Hold the power button until you see "Loading startup options" to enter Recovery Mode.
3. Open Terminal from the Utilities menu.
4. Run `csrutil disable` (or `csrutil enable --without nvram --without fs --without debug --without dtrace`).
5. Reboot.

### 4. Restart Services
If your window management ever freezes or stops responding, you can manually restart the background services using Homebrew:
```bash
yabai --restart-service
skhd --restart-service
```
```
