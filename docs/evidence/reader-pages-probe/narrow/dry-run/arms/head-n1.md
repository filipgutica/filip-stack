<!-- part: technical-writing/SKILL.md -->

# Technical writing

Make technical prose clear, concise, and faithful to the source.

## Preserve the contract

1. Identify the audience, purpose, required format, and source evidence. PR descriptions follow pull request guidance (the "pull-requests.md" part of this file); pages and READMEs follow reader pages (the "reader-pages.md" part of this file).
2. Preserve facts, decisions, links, citations, identifiers, code, commands, and required headings.
3. Separate confirmed facts from assumptions and unresolved items.
4. Do not invent behavior, verification, ownership, or rationale.
5. Edit only the requested artifact or section.

## Write technical prose

Apply Simplified Technical English guidance (the "technical-prose.md" part of this file) to every technical deliverable. It also applies to prose inside specifications, plans, and tickets. Their existing owner retains control of decisions and structure.

Lead with the result, decision, or required action. State it directly, without a format label or stock summary heading. Preserve the requested format.

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

<!-- part: reader-pages.md -->

# Reader pages

Apply this guidance to pages a reader uses to decide whether to use something or to start learning it: tool and product landing pages, skill pages, and the opening of a guide or lesson. It works with technical prose (the "technical-prose.md" part of this file): technical prose keeps each sentence clear, and this guidance decides what the page says and in what order.

Procedure and reference sections, such as install and update steps, option tables, and changelogs, follow technical prose instead. This holds even when they sit on the same page as a landing section.

## Page order

Order the page the way a first-time reader asks questions:

1. What is it?
2. Why would I want it?
3. How do I start?
4. What else do I need to know?

Put the answers to 1 to 3 on the first screen. Reference material, such as option tables, edge cases, and internals, comes after them.

## Rules

**R1. Open with what it is.** The first sentence names the thing and says what it does, in words the reader already has. Use a familiar comparison when the source gives one ("devps is `ps` for dev servers"). A heading that states the job does not replace this sentence.

**R2. Say why a reader would want it.** Next, give the problem it solves or the moment to reach for it. Take this from the source, such as the README, the skill, or the user. Do not invent pain points, statistics, or testimonials.

**R3. Say each point once, across the whole page.** That includes text the page builds from elsewhere: ledes from a README table, captions, generated summaries. When a section's first sentence repeats the lede or its heading, cut one of them.

**R4. Show how to start before the details.** Before rules, options, or internals, give the install step or first command and one real example of using it. The example can be an invocation, a command, or a short output. Label illustrative examples as illustrative.

**R5. Define a term before the page relies on it.** Give each term from the tool's or skill's internals, such as job, gate, climb card, or pillar, a one-clause definition the first time it appears. For example, write "a *job*, meaning a runner and the servers it starts". If a term needs more than a sentence, check whether the page needs it at all.

**R6. Write sentences, not notes.** Reader-facing copy uses sentences with a subject and a verb. Table cells stay short, but each one reads as a phrase a person would say. Avoid shorthand such as "Search: X. Browse: Y." or "Stop saves. No merge view." Length follows the reader's job. When a terse page leaves the reader guessing, the fix is more words.

**R7. Write for the reader in front of you.** Do not copy the agent's contract onto a page for people. Before you place a fact from the source, decide who needs it. Ask: would this reader do something differently if they knew it?

- If yes, keep it in the reader's terms. For example, "path by path, without the stash stack" becomes "it never uses your Git stash".
- If a mechanism matters only because it makes the tool safe or trustworthy, state the effect the reader sees and leave out the mechanism.
- If only a maintainer, operator, or agent needs it, leave it off the page, and link to the `SKILL.md`, reference, or source that owns it when one exists. Notes sections, such as Good to know or an FAQ, are part of the reader's page and follow the same rule.
- Use a disclosure only for a second reader of this page, such as someone who audits a lesson by hand, and say in its title who it is for.
- Put sourcing notes and drafting history in a sources section or a changelog. "An earlier draft scored 12 of 24" does not belong in the explanation.

On a reader page, preserving the source means keeping every fact the reader needs. A fact that only maintainers or agents need is not lost when the page links to its owner or leaves it out.

