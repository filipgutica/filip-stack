<!-- part: technical-writing/SKILL.md -->

# Technical writing

Make technical prose clear, concise, and faithful to the source.

## Preserve the contract

1. Identify the audience, purpose, required format, and source evidence. PR descriptions follow pull request guidance (the "pull-requests.md" part of this file).
2. Preserve facts, decisions, links, citations, identifiers, code, commands, and required headings.
3. Separate confirmed facts from assumptions and unresolved items.
4. Do not invent behavior, verification, ownership, or rationale.
5. Edit only the requested artifact or section.

## Write technical prose

Apply Simplified Technical English guidance (the "technical-prose.md" part of this file) to every technical deliverable. It also applies to prose inside specifications, plans, and tickets. Their existing owner retains control of decisions and structure.

Lead with the result, decision, or required action when it helps the reader. State it directly, without naming a rhetorical format or adding a stock summary heading. Preserve the requested artifact format.

## Finish

Check that:

- the opening states what the reader needs first
- every claim has a source or a clear uncertainty label
- required evidence and limitations remain present
- code, commands, and identifiers are unchanged
- the text contains no duplicated requirement
- the requested destination and authority are clear before any external write

<!-- part: pull-requests.md -->

# Pull request descriptions

Read applicable repository and project guidance before writing. Explicit user instructions take precedence; follow the repository's required headings, checklists, and format, fitting the content below into that structure.

## Default structure

```md
## Description
<Short explanation of the problem and resulting behavior.>

## Changes
- <Meaningful change>

## How to verify
1. <Concrete reviewer action, with setup when necessary.>
2. <Expected result.>
```

- **Lead with the why.** One or two sentences: the problem and the resulting behavior. Leave out the implementation history.
- **Write for the team.** Leave out background reviewers already know, such as how the platform, config, or flags work. Describe only what this PR changes.
- **One bullet per behavior.** Bold the area, then one plain sentence with the rule as a reviewer sees it. Leave out conditions and internals that don't change that behavior.
- **Simplest proof.** Each verification step is the smallest check that shows the behavior works.
- Make verification useful to a human. Include runnable commands or requests for backend, API, or CLI changes, with necessary setup and expected results. Verify commands, endpoints, inputs, and claimed results against the actual change; identify any remaining uncertainty.
- For visual changes, add screenshots where they demonstrate the result: before and after when comparison helps, or after only when sufficient. Use one image per state, labeled by state. Put states of the same screen side by side in a table. Relabel an existing image when it already shows another state. Mixed changes can use both screenshots and commands.
- Add a Screenshots section only when relevant media is available. Preserve existing user-added images, videos, and other media when updating a description.
- Leave out Risks, limits, and post-merge task sections unless the user asks for them. Tell the user about material review concerns or required follow-ups before or when opening the PR. Omit empty optional sections.
- Avoid repeating routine checks or results that CI already reports. State a material verification gap when it affects review.
- Before creating or updating the PR, check the complete body against repository guidance, this reference, and the current diff. Verify required structure, completed sections without placeholders, concrete reviewer actions and expected results, and preservation of existing user-added media; fix gaps before publishing. If required guidance is unavailable, report the blocker and do not create or update the PR. Writing a draft does not authorize publication.
- After publication, fetch the saved body, recheck the same requirements, and correct mismatches before reporting completion.

## Example

Illustrative backend change; use the actual project's setup, endpoint, fixture data, and expected result in a real PR.

````md
## Description
Fix pagination so requesting a later page returns the correct widgets.

## Changes
- Apply the requested offset when retrieving widgets.

## How to verify
1. Start the local API with five widgets ordered by ID and set `API_BASE_URL` to its address.
2. Request the second page:

   ```sh
   curl --fail-with-body "$API_BASE_URL/widgets?limit=2&offset=2"
   ```

3. Confirm the response contains the third and fourth widget IDs, with no IDs from the first page.
````

