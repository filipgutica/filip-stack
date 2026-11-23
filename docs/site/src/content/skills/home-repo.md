---
related: [fleet-sync]
---

## What it does

Following [the home repo pattern](https://www.aihero.dev/the-home-repo-pattern),
a home repo holds the skills, `AGENTS.md`, and path pointers for one body of
work. Product repos keep their own `AGENTS.md`, build commands, and code. The
agent works in each product repo through its pointer.

GitHub issues in the home repo hold the plan for each body of work. `docs/adr/`
holds only lasting cross-repo decisions. Skills load because sessions start in
the repo, with no install script. A session started in a product repo does not
load the home repo's skills.

By default, each task gets its own home folder, a clone or worktree of the home
repo, and hosts that open a worktree per thread create that folder for you.
Member repos are cloned into that folder's `workspace/`, and the session stays
in the home folder root while it works in them.

## When to use it

Install the skill, then run `/home-repo` in Claude or `$home-repo` in Codex. It
runs only when you call it.

> /home-repo set up a home repo for the repos in this workspace

> /home-repo audit this home repo

## How it works

The agent asks before anything leaves a shared repo, and before it writes or
publishes. An audit reports gaps and changes nothing.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/home-repo/SKILL.md)
has the layout and the exact steps.

## What you get

- `AGENTS.md` with an intro, the tracking rule, a repo table grouped by area (`Repo | Owns | Remote`), and one line per skill.
- A thin `CLAUDE.md` that imports `AGENTS.md`.
- A setup-only `README`.
- Skills under `.agents/skills` with one `.claude/skills` link each.
- A checkout script that adds, reports, cleans, and links member repos in `workspace/`, plus start-work and wrap-up skills that run it.
- When the home repo links member repos' skills, a link for each in both skill folders and a check that Claude, Codex, and Antigravity each list them.
- Optional `.claude/settings.json` for plugin marketplaces.
- `CODEOWNERS` only for team-shared repos.
- A first GitHub issue for an in-flight body of work.