When the source changes, update the page from the reader's side. Do not copy the new contract wording.

**R8. Use structure for what it is.** Use numbered lists for steps, bullets for parallel items, tables for comparisons, and prose for explanation, cause, and story. Do not turn a paragraph that explains why into bullets. Do not give every bullet a bold label.

## Examples

Lede, tool page:

> Before: One row per job: ports, project, origin, and age. Jump to its origin, open its URL, or stop it.
>
> After: devps is `ps` for dev servers. It shows every dev server you have running, with its ports, project, and age, and the terminal, editor, or agent that started it. Use it to find a server you forgot, open it in the browser, or stop it.

Skill page, contract wording translated:

> Before: Keeps the candidate when a strict majority of at least two completed judges prefers it. Otherwise it restores the snapshot path by path, without the stash stack or `git clean`.
>
> After: If most judges prefer the new version, with at least two judges answering, it stays. If not, hill climb restores the snapshot file by file. It never uses your Git stash or `git clean`.

Lesson, auditor detail moved behind a disclosure:

> Before: Mark a pillar N/A when it does not apply, give a one-line reason, and leave it out of the total.
>
> After, on the main path: A pillar gets the highest level that its verified evidence fully meets.
> After, in a disclosure titled "Scoring rules for a hand audit": the N/A rule, unchanged.

## Check before you finish

Read the first screen, then the whole page, as a newcomer with no access to the source. Confirm that:

- you can say what it is, who it is for, and what to type or click first
- every term on that screen is either familiar or defined
- no paragraph repeats an earlier one, including the generated lede
- every fact the reader needs from the source is on the page, and none is new without a source
- no section, including the notes, explains internals that only a maintainer or agent needs
- the prose has no not-X-but-Y contrasts, one-line closers, bold-label bullets, or sentences about the page itself; use the `humanizer` skill for this pass when it is available

<!-- part: technical-prose.md -->

# Technical prose

Apply this guidance to every written deliverable, including those produced during planning and engineering. Use Simplified Technical English (ASD-STE100) principles for technical prose. Each workflow retains ownership of scope, requirements, decisions, and artifact structure.

## Apply the writing rules

- Prefer familiar words and active sentences that identify the actor. Use verbs to describe actions.
- Keep terminology consistent. Define necessary domain terms. Preserve API names and other exact identifiers.
- Give each instruction its own sentence. Put conditions before the action they control and keep sequences in order.
- Aim for at most 20 words in procedural sentences and 25 in explanatory sentences. Treat these as ceilings and keep every sentence complete. Retain longer wording when splitting or shortening would lose precision.
- Keep each paragraph on one topic, with at most six sentences. Use lists for steps and conditions when they aid reading.
- Replace ambiguous verb phrases with direct verbs. Break up dense noun strings and sentences joined by semicolons.
- Preserve quantities, exceptions, scope, and uncertainty. Never turn a possibility into a fact or add an unsupported cause.

Procedures, error text, and safety instructions need especially literal wording. Explanatory documents and reader pages (the "reader-pages.md" part of this file) use complete, natural sentences. These are STE-based clarity guidelines, not certification against ASD's official dictionary.

## First-reader review

Before presenting a written deliverable as ready, review it as its intended human audience encountering it for the first time. Assume appropriate domain knowledge, with no access to the conversation that produced it.

Check whether the reader can:

- understand the purpose, expected outcome, and relevant context
- proceed with actionable work from clear deliverables, scope, constraints, dependencies, and completion criteria, or, on a reader page, say what it is, why they would want it, and how to start
- follow instructions without vague wording, unexplained terms, hidden assumptions, or missing decisions
- understand, review, or pick up the work without reconstructing the author's intent

Resolve gaps using authoritative evidence. Keep unresolved questions explicit and return material scope or decision gaps to the owning workflow. Do not invent requirements, ownership, or decisions to make the document appear complete.

Keep the review proportional to the artifact: tickets support implementation, PR descriptions support review, and reports support understanding and decisions. Preserve the applicable format; these checks do not require common headings or a checklist in every deliverable.

## Finish the prose

