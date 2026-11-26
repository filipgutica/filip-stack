---
name: home-repo
description: Set up or audit a home repo, the one repo that holds the skills, AGENTS.md, and repo pointers for work that spans several repos, and where agent sessions start.
disable-model-invocation: true
---

# Home repo

A **home repo** is where agent sessions and threads start for a body of work that spans several repos ([pattern](https://www.aihero.dev/the-home-repo-pattern)). It holds the skills, `AGENTS.md`, and path pointers for that body of work. The agent works in each product repo through its pointer. Product repos keep their own `AGENTS.md`, build commands, and code.

**Audit:** for an existing home repo, skip step 1, take its checkout model from its `AGENTS.md`, and apply step 1's checkout-model rule to it. Run step 2's inventory on the home repo and its member repos, report each gap against the layout in step 3, the AGENTS.md contents in step 4, and the checks in steps 5 and 7, and change nothing.

## 1. Decide

Settle these from the request, and ask only about what it leaves open:

- **Name, owner, visibility**, and whether the repo is **team-shared** or **personal**.
- **Member repos.** In T3 Code, a Workbench workspace's repos are the default list.
- **Skills to move.** Move only skills used for this body of work. Generic skills stay where they live, such as a shared skills repo or the user level. A skill that already has a home repo stays there. Each skill has exactly one home.
- **Plugin marketplaces** to register, if any.
- **Checkout model.** The default is one home folder per task with member repos cloned into `workspace/` (step 3). When the user states another design, such as worktrees of each local clone, follow it: leave out step 3's checkout parts and write step 4's member-repo and repo-table lines for that design.

Moving a skill out of a repo that another tool distributes, such as a fleet sync, stops that distribution. Confirm each such move with the user.

Done when every field has a value.

## 2. Inventory (read-only)

- **Each repo:** its local path, remote, default branch, and any `AGENTS.md` or `CLAUDE.md` lines that apply across repos, not just to that repo.
- **Each candidate skill:**
  - where its real folder lives
  - every link that points to it (`~/.claude/skills`, `~/.agents/skills`, a shared skills repo, a sync tool)
  - **personal-data findings:** search for `/Users/`, usernames, personal emails, absolute paths, credential files, password-manager or secure-note lookups, token-file fallbacks, and logs that write response bodies. Report each as `file:line`, with the secret value redacted.

For an audit, report the gaps now and end the run. For setup, show a plan table (`item | action | reason`) and a draft `AGENTS.md`. Done when the user approves both.

## 3. Lay out the repo

```
AGENTS.md
CLAUDE.md               # real file: one line naming AGENTS.md as canonical, then "@AGENTS.md"
README.md               # setup only: clone, trust the folder, install plugins, export credentials
CODEOWNERS              # team-shared only: one named owner per skill
.agents/skills/<name>/                                 # real folders for skills this repo owns (Codex discovery)
.claude/skills/<name> -> ../../.agents/skills/<name>   # real directory, one relative link per skill
.claude/settings.json   # extraKnownMarketplaces + enabledPlugins, when plugins apply
docs/adr/               # cross-repo decisions that last; created with the first ADR
workspace/<repo>/       # gitignored: this task's member-repo checkouts
```

Create a file only when it has content.

**One home folder per task.** Each task runs in its own home folder: a clone or a git worktree of the home repo. Hosts that start each thread in its own worktree, such as T3 Code, give every thread one automatically. Elsewhere, add one per task with `git worktree add --detach ../<home>-<slug> origin/<default-branch>`.

**Member repos are clones in `workspace/`.** Check each member repo out into the home folder's `workspace/<repo>/` with `git clone --reference-if-able ${CODE_ROOT:-$HOME/code}/<repo> <remote> workspace/<repo>`, which borrows objects from the local clone, so it is fast. Clones, not worktrees of the local clone, keep every git write inside the home folder, where sandboxes allow it, and let two tasks branch the same member repo at once. The local clones stay read-only object sources. Give the repo a checkout script with these commands:

- **add:** clone a repo into `workspace/` on a branch, optionally a named set of repos at once.
- **status:** each checkout's branch, uncommitted files, unpushed commits, and stashes.
- **clean:** delete checkouts, refusing any with uncommitted, unpushed, or stashed work.
- **link:** when the design links member skills, link them, as below.

Add a start-work skill that reads the task and runs **add**, and a wrap-up skill that checks PRs, updates the thread's tracking issue when it has one, and runs **clean**. The wrap-up skill reads the issue, including its state, and checks every PR it links. The issue can close when every linked PR is merged and its goal is met. The skill drafts the outcome: for an issue that can close, the follow-ups it will file and the close, or that GitHub already closed it; otherwise, why the issue stays open, and if GitHub closed it early, what remains. It writes to the issue only with the user's request or approval of that draft. An issue that can close gets its follow-ups filed in the repos they concern, the outcome posted with their links, and a close as completed unless GitHub already closed it. Otherwise it gets the outcome, and it is reopened only if the user says so.

Skills load because sessions start in this repo, so the repo needs no install script. When the design links member skills, the **link** command puts each one in front of every host: link each one into both `.agents/skills` and `.claude/skills`. Make it fail, naming the link, when any host path does not resolve to that skill, and treat the setup as incomplete until it succeeds. GitHub issues in this repo hold the plans and artifacts for each body of work. Add a folder for them only when an issue shows it needs one.

Done when the files match the approved plan table.

## 4. Write AGENTS.md

- **Intro:** two or three lines naming the body of work and saying that sessions start here.
- **Tracking:** one GitHub issue per body of work, holding the goal, decisions, open questions, and links. Comments carry updates. An existing ticket tracker stays the record for its tickets. Each PR references its issue in its description. `Part of <owner>/<repo>#<n>` links the PR without closing the issue. `Closes <owner>/<repo>#<n>` is a closing keyword: by default, GitHub closes the issue when the PR merges into the default branch. Use `Closes` only on a PR whose merge finishes the issue: every other linked PR has merged and this merge meets the goal. Until then, use `Part of`.
- **Working in a member repo:** the session stays in the home folder root. Run git as `git -C workspace/<repo> ...` and other commands with `workspace/<repo>` as the working directory. Before changing code, read its `AGENTS.md` or `CLAUDE.md` and any fitting `SKILL.md` by path, because hosts load no instruction files from folders below where the session started. A session restarted inside `workspace/<repo>` loses the home repo's guidance and skills.
- **Repo table grouped by area:** `Repo | Owns | Remote`. Local clones live at `${CODE_ROOT:-$HOME/code}/<repo>`: read them to explore a repo before checking it out, and edit only in `workspace/`. When a clone is missing, ask once where clones live, then clone there.
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

1. Clone the pushed branch into a temporary directory. With the default checkout script, run **add** for one member repo from the clone's root and confirm it lands in `workspace/<repo>` on the requested branch. When the home repo links member-repo skills, check out the members and run the linking command there until it succeeds. Start a fresh session in Claude Code, Codex, and Antigravity, and confirm that every skill, including each linked member-repo skill, loads from the clone's path. A listed name alone can come from an installed copy, so use a clean profile or another check that shows the path. For a team-shared repo, a teammate on a clean profile also runs one skill end to end.
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
- Claude Code's sandbox blocks writes to `.claude/skills`, so create those links outside it.
- Sandboxes can block `git clone` into `workspace/`: it needs the network and copies git's hook templates. Run **add** outside the sandbox when it fails.
- A session started in a product repo does not load the home repo's skills. That is expected.
- Issues carry plans as text. Link larger artifacts, such as a PR, a file in a repo, or a published page, from the issue body or a comment.
