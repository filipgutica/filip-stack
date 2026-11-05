# Prompt templates for the writing probe's scoring calls. Each takes only the page
# text and fixed brief material, never the arm or the guidance.
import json

EXTRACTOR = """You are scoring a draft page against its fact sheet. Read no other file, and do not run commands or browse; use only the text below.

Brief the writer received: {brief}

Fact sheet (facts tagged [agent-only] are true but belong in a sources note, a link, or a disclosure on a reader page, or should be left out):
{facts}

Draft page:
<<<PAGE
{page}
PAGE>>>

Report, for every fact id 1 to {nfacts}:
- "present": true when the page states the fact, in whole or as its reader-observable effect.
- "where": "explanation" when it is stated in the main text; "sources_note", "link", or "disclosure" when it appears only there; "effect_only" when the page states only what a reader observes (for example "it never slows your machine"), not the mechanism; "absent" when not present.

Also report:
- "invented_claims": each claim on the page that the fact sheet does not support, quoted briefly. Rewording, headings, and calls to action are not claims.
- "opening": {{"first_two_sentences": the first two prose sentences after the title, quoted; "names_subject_and_job": true when those two sentences name the subject and say what it does; "reason_within_first_120_words": true when a reason a reader would want it appears in the first 120 words}}.
- "sentences": the number of prose sentences and prose list items, not counting headings, code, or table cells.
- "fragments": each of those sentences or list items that has no finite verb, quoted.

Reply with only JSON: {{"facts": [{{"id": "1", "present": true, "where": "explanation"}}], "invented_claims": [], "opening": {{}}, "sentences": 0, "fragments": []}}"""

COMPREHENSION = """Read only the page below. Read no other file, and do not run commands or browse. Answer each question from the page alone. When the page does not say, answer "Not stated".

<<<PAGE
{page}
PAGE>>>

Questions:
(a) {a}
(b) {b}
(c) {c}

Reply with only JSON: {{"a": "...", "b": "...", "c": "..."}}. Start the answer to (c) with Yes, No, or Not stated."""

JUDGE = """You are comparing two drafts written from the same brief. Read no other file, and do not run commands or browse; judge only the text below.

Brief: {brief}

<<<DRAFT A
{a}
DRAFT A>>>

<<<DRAFT B
{b}
DRAFT B>>>

Answer each question with "A", "B", or "SAME":
- "reader": Could a first-time reader do what they came to do?
- "careful": Does it read like a careful person wrote it?
- "overall": Which draft is better overall?

Reply with only JSON: {{"reader": "A", "careful": "A", "overall": "A", "reason": "<one sentence>"}}"""

def facts_text(key):
    lines = [f"{i}. {t}" for i, t in key['facts'].items()]
    lines += [f"{i}. [agent-only] {t}" for i, t in key['agentOnly'].items()]
    return '\n'.join(lines)