Remove filler, inflated claims, repeated explanations, and unnecessary jargon. Use the `humanizer` skill when available for requested natural-language editing or substantial stylistic revision. Keep code, commands, links, quotations, required headings, and structured data intact. Preserve technical meaning and these clarity rules during any final editorial pass. Return the requested deliverable without style labels or editorial notes unless requested.

Writing approach: [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill/blob/master/SKILL.md). Attribution and license are in third-party notices.

<!-- part: Global guidance: Written deliverables -->

## Written deliverables

- Use the `humanizer` skill when the user requests natural-language editing, a draft needs substantial stylistic revision, or you write a reader page. Other technical deliverables need only the applicable writing guidance and a concise final read.
- Preserve facts, technical meaning, uncertainty, consistent terminology, code, links, required structure, and applicable Simplified Technical English constraints. Keep the draft and editorial audit internal. Return only the requested deliverable unless the user asks to see the editing process.
- For a ticket, specification, or implementation plan, use the planning guidance; for a PR description, use the technical-writing guidance. Their references own the default formats.
- Make PR descriptions, PR comments, review replies, and Slack messages easy to scan within their format. Put one idea on each line or bullet. Use a table to compare items or show status. Give a sequence of events as one bullet per event, in time order. Avoid dense paragraphs.
- Pages, guides, and READMEs that people read to learn a tool follow the technical-writing reader pages guidance: say what it is, why a reader would want it, and how to start, before the details. They are not replies, so the scan rule above does not apply to them. Write complete sentences, and explain where a terse page would leave the reader guessing.

<!-- part: Design language: Copy and density -->

## Copy and density

- Lead with a plain description and a useful action. On a product or tool page, the first screen says what it is, why a reader would want it, and how to start. Keep one idea per short paragraph, written in full sentences. Product pages can explain value without unsupported superlatives or invented statistics.
- Say each point once. Put exact payloads, logs, or long reference text behind a useful disclosure when appropriate.
- Keep table cells short. Put rules, thresholds, and caveats next to what they govern.
- Label illustrative data and demo outcomes clearly. Credit upstream creators when presenting a derivative product.
- Use monochrome line icons sparingly; give an icon a purpose beyond filling space.

<!-- part: CLI tool template: Pages site -->

## Pages site

Each tool has one page at `https://filipgutica.github.io/<tool>/`. Start from a sibling tool's `docs/site/`, then replace its content, captures, links, and tests with the new tool's. Keep the page's look in `@filipgutica/ui`, not in the site.

- **Stack:** Astro with Vue in `docs/site/`, with its own `package.json` and `package-lock.json`. Copy `astro.config.mjs` and `tsconfig.json` byte for byte, changing only the tool name. Pin `@filipgutica/ui` to its latest release.
- **Frame:** wrap the page in the library's `.fg-site-docs` shell, with `UiSiteHeader`, `UiSiteNav` (`label="On this page"`), and `.fg-site-footer`. Use `UiCapture` for terminal output, `.fg-site-legend` for what the screen shows, and `.fg-site-definitions` for notes. `src/styles/site.css` keeps the sibling's `@layer` and `@import` header unchanged, then holds only page-specific rules. The library owns the frame, rail, footer, base type, `kbd`, and the terminal palette.
- **Sections, in order:** intro (H1 that says what the tool does; a lede that says what the tool is, in the README's words, and when you would reach for it; the install command; the facts row), the capture, Commands, Keys, then tool-specific sections, and Good to know last. Define any term the page relies on, such as a devps *job*, in the intro. Write the copy in full sentences. Facts are plain text, not badges. Good to know holds what a user should know, not how the tool is built. Its terms are noun phrases, and their definitions are full sentences.
- **Links:** the header links to GitHub and Releases, and a "Full reference" link to the README closes the page. The footer links to the author, the Homebrew tap, issues, and Releases. Do not add a "Guide" link: the page is the guide.
- **CI:** copy `site-ci.yml` and `pages.yml` byte for byte, changing only the tool name. `pages.yml` deploys `main`. Both use Node 22 in `docs/site`. Site CI runs `npm ci`, `npm run check` (`astro check` and `vue-tsc`), `npm run build`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`. The Playwright tests cover phone and desktop widths and a no-JavaScript render.
