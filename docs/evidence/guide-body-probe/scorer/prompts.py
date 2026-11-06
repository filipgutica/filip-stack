# Prompt templates for the guide-body probe. A scoring prompt gets only the page text
# and fixed brief material, never the arm or the guidance.

BUILD = """Read the file `{file}` and follow it (skip this step when the file is empty). Read no other file. {brief} Use only the facts in the fact sheet below; do not add facts. Reply with the page as Markdown and nothing else. Do not edit files, start subagents, or browse.

{facts}"""

EXTRACTOR = """You are scoring a draft page against its fact sheet. Read no other file, and do not run commands or browse; use only the text below.

Brief the writer received: {brief}

Fact sheet (facts tagged [agent-only] are true but only matter to the subject's maintainers; a reader page should leave them out):
{facts}

The page's worked case: {case}
The concepts the page must teach: {concepts}

Draft page:
<<<PAGE
{page}
PAGE>>>

Report, for every fact id 1 to {nfacts}:
- "present": true when the page states the fact, in whole or as its reader-observable effect.
- "where": "main" when it is stated in the main text; "disclosure" when only inside a collapsed or optional block; "notes" when only in a notes, sources, or further-reading section; "link" when only as link text; "effect_only" when the page states only what a reader observes, not the fact itself; "absent" when not present.

Also report:
- "invented_claims": each claim on the page that the fact sheet does not support, quoted briefly. Rewording, headings, transitions, and calls to action are not claims. An example detail that is not on the fact sheet is a claim.
- "sections": the page's top-level sections below the title, in order. Use its second-level headings; when it has none, use its third-level headings. Put any text before the first such heading first, as one section with heading "(opening)". For each: {{"heading": "...", "kind": "opening" | "body" | "notes", "uses_case": true when the section uses the worked case by name or by its specific details}}. "notes" means a notes, sources, references, or further-reading section.
- "concepts": for each concept named above, {{"name": "<the name exactly as written above>", "explained": true when the page explains it, "motivated_first": true when, before or where the page first explains it, the page says what problem it solves or what question it answers}}.
- "ending": what the last "body" section does: "next_action" when it ends on what the reader can now do or where to go next, "summary" when it recaps the sections, or "other".
- "forward_dependencies": each term the page uses in an explanation before it defines it, when the brief's audience would not already know it, quoted briefly.

Reply with only JSON: {{"facts": [{{"id": "1", "present": true, "where": "main"}}], "invented_claims": [], "sections": [], "concepts": [], "ending": "other", "forward_dependencies": []}}"""

COMPREHENSION = """Read only the page below. Read no other file, and do not run commands or browse. Answer each question from the page alone. When the page does not say, answer "Not stated".

<<<PAGE
{page}
PAGE>>>

Questions:
(a) {a}
(b) {b}
(c) {c}
(d) {d}

Reply with only JSON: {{"a": "...", "b": "...", "c": "...", "d": "..."}}.{yes_no}"""

JUDGE = """You are comparing two drafts written from the same brief. Read no other file, and do not run commands or browse; judge only the text below.

Brief: {brief}

<<<DRAFT A
{a}
DRAFT A>>>

<<<DRAFT B
{b}
DRAFT B>>>

Answer each question with "A", "B", or "SAME":
- "follow": Could a first-time reader follow the page from start to finish and do or understand what it teaches?
- "story": Does the page read as one story, with each section building on the last?
- "overall": Which draft is better overall?

Reply with only JSON: {{"follow": "A", "story": "A", "overall": "A", "reason": "<one sentence>"}}"""

# Every dispatched call gets this one-line task; the prompt itself is in the file.
TASK = "Read the file {path} and follow it exactly. Reply with only what it asks for."


def yes_no(answer_key):
    """Format note for the questions the key grades by a Yes or No prefix."""
    qs = [f'({q})' for q, rule in answer_key.items() if 'prefix' in rule]
    if not qs:
        return ''
    which = f'the answer to {qs[0]}' if len(qs) == 1 else 'the answers to ' + ', '.join(qs[:-1]) + ' and ' + qs[-1]
    return f' Start {which} with Yes, No, or Not stated.'
