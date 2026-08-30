# Vendored tmux plugins

These are committed to this repo rather than cloned at setup time. Cloning
them was the old arrangement and it failed silently for three years: TPM was
pointed at a path it could not read, found zero plugins, and left resurrect
inert from 2023 until 2026 with nothing reporting an error. A setup step that
must run, and that nobody verifies, is exactly the failure mode this system
exists to prevent.

Vendoring costs 592K and buys a repo that works on `git clone` alone: no
bootstrap, no patch to apply, no step to forget.

## Provenance

| Plugin | Upstream | Pinned commit | Upstream date |
|---|---|---|---|
| tmux-resurrect | https://github.com/tmux-plugins/tmux-resurrect | `cff343cf9e81983d3da0c8562b01616f12e8d548` | 2023-03-06 |
| tmux-continuum | https://github.com/tmux-plugins/tmux-continuum | `0698e8f4b17d6454c71bf5212895ec055c578da0` | 2024-01-20 |

Both are at upstream `master` as of vendoring; neither is behind. This is not
a snapshot of a moving target, it is a copy of a stationary one: resurrect has
had no commit since 2023-03-06 and carries 301 open issues and PRs.

## Local changes

**tmux-resurrect `scripts/save.sh`** is the only file that differs from
upstream, recorded exactly in `../resurrect-empty-pane-title.patch`.

A pane with an empty title corrupts the save file. Both readers parse records
with `IFS=<tab> read`, and a tab is IFS whitespace, so two adjacent tabs
collapse into one; every later field shifts left, `dir` receives
`pane_active`, and that pane is restored in the wrong directory. Measured on a
real restore: 13 of 15 panes correct before the fix, 16 of 16 after.

Upstream has four open PRs for this bug (#520 from 2024-08-30, #564, #581,
#583) and has merged none of them. A fifth would change nothing, which is why
the fix lives here.

## Updating

Upstream is effectively frozen, so this should be rare. To check or update:

```sh
git clone https://github.com/tmux-plugins/tmux-resurrect /tmp/tr
diff -ru --exclude=.git /tmp/tr tmux-resurrect     # should show only save.sh
```

If upstream ever revives and merges the empty-pane-title fix, drop
`../resurrect-empty-pane-title.patch` and re-vendor clean.