<!-- part: technical-prose.md -->

# Technical prose

Apply this guidance to every written deliverable, including those produced during planning and engineering. Use Simplified Technical English (ASD-STE100) principles for technical prose. Each workflow retains ownership of scope, requirements, decisions, and artifact structure.

## Apply the writing rules

- Prefer familiar words and active sentences that identify the actor. Use verbs to describe actions.
- Keep terminology consistent. Define necessary domain terms. Preserve API names and other exact identifiers.
- Give each instruction its own sentence. Put conditions before the action they control and keep sequences in order.
- Aim for at most 20 words in procedural sentences and 25 in explanatory sentences. Retain longer wording when splitting or shortening would lose precision.
- Keep each paragraph on one topic, with at most six sentences. Use lists for steps and conditions when they aid reading.
- Replace ambiguous verb phrases with direct verbs. Break up dense noun strings and sentences joined by semicolons.
- Preserve quantities, exceptions, scope, and uncertainty. Never turn a possibility into a fact or add an unsupported cause.

Procedures, error text, and safety instructions need especially literal wording. Explanatory documents can retain a natural voice. These are STE-based clarity guidelines, not certification against ASD's official dictionary.

## First-reader review

Before presenting a written deliverable as ready, review it as its intended human audience encountering it for the first time. Assume appropriate domain knowledge, with no access to the conversation that produced it.

Check whether the reader can:

- understand the purpose, expected outcome, and relevant context
- proceed with actionable work from clear deliverables, scope, constraints, dependencies, and completion criteria
- follow instructions without vague wording, unexplained terms, hidden assumptions, or missing decisions
- understand, review, or pick up the work without reconstructing the author's intent

Resolve gaps using authoritative evidence. Keep unresolved questions explicit and return material scope or decision gaps to the owning workflow. Do not invent requirements, ownership, or decisions to make the document appear complete.

Keep the review proportional to the artifact: tickets support implementation, PR descriptions support review, and reports support understanding and decisions. Preserve the applicable format; these checks do not require common headings or a checklist in every deliverable.

## Finish the prose

Remove filler, inflated claims, repeated explanations, and unnecessary jargon. Use the `humanizer` skill when available for requested natural-language editing or substantial stylistic revision. Keep code, commands, links, quotations, required headings, and structured data intact. Preserve technical meaning and these clarity rules during any final editorial pass. Return the requested deliverable without style labels or editorial notes unless requested.

Writing approach: [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill/blob/master/SKILL.md). Attribution and license are in third-party notices.

<!-- part: Global guidance: Written deliverables -->

## Written deliverables

- Use the `humanizer` skill when the user requests natural-language editing or a draft needs substantial stylistic revision. Ordinary technical deliverables need only the applicable writing guidance and a concise final read.
- Preserve facts, technical meaning, uncertainty, consistent terminology, code, links, required structure, and applicable Simplified Technical English constraints. Keep the draft and editorial audit internal. Return only the requested deliverable unless the user asks to see the editing process.
- For a ticket, specification, or implementation plan, use the planning guidance; for a PR description, use the technical-writing guidance. Their references own the default formats.
- Make PR descriptions, PR comments, review replies, and Slack messages easy to scan within their format. Put one idea on each line or bullet. Use a table to compare items or show status. Give a sequence of events as one bullet per event, in time order. Avoid dense paragraphs.

<!-- part: Design language: Copy and density -->

## Copy and density

- Lead with a plain description and a useful action. Keep one idea per short paragraph. Product pages can explain value without unsupported superlatives or invented statistics.
- Say each point once. Put exact payloads, logs, or long reference text behind a useful disclosure when appropriate.
- Keep table cells short. Put rules, thresholds, and caveats next to what they govern.
- Label illustrative data and demo outcomes clearly. Credit upstream creators when presenting a derivative product.
- Use monochrome line icons sparingly; give an icon a purpose beyond filling space.
