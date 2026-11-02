# Pillar 6: Reproducible environment

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** This is the most durable pillar. Better models read code better, so
documentation shrinks. No model can observe the runtime behavior of an app it
cannot start, or inspect states that the data does not contain.

- Anthropic lists a browser screenshot next to the mockup as a check [A1]. The `/verify` skill confirms a change against the running app without falling back to tests or type checks. `/run-skill-generator` records the working launch recipe as a project skill so later agents follow it instead of rediscovering it [A5].
- Long-running agents work better with an `init.sh` that starts the app, a check at the start of each session that the app still works, and end-to-end testing as a human user would do it [A3; the launch recipe is corroborated by A5].
- OpenAI reports an app that boots per git worktree as an isolated instance with its own logs and metrics, torn down after the task, plus browser DevTools access for DOM snapshots and screenshots [O1] (unconfirmed for current models).
- Installing dependencies by trial and error is slow and unreliable, and it can fail outright for private packages [G1]. A failed Copilot setup step does not stop the agent; it continues with a partial environment [G1]. A health check after setup is therefore required.
- A worktree is a fresh checkout without gitignored files or installed dependencies [A1].
- Codex guidance traces many quality problems to setup: the wrong working directory, missing write access, wrong model defaults, or missing tools [O3].

**Good looks like.**

- One command takes a clean checkout to a running, seeded app, inside the agent's own sandbox as well as on a workstation. It works per worktree and per PR, with isolated ports, databases, and profiles.
- Cold setup (from nothing, with only declared prerequisites) and warm setup (dependencies and profile already present) are both scripted.
- For a repository that ships guidance rather than an app, the environment is a throwaway host home where the guidance applies, plus an evaluation harness that runs agents against it.
- Setup ends with a health check that fails loudly.
- Synthetic data:
  - A deterministic seed, versioned with the schema, so a migration updates the seed.
  - Covers the states that matter: empty, error, large, each permission level, each locale in use.
  - Contains no production personal data.
- The agent can observe the app: browser automation, logs, metrics, and traces through a command line.
- One teardown command, plus automatic cleanup of abandoned environments.
- A preview environment per PR for human reviewers.
- Parity with production: the same images, configuration shape, and feature flags.
- The recipe lives in a script or a project skill, not in a README paragraph.

**Audit check.**

- Time a fresh worktree to a seeded, healthy, running app with one command, inside the agent's sandbox. Record cold and warm setup separately, and every manual step.
- Start two worktrees at once, each with its own profile. Check for port, database, socket, and cache collisions. A lock that refuses a second run on a shared profile is safe but is not isolation.
- Break one setup step on purpose. Setup must fail loudly.
- Make a request through the app, then retrieve its logs with a command.
- Check that the seed exercises the states the latest feature added.
- Run teardown and confirm nothing is left behind.

**Anti-patterns.** Setup steps in a README that no script runs. A shared
development database. Seed data that lags the schema. Previews that need manual
clicks. Environment variables that live in one person's shell.
