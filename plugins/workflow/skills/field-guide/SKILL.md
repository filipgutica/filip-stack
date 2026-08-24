---
name: field-guide
description: "Consult bounded local guidance, capture durable preferences, corrections, repeated misses, or manual learning requests, and audit field-guide memory."
---

# Field guide

Use the local field guide as a small, agent-independent learning layer. Do not load the complete store into context.

The guide is local and untracked at `~/.field-guide` by default. Current user instructions, live repository contracts, and current code always outrank stored guidance.

## Automatic lifecycle

Claude's plugin hook adds bounded lifecycle guidance at `UserPromptSubmit`. It
instructs one `capture`, `ask`, or `skip` evaluation before the final response.

Workflow does not register a Codex lifecycle hook. Codex shows hook runs and
injected context, and `suppressOutput` is not implemented. On Codex, use this
skill through normal routing when durable guidance is relevant.

The Claude hook does not register a `Stop` continuation. Claude can show its
block reason. End-of-task evaluation is instructed but not enforced.

Read [references/lifecycle-hooks.md](references/lifecycle-hooks.md) for the host selection, visibility, and privacy contract.

The hook supplies static instructions only. It does not read prompts,
transcripts, assistant messages, credentials, proprietary code, or field-guide
files.

Use only this field guide for the automatic lifecycle. Do not route the evaluation to host auto-memory or another memory system.

If Claude disables or rejects the hook, use this skill manually. A hook failure
must not block task completion.

Run commands through the bundled launcher in this skill's base directory. The launcher finds supported Node installations when PATH does not contain `node`:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh <command> [options]
```

## Retrieve guidance

Retrieve guidance for meaningful planning, implementation, debugging, or review after the repository and subject are known:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh retrieve --repo-root <git-root> --subject <subject-key> [--query <applicability-text>]
```

Use only the bounded result. Normal retrieval contains at most five active records and no evidence. Expand evidence only to resolve a provenance or conflict question:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh retrieve --repo-root <git-root> --evidence-for <guidance-id>
```

Retrieve again only when the task scope changes materially, the user corrects the approach, or guidance conflicts. Skip retrieval for casual conversation, status checks, routine Git mechanics, and administrative work.

Apply guidance in this order:

1. Current user request.
2. Live repository code, contracts, and instructions.
3. Current-project guidance.
4. Shared guidance.
5. Historical evidence.

Do not initialize a guide merely to consult it.

## Decide whether to learn

Classify an observation as `capture`, `ask`, or `skip`. Read [references/capture-policy.md](references/capture-policy.md) for the decision rules and examples.

- `capture`: The correction, preference, or repeated miss is explicit, durable, reusable, and safe. Store it automatically and tell the user.
- `ask`: Durability, intended behavior, scope, or safe wording is ambiguous. Ask one focused question and write nothing until the user confirms.
- `skip`: The observation is task-local, tentative, sensitive, already authoritative in live code or repository instructions, or unlikely to help later work.

Confidence is audit metadata. It never overrides these rules or evidence thresholds.

An obvious durable observation or an explicit request to remember one authorizes a narrow field-guide write. This authority covers only the initialization and submission needed under `~/.field-guide`. It does not cover unrelated file changes or raw conversation content.

## Capture or reinforce guidance

Before submission, inspect the bounded same-subject set:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh candidates --repo-root <git-root> --subject <subject-key> --scope <project|shared>
```

Compare the observation with those records. Submit it as new guidance, `reinforces`, `refines`, or `contradicts`. The utility owns exact fingerprint matching and evidence deduplication. The agent makes the semantic relationship judgment against this bounded set.

Do not let conflicting active guidance accumulate. When the user clearly confirms a correction, submit the linked replacement and use `transition` with action `supersede`, `confirmed: true`, and the returned replacement ID. Keep an inferred contradiction as a linked candidate. Ask before resolving it against active guidance.

Initialize the store when needed, then submit input that follows `schemas/submission-v1.schema.json`:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh init --repo-root <git-root>
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh submit --repo-root <git-root> --input <json-file>
```

For an explicit durable preference, avoid a temporary file by passing the same validated submission inline. Replace only the subject, learning, and sanitized summary:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh submit --repo-root <git-root> --input-json '{"schemaVersion":1,"decision":"capture","confidence":"high","scope":"project","subjectKey":"testing","learning":"Run focused tests before broad test suites.","explicitPreference":true,"evidence":{"summary":"The user stated a durable testing preference.","pointers":[{"kind":"manual","sourceLabel":"Direct request"}]}}'
```

Store a short paraphrase, not a quotation. Include sanitized pattern and antipattern examples only when they make the guidance more precise. Never store raw transcripts, prompts, credentials, proprietary code blocks, URL query parameters, or absolute home-directory paths.

The utility rejects high-signal secrets and unsafe source text at the write boundary. Treat that guard as a backstop. The agent must still remove sensitive meaning that pattern checks cannot detect.

After `submit` or `transition`, show one concise notice that reports the result. Use this form:

```text
Field-guide: <Activated|Saved candidate|Promoted|Reinforced> <project|shared> guidance: "<short learning>". Say "undo that learning" to reverse it.
```

Omit the undo sentence for a duplicate evidence event that changed nothing. Route an undo request through `transition` with action `undo`; do not delete evidence.

## Record a committed review correction

Keep committed code-review evidence as a first-class history path. Create a review record only after review feedback causes a committed correction.

1. Resolve and verify the full commit hash in the current repository.
2. Run `init` and read [references/storage.md](references/storage.md).
3. Create one review record with the required shape.
4. Link it from the project `init.md` and update the relevant project pattern.
5. Promote shared guidance only when the storage rules permit it.
6. Run `validate`.

Do not record no-finding reviews, rejected feedback, uncommitted corrections, secrets, proprietary code dumps, or raw conversation transcripts.

## Audit and maintenance

Treat `$workflow:field-guide audit` as a manual, read-only audit request:

```text
/bin/sh <field-guide-skill-directory>/scripts/field-guide.sh audit --repo-root <git-root>
```

Report findings without changing memory. Maintenance and permanent deletion require their explicit preview-and-apply flows in [references/storage.md](references/storage.md). Never infer approval to apply either operation from an audit request.

## Utility

All commands accept `--guide-root <path>` for tests or alternate local storage:

```text
field-guide.mjs audit --repo-root <path>
field-guide.mjs candidates --repo-root <path> --subject <key> --scope <project|shared>
field-guide.mjs delete --repo-root <path> --input <json-file>
field-guide.mjs init --repo-root <path>
field-guide.mjs maintain --repo-root <path> --input <json-file>
field-guide.mjs paths --repo-root <path>
field-guide.mjs retrieve --repo-root <path> (--subject <key> [--query <text>] | --evidence-for <guidance-id>)
field-guide.mjs submit --repo-root <path> --input <json-file>
field-guide.mjs transition --repo-root <path> --input <json-file>
field-guide.mjs validate --repo-root <path>
```

Read [references/storage.md](references/storage.md) for schemas, lifecycle rules, evidence pointers, retrieval limits, and storage contracts.
