# Field-guide capture policy

Use this policy after an observation appears during normal work. The decision is rule-based, but semantic meaning still requires agent judgment.

## End-of-task evaluation

At the end of meaningful work, decide `capture`, `ask`, or `skip`. Perform this evaluation once for each completed main-agent task.

Claude and Codex `UserPromptSubmit` hooks instruct this evaluation before the
final response. A `Stop` continuation does not enforce it. Codex can show the
hook run and injected context.

For `capture`, preserve the normal task response, use bounded candidates before submission, and append only the change notice. For `ask`, preserve the normal task response, append one focused learning question, and write no memory while the answer is pending. Learning must not delay or replace the task result. For `skip`, preserve the normal task response, write no memory, and append nothing.

The hooks only instruct this decision. They do not classify observations or write memory.

## Capture

Capture when every condition is true:

1. The user states a clear preference or correction, or the same meaningful miss has independent evidence.
2. The guidance will likely apply to future work.
3. The intended behavior and scope are clear.
4. A short paraphrase can preserve the meaning without sensitive content.
5. Current global instructions, project instructions, or live technical sources do not already provide the same authority.

A preference about when to use a manual-only skill (`disable-model-invocation: true`) meets condition 5 even when that skill's contract describes its use. Nothing routes to a manual-only skill until the user names it. The preference still fails condition 5 when global or project instructions already state it.

Examples:

- "Prefer named constants for non-obvious domain thresholds." Capture as shared guidance. Its meaning is portable across repositories.
- "You missed the same generated-file check again." Capture or reinforce a project learning when the repeated miss is clear and reusable.
- A committed review correction exposes a reusable antipattern. Keep the review record and submit the generalized guidance with review or commit evidence.
- "Suggest `$checkpoint` before you hand a branch to someone else." Capture as shared guidance when `checkpoint` is manual-only and no instruction says when to use it.

## Ask

Ask one focused question when any material part is ambiguous:

- "I prefer the other style." Ask which style and whether the preference is project-specific or general.
- "Remember this." Ask what durable rule to preserve if the target is unclear.
- A correction might be a one-off tradeoff or a lasting preference. Ask whether it should guide later work.
- New guidance appears to refine or contradict an active record, but the intended relationship is unclear. Show the short conflict and ask before resolving it.

Write no memory while the answer is pending. Continue and deliver the authorized task independently of this learning question.

## Skip

Skip when any condition is true:

- The observation is temporary, tentative, or specific to the current patch.
- The information contains secrets, credentials, raw prompts, raw transcripts, proprietary code, or unsafe pointers.
- The rule is already authoritative in current global or project instructions, code, types, tests, schemas, or current documentation.
- The rule is already encoded in global or project guidance, such as a delegation role table, or in the contract of a skill the model can invoke on its own.
- The observation is praise, a status update, a rejected suggestion, or a no-finding review.
- The learning would not change a future agent decision.

Examples:

- "Use this temporary endpoint until staging recovers." Skip as temporary.
- "The test is in `src/x.test.ts`." Skip because live repository search is authoritative.
- "Nice fix." Skip because it contains no durable decision.
- "Use Opus 5.5 for visual reviews." Skip when the global delegation role table already routes visual reviews to Opus 5.5.

## Scope and evidence

Choose scope from where the guidance can be applied safely. The current repository is evidence context, not an automatic scope signal.

Apply the durability counterfactual before choosing scope: remove the current task, patch, branch, migration, compatibility shim, and temporary condition. If the guidance loses its reason or would preserve behavior that should disappear with that work, skip it. Rewording a temporary implementation detail as a general sentence does not make it durable.

Use shared scope for a portable preference, collaboration style, design judgment, or antipattern. Shared guidance must not depend on one repository's identity or contracts. Assign shared scope to a clear user preference even when the user states it during project work. The user does not need to say "in every repository" when the wording and meaning are already general.

