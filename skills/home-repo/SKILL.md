---
name: home-repo
description: Set up or audit a home repo, the one repo that holds the skills, AGENTS.md, and repo pointers for work that spans several repos, and where agent sessions start.
disable-model-invocation: true
---

# Home repo

A **home repo** is where agent sessions and threads start for a body of work that spans several repos ([pattern](https://www.aihero.dev/the-home-repo-pattern)). It holds the skills, `AGENTS.md`, and path pointers for that body of work. The agent works in each product repo through its pointer. Product repos keep their own `AGENTS.md`, build commands, and code.

**Audit:** for an existing home repo, skip step 1. Run step 2's inventory on the home repo and its member repos, report each gap against the layout in step 3, the AGENTS.md contents in step 4, and the checks in steps 5 and 7, and change nothing.

## 1. Decide

Settle these from the request, and ask only about what it leaves open:

- **Name, owner, visibility**, and whether the repo is **team-shared** or **personal**.
- **Member repos.** In T3 Code, a Workbench workspace's repos are the default list.
- **Skills to move.** Move only skills used for this body of work. Generic skills stay where they live, such as a shared skills repo or the user level. A skill that already has a home repo stays there. Each skill has exactly one home.
- **Plugin marketplaces** to register, if any.

Moving a skill out of a repo that another tool distributes, such as a fleet sync, stops that distribution. Confirm each such move with the user.

Done when every field has a value.

## 2. Inventory (read-only)

- **Each repo:** its local path, remote, default branch, and any `AGENTS.md` or `CLAUDE.md` lines that apply across repos, not just to that repo.
- **Each candidate skill:**
  - where its real folder lives
  - every link that points to it (`~/.claude/skills`, `~/.agents/skills`, a shared skills repo, a sync tool)
  - **personal-data findings:** search for `/Users/`, usernames, personal emails, absolute paths, credential files, password-manager or secure-note lookups, token-file fallbacks, and logs that write response bodies. Report each as `file:line`, with the secret value redacted.

Show a plan table (`item | action | reason`) and a draft `AGENTS.md`. Done when the user approves both.

## 3. Lay out the repo

```
AGENTS.md
CLAUDE.md               # real file: one line naming AGENTS.md as canonical, then "@AGENTS.md"
README.md               # setup only: clone, trust the folder, install plugins, export credentials
CODEOWNERS              # team-shared only: one named owner per skill
.agents/skills/<name>/                                 # real skill folders (Codex discovery)
.claude/skills/<name> -> ../../.agents/skills/<name>   # real directory, one relative link per skill
.claude/settings.json   # extraKnownMarketplaces + enabledPlugins, when plugins apply
docs/adr/               # cross-repo decisions that last; created with the first ADR
```

Create a file only when it has content.

Skills load because sessions start in this repo, so the repo needs no install script. GitHub issues in this repo hold the plans and artifacts for each body of work. Add a folder for them only when an issue shows it needs one.

Done when the files match the approved plan table.

## 4. Write AGENTS.md

- **Intro:** two or three lines naming the body of work and saying that sessions start here.
- **Tracking:** one GitHub issue per body of work, holding the goal, decisions, open questions, and links. Comments carry updates. An existing ticket tracker stays the record for its tickets.
- **Before changing code:** switch into the target repo or a worktree of it, and read its `AGENTS.md` or `CLAUDE.md`.
- **Repo table grouped by area:** `Repo | Owns | Path | Remote`. Paths are `${CODE_ROOT:-$HOME/code}/<repo>`. When a path is missing, ask once, then clone there.
- **Skills:** one line per skill naming its trigger.

Product-specific rules stay in the product repo.

Done when every member repo has a table row and every skill in the home repo has a line.

## 5. Move skills

For each skill:

1. Copy the folder whole. Skip caches, `__pycache__`, `node_modules`, and `.DS_Store`.
2. Clean it:
   - Replace personal paths with `${CODE_ROOT:-$HOME/code}`.
   - Replace personal identities with role-based examples.
   - Credentials come only from an exported env var, checked with `test -n "${VAR:-}"` in the process that uses it. When the var is missing, stop and ask the user to export it or to provide it through a secure prompt.
   - Logs keep the method, route template, and status code.
3. Run the personal-data search from step 2 on the home repo again.
4. Add the `.claude/skills` link.

Done when the search finds nothing and every link resolves (`test -e`).

## 6. Publish

- Creating the remote repo is outward-facing: confirm the name, owner, and visibility with the user first.
- For a new repo, seed the default branch with a README commit, so the first PR has a base.
- Commit the layout on a branch and open a PR.
- Open the first issue for an in-flight body of work, as a pilot.

Done when the user has the PR and issue links.

## 7. Verify, then retire the old copies

1. Clone the pushed branch into a temporary directory, start a session there, and confirm that every skill loads from the clone's path in Claude Code and in Codex. A listed name alone can come from an installed copy, so use a clean profile or another check that shows the path. For a team-shared repo, a teammate on a clean profile also runs one skill end to end.
2. Retire each old copy only when every person and machine that still needs the skill can load it from the merged home repo. For a private repo, that includes repo access and a clone on each machine.
   - Back it up outside every discovery root.
   - Remove its user-level links and its old source folder. When the old source lives in another repo, remove it there through that repo's own PR.
   - When a sync tool or a skills lock ships the old copy, remove it from that tool's policy and lock entries on every machine before its source goes away.
   - Fix any link that points into a temporary worktree.

Done when each moved skill has exactly one copy that a discovery root reaches.

## Gotchas

- Claude Code documents per-skill symlinks. A symlinked `.claude/skills` directory is not documented.
- `enabledPlugins` does not install anything. Each person trusts the folder, runs `claude plugin install <plugin>@<marketplace> --scope project`, restarts, and checks `/plugin`.
- Codex finds repo skills in `.agents/skills`, looking from the working directory up to the repo root.
- A session started in a product repo does not load the home repo's skills. That is expected.
- Issues carry plans as text. Link larger artifacts, such as a PR, a file in a repo, or a published page, from the issue body or a comment.
