# Field-guide capture policy

Use this policy after an observation appears during normal work. The decision is rule-based, but semantic meaning still requires agent judgment.

## Capture

Capture when every condition is true:

1. The user states a clear preference or correction, or the same meaningful miss has independent evidence.
2. The guidance will likely apply to future work.
3. The intended behavior and scope are clear.
4. A short paraphrase can preserve the meaning without sensitive content.
5. Live repository instructions or code do not already provide the same authority.

Examples:

- "From now on, keep PR descriptions to Summary and Changes." Capture an explicit preference. Use shared scope only when the user clearly makes it general.
- "You missed the same generated-file check again." Capture or reinforce a project learning when the repeated miss is clear and reusable.
- A committed review correction exposes a reusable antipattern. Keep the review record and submit the generalized guidance with review or commit evidence.

## Ask

Ask one focused question when any material part is ambiguous:

- "I prefer the other style." Ask which style and whether the preference is project-specific or general.
- "Remember this." Ask what durable rule to preserve if the target is unclear.
- A correction might be a one-off tradeoff or a lasting preference. Ask whether it should guide later work.
- New guidance appears to refine or contradict an active record, but the intended relationship is unclear. Show the short conflict and ask before resolving it.

Write nothing while the answer is pending.

## Skip

Skip when any condition is true:

- The observation is temporary, tentative, or specific to the current patch.
- The information contains secrets, credentials, raw prompts, raw transcripts, proprietary code, or unsafe pointers.
- The rule is already discoverable from current repository instructions, schemas, tests, or code.
- The observation is praise, a status update, a rejected suggestion, or a no-finding review.
- The learning would not change a future agent decision.

Examples:

- "Use this temporary endpoint until staging recovers." Skip as temporary.
- "The test is in `src/x.test.ts`." Skip because live repository search is authoritative.
- "Nice fix." Skip because it contains no durable decision.

## Scope and evidence

Use project scope by default. Use shared scope only for an explicit general preference or a generic inferred learning supported by independent evidence from two repositories.

An explicit preference can activate immediately. An inferred project learning remains a candidate until two independent evidence events support it. Manual evidence and conversation evidence without an occurrence ID do not satisfy promotion thresholds.

Run `candidates` before `submit`. Exact duplicates are deterministic. Semantic duplicates and `reinforces`, `refines`, or `contradicts` relationships are agent judgments over the bounded candidate set.

## Safe representation

Store only the minimum durable paraphrase. A safe record can include:

- one concise learning;
- one portable subject key;
- a sanitized pattern and antipattern when useful;
- a typed evidence pointer allowed by the submission schema;
- a short source summary that is not a quotation.

Reject the whole pointer when it violates the allowlist. Never retain only the apparently safe parts of an invalid pointer.