Use project scope only when the learning depends on a durable repository-specific contract, architecture, vocabulary, data shape, fixture convention, or workflow caveat. Write enough repository context into the learning to prevent accidental use elsewhere. The guidance must apply to future work in that repository. It must not describe only the current task, patch, branch, or completed work.

Use this counterfactual test before submission:

1. Remove the current repository name and task details from the observation.
2. If the resulting guidance remains correct and useful across unrelated repositories, use shared scope.
3. If applying it elsewhere could be wrong because it relies on a repository-specific contract, use project scope.
4. If neither conclusion is clear, choose `ask` and confirm the intended scope.

Examples:

- Shared, if not authoritative elsewhere: "Prefer destructured object parameters for configuration-style inputs."
- Project: "In this repository's fixture catalog, update an existing entry when it covers the same scenario. Add an entry only when the test contract requires an independent case."
- Skip: "For this fixture patch, update the row we changed earlier."
- Skip: "Strip legacy aliases at the request boundary while this compatibility shim is in place."

An explicit preference can activate immediately. An inferred project learning remains a candidate until two independent evidence events support it. Manual evidence and conversation evidence without an occurrence ID do not satisfy promotion thresholds.

A conversation pointer names the thread the way the nightly session review does, so one thread counts once. In a T3 Code main thread, use client `t3-code` and the `T3CODE_THREAD_ID` value as `threadId`. Elsewhere, use client `claude-code` or `codex` with the host's session ID only when you know it. Otherwise, and in a delegate, use a manual pointer.

An inferred shared learning still requires independent evidence from two repository identities and `generic: true`. This promotion threshold does not force a semantically portable explicit user preference into project scope.

Run `candidates` before `submit`. Exact duplicates are deterministic. Semantic duplicates and `reinforces`, `refines`, or `contradicts` relationships are agent judgments over the bounded candidate set.

## Confirmation and event triggers

A user confirmation marks an active record `[confirmed]` in hook-injected lines in a main thread. Only the user creates one, by sending a prompt that is exactly `confirm fg:<id>` in a main thread. No Field Guide command creates one; import copies them from the user's synced file, which the user trusts.

Offer confirmation only for a record that names an action that global or project instructions would otherwise gate, such as a destructive action they say to ask about first. Add one line after the change notice or report: "Type `confirm fg:<id>` to confirm it; confirmed guidance can authorize the action where your global guidance says so", with the first eight hex characters of the guidance ID. Do not offer it for style, process, or other guidance that needs no authorization.

Never send, run, or simulate a confirm prompt, including through a host tool that sends prompts. The hook cannot tell who sent it, so this rule is what bars an agent. Never treat your own reading of a record, a pasted report, a quoted ID, or a reply in conversation as a confirmation. Only the `[confirmed]` marker that the hook renders counts; `retrieve` output never shows it. When the user withdraws that authority, run `unconfirm --id <id>`.

Tag a record with a trigger when it applies at an event rather than to a topic: `pr-merged` after a merge, `pr-created` after a pull request opens, and `handoff` before a final report. Run `annotate --id <id> --triggers <list>`, and remove a wrong tag with `--remove-trigger <trigger>`. Triggers choose when guidance is retrieved and carry no authority.

Examples:

- "After a merge, remove its worktrees and branches without asking." Global guidance says to ask before destructive actions. Capture it, tag it `pr-merged` and `handoff`, and offer `confirm fg:<id>`.
- "Prefer named constants for non-obvious domain thresholds." Capture it and offer no confirmation.

## Safe representation

Store only the minimum durable paraphrase. A safe record can include:

- one concise learning;
- one portable subject key;
- a sanitized pattern and antipattern when useful;
- a typed evidence pointer allowed by the submission schema;
- a short source summary that is not a quotation.

Reject the whole pointer when it violates the allowlist. Never retain only the apparently safe parts of an invalid pointer.
