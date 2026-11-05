# Reader pages

Apply this guidance to writing that a person reads to decide whether to use something, or to learn how to use it. That covers product and tool pages, docs pages, guides and lessons, skill pages, and READMEs. It works with [technical prose](technical-prose.md): technical prose keeps each sentence clear, and this guidance decides what the page says and in what order.

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

**R4. Show how to start before the details.** Give the install step or first command, plus one real example of using it, such as an invocation, a command, or a short output, before rules, options, or internals. Label illustrative examples as illustrative.

**R5. Define a term before the page relies on it.** Give each term from the tool's or skill's internals a one-clause definition the first time it appears ("a *job*, meaning a runner and the servers it starts"). Examples of such terms are job, gate, climb card, and pillar. If a term needs more than a sentence, the page may not need it.

**R6. Write sentences, not notes.** Reader-facing copy uses sentences with a subject and a verb. Table cells stay short, but each one reads as a phrase a person would say. Avoid shorthand such as "Search: X. Browse: Y." or "Stop saves. No merge view." Length follows the reader's job. When a terse page leaves the reader guessing, the fix is more words.

**R7. Write for the reader in front of you.** A page for people is not a copy of the agent's contract. Before you place a fact from the source, decide who needs it. Ask: would this reader do something differently if they knew it?

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

Read the first screen as a newcomer with no access to the source. Confirm that:

- you can say what it is, who it is for, and what to type or click first
- every term on that screen is either familiar or defined
- no paragraph repeats an earlier one, including the generated lede
- every fact the reader needs from the source is on the page, and none is new without a source
- no section, including the notes, explains internals that only a maintainer or agent needs
- the prose has no not-X-but-Y contrasts, one-line closers, bold-label bullets, or sentences about the page itself; use the `humanizer` skill for this pass when it is available
