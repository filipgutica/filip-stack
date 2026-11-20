---
related: [fleet-sync, cli-tool-template]
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

## When to use it

Install the skill, then run `/home-repo` in Claude or `$home-repo` in Codex when
you want one repo where sessions and threads start across several repos. It runs
only when you call it.

> /home-repo set up a home repo for the repos in this workspace

## How it works

The skill settles the repo name, owner, visibility, whether it is personal or
team-shared, the member repos (defaulting to a Workbench workspace's repos in T3
Code), and which skills move in. Generic skills stay where they live. Moving a
skill out of a repo that another tool such as `fleet-sync` distributes stops
that distribution, so the skill asks first.

It runs a read-only inventory of each repo and candidate skill, searching for
personal data such as absolute home paths, emails, and credential lookups. It
shows a plan table and a draft `AGENTS.md` and waits for your approval before
writing anything. It moves the skills, cleans personal data out of them, checks
that each skill loads from a fresh clone in Claude Code and Codex, and retires
the old copies so each skill has exactly one home. It confirms the repo name,
owner, and visibility with you before creating the GitHub repo.

[SKILL.md](https://github.com/filipgutica/filip-stack/blob/main/skills/home-repo/SKILL.md)
has the layout and the exact steps.

## What you get

- `AGENTS.md` with an intro, the tracking rule, a repo table grouped by area (`Repo | Owns | Path | Remote`), and one line per skill.
- A thin `CLAUDE.md` that imports `AGENTS.md`.
- A setup-only `README`.
- Skills under `.agents/skills` with one `.claude/skills` link each.
- Optional `.claude/settings.json` for plugin marketplaces.
- `CODEOWNERS` only for team-shared repos.
- A first GitHub issue for an in-flight body of work.
