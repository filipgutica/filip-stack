# Pillar 4: Documentation

Source keys refer to the Sources list in [SKILL.md](../SKILL.md).

**Why.** Instruction files load into every session, so every line takes a
little attention on every task, relevant or not [A1]. Aim for the smallest set
of high-signal tokens and load the rest just in time [A2; corroborated by A1 and O3]. Running out of
context is no longer the main concern [A1]; diluted attention is.
OpenAI reports a short `AGENTS.md` that works as a map to a structured `docs/`
directory, with freshness and cross-links checked mechanically [O1]; the mechanical freshness checks are unconfirmed for current models. Codex limits
instruction files to 32 KiB by default (`project_doc_max_bytes`) and merges
nested files so the nearest one wins [O2, S1]. Its documentation disagrees on
whether the limit applies per file or to the combined chain, so measure both
and confirm what actually loaded before you report truncation. Current Codex guidance says to keep `AGENTS.md` short, add a rule after a mistake repeats, and move task-specific detail into separate files [O3].

**The two-question test** [A1], for every line:

1. Could the agent find this by reading the code?
2. Would it actually go and look?

If both answers are yes, delete the line. Two exceptions: keep the verification
commands (test, typecheck, lint, run), which Anthropic lists as the most useful
lines even though `package.json` holds them [A1]; and judge global behavior
rules, which no repository can show, with the decay test in [pillar 8](pillar-8-guidance-evaluated.md) instead.

**Resolving the tension.** Anthropic lists "describe your architecture and file
layout" as outdated advice [A1]. Current Codex guidance lists repository layout
among the things `AGENTS.md` can hold [O3], and OpenAI kept design documents in
`docs/` [O1]. This skill sides with Anthropic on layout, because layout is the
easiest thing for an agent to discover and the quickest to go stale. A short
pointer to an unusual layout passes the two-question test; a tour does not.
The positions agree once you separate two axes:

| | Always loaded (`AGENTS.md`) | Loaded on demand (`docs/`, skills) |
| --- | --- | --- |
| Decisions and reasons | Short pointer | Architecture decision records, design docs |
| Layout and structure | Leave out | Leave out; the code is the source |
| Procedures | The command only | Skills and how-to guides |

**Good looks like.**

- The always-loaded file holds the commands (install, single test, typecheck, lint, run the app), misleading places in the code, decisions that are not in the code, and anything corrected twice [A1].
- Repeated procedures live in skills, which load only when a task needs them [A1].
- Decision records explain *why*. A glossary maps domain terms to code names where they differ.
- CI runs the documented commands and checks the links.
- No dated advice in the body: superseded guidance moves to an "old patterns" section or is deleted [A4]. Version requirements that are still true, such as a minimum runtime or a migration order, stay.

**Audit check.**

- Measure the always-loaded footprint as each host loads it (see the Engineering guidance mode in [SKILL.md](../SKILL.md)).
- Apply the two-question test to every always-loaded line.
- Find lines that restate the directory layout, `package.json`, or config.
- Run every documented command.

**Anti-patterns.** Architecture tours. Emphasis in place of enforcement. The
same instruction in the README and `AGENTS.md`. Commands that no longer run.
