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

## Guide and lesson bodies

These rules cover the sections after the opening of a tutorial, how-to guide, or explanation. They do not cover the opening, landing pages, reference pages, or PR descriptions. A required template or heading order takes precedence.

Classify the page before you apply them. Ask whether it guides action or builds understanding, and whether the reader is learning or doing work:

- A tutorial guides action while the reader learns, through one concrete project or case.
- A how-to guide directs a competent reader through a real task.
- An explanation builds understanding of a topic, away from any task.

A lesson is usually a tutorial or an explanation. Apply each rule only to the types it names.

For all three types:

- Order the sections so each one builds only on terms and ideas that the audience already knows or that earlier sections introduced. Define any other term where it first appears. You can link to a later section, but do not make a section depend on it.
- Start each section with what the reader needs most from it. Do not restate the heading or, in a procedure, the order of the steps. Refer back to a point that an earlier section made instead of repeating it.
- Give each section one reader question or task. Split a section that holds two, and merge sections that divide one.
- Leave out facts that only the subject's maintainers need, such as internal limits and release details. Link to them when a reader may want them.
- If the page keeps notes about how it was sourced or drafted, put them in a notes section after the last body section.

For a tutorial:

- When the sources give a concrete project or case, use it in every step it applies to. Do not switch to a new example or invent a case or its details.
- Keep explanation to a short reason in plain words, and link to a fuller explanation. Leave out options and alternatives.
- End the body on what the reader has achieved and can now do.

For a how-to guide:

- Leave out teaching, background, and complete option lists. Link to an explanation or a reference page instead.
- End where the task ends, then say where to go next.

For an explanation:

- Before you explain a concept, say what problem it solves or what question it answers.
- Keep instructions out, and link to the how-to guide that has them.

The three types follow the [Diátaxis](https://diataxis.fr) framework.

## Finish the prose

Remove filler, inflated claims, repeated explanations, and unnecessary jargon. Use the `humanizer` skill when available for requested natural-language editing or substantial stylistic revision. Keep code, commands, links, quotations, required headings, and structured data intact. Preserve technical meaning and these clarity rules during any final editorial pass. Return the requested deliverable without style labels or editorial notes unless requested.

Writing approach: [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill/blob/master/SKILL.md). Attribution and license are in [third-party notices](../../../THIRD_PARTY_NOTICES.md).
