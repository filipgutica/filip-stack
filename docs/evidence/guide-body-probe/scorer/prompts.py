# Prompt templates for the guide-body probe. A scoring prompt gets only the page text
# and fixed brief material, never the arm or the guidance. These templates are frozen
# by the pre-registration: they do not change after calibration starts.

BUILD = """Read the file `{file}` and follow it (skip this step when the file is empty). Read no other file. {brief} Use only the facts in the fact sheet below; do not add facts. Reply with the page as Markdown and nothing else. Do not edit any file except the reply file your task names, and do not start subagents or browse.

{facts}"""

TASK_WRITER = """You write reader tasks for a documentation study. Read no other file, and do not run commands or browse; use only the text below.

A writer will turn the fact sheet below into a page. The brief: {brief}
The page type: {page_type}. The reader: the audience the brief names, reading the page for the first time.

Fact sheet (facts tagged [agent-only] only matter to the subject's maintainers; no task may need them):
{facts}

Write 2 tasks. Each task is something a real reader of this page would come to it to do or decide, phrased as a short situation and a question. For each task:
- It needs 1 to 3 facts from the sheet, none of them [agent-only]. List their ids.
- The two tasks together need at most half of the reader facts, so a reader does not need the whole page.
- Its answer is short and can be checked by text patterns: either it starts with Yes or No, or it contains specific words. Give the rule as {{"prefix": "yes"}} or {{"prefix": "no"}}, or as {{"all": [...], "any": [...]}}: every "all" string and at least one "any" string must appear in the lowercased answer. Use word stems. Do not use a word that appears in the task itself.
- It does not name a fact's id or quote a fact.

Reply with only JSON: {{"tasks": [{{"id": "t1", "situation": "...", "question": "...", "factIds": ["4"], "rule": {{"all": [], "any": []}}, "pass": "<the correct answer in one sentence>"}}]}}"""

EXTRACTOR = """You are scoring a draft page against its fact sheet. Read no other file, and do not run commands or browse; use only the text below.

Brief the writer received: {brief}

Fact sheet (facts tagged [agent-only] are true but only matter to the subject's maintainers; a reader page should leave them out):
{facts}

The page's worked case: {case}
The concepts the page must teach: {concepts}

Draft page. Each block (a paragraph, list item, table, code block, or heading) starts with its number in square brackets, such as [B4]; the numbers are not part of the page:
<<<PAGE
{page}
PAGE>>>

Report, for every fact id 1 to {nfacts}:
- "present": true when the page states the fact, in whole or as its reader-observable effect.
- "where": "main" when it is stated in the main text; "disclosure" when only inside a collapsed or optional block; "notes" when only in a notes, sources, or further-reading section; "link" when only as link text; "effect_only" when the page states only what a reader observes, not the fact itself; "absent" when not present.
- "block": the number of the first block that states it, such as 4, or null when absent.

Also report:
- "invented_claims": each claim on the page that the fact sheet does not support, quoted briefly. Rewording, headings, transitions, and calls to action are not claims. An example detail that is not on the fact sheet is a claim.
- "sections": the page's top-level sections below the title, in order. Use its second-level headings; when it has none, use its third-level headings. Put any text before the first such heading first, as one section with heading "(opening)". For each: {{"heading": "...", "kind": "opening" | "body" | "notes", "uses_case": true when the section uses the worked case by name or by its specific details}}. "notes" means a notes, sources, references, or further-reading section.
- "concepts": for each concept named above, {{"name": "<the name exactly as written above>", "explained": true when the page explains it, "motivated_first": true when, before or where the page first explains it, the page says what problem it solves or what question it answers}}.
- "ending": what the last "body" section does: "next_action" when it ends on what the reader can now do or where to go next, "summary" when it recaps the sections, or "other".
- "forward_dependencies": each term the page uses in an explanation before it defines it, when the brief's audience would not already know it, quoted briefly.

Reply with only JSON: {{"facts": [{{"id": "1", "present": true, "where": "main", "block": 3}}], "invented_claims": [], "sections": [], "concepts": [], "ending": "other", "forward_dependencies": []}}"""

READER = """You are a first-time reader of the page below. Read no other file, and do not run commands or browse. Use the page alone to do each task. When the page does not give you what you need, answer "Not stated".

<<<PAGE
{page}
PAGE>>>

{tasks}

Reply with only JSON: {{{answers}}}.{yes_no}"""

# Defect questions. "Yes" means the defect is present. Each applies only to the page
# types listed; the calibration step decides which judge counts on which question.
DEFECTS = [
    ("D1", "false_fact", ("tutorial", "how-to", "explanation"),
     "Does the page state something that the fact sheet contradicts or does not support?"),
    ("D2", "buried_key", ("tutorial", "how-to", "explanation"),
     "Does a section put the step or point its reader needs most after less important material?"),
    ("D3", "repetition", ("tutorial", "how-to", "explanation"),
     "Does a passage restate a point that an earlier passage on the page already made?"),
    ("D4", "vague_example", ("tutorial", "how-to", "explanation"),
     "Does the page give an example without the concrete details a reader would need to follow it?"),
    ("D5", "filler", ("tutorial", "how-to", "explanation"),
     "Does the page contain a sentence that adds no information, instruction, or reason?"),
    ("D6", "case_dropped", ("tutorial",),
     "Does the page stop using its worked case partway, so that a later step that applies to the case uses another example or none?"),
    ("D7", "unmotivated", ("explanation",),
     "Does the page explain a concept before it says what problem the concept solves or what question it answers?"),
]

# Sentence-clarity questions from the Federal Plain Language Guidelines (digital.gov).
# "Yes" means the problem is present. Calibrated only on before-and-after sentence pairs.
PLAIN = [
    ("P1", "Does a sentence use the passive voice in a way that hides who does the action?"),
    ("P2", "Does a sentence hide its main action in a noun, such as \"make a determination\" for \"decide\"?"),
    ("P3", "Does a sentence carry more than one main idea?"),
    ("P4", "Does a sentence use a formal, legal, or uncommon word where a familiar one would do, such as \"shall\" for \"must\"?"),
    ("P5", "Does a sentence use a string of three or more nouns in a row, or a double negative?"),
]

JUDGE = """You are checking two drafts written from the same brief for specific problems. Read no other file, and do not run commands or browse; judge only the text below.

Brief: {brief}
Page type: {page_type}

Fact sheet the writers used:
{facts}

<<<DRAFT A
{a}
DRAFT A>>>

<<<DRAFT B
{b}
DRAFT B>>>

For each question, answer separately for draft A and draft B. Answer "yes" only when you can quote the passage that shows the problem, copied exactly from that draft. For a repetition, quote the later passage. Otherwise answer "no" with an empty quote.

{questions}

Reply with only JSON: {{"answers": [{{"q": "D1", "A": "no", "A_quote": "", "B": "yes", "B_quote": "<exact text from draft B>"}}]}}"""

PLAIN_JUDGE = """You are checking pairs of sentences or short passages for specific clarity problems. Read no other file, and do not run commands or browse; judge only the text below.

{pairs}

For each pair, answer each question separately for version A and version B: "yes" when the problem is present, "no" when it is not.

{questions}

Reply with only JSON: {{"pairs": [{{"pair": "1", "answers": [{{"q": "P1", "A": "no", "B": "yes"}}]}}]}}"""

# Every dispatched call gets this one-line task; the prompt itself is in the file.
TASK = ("Read the file {path} and follow it exactly. Write your complete reply, exactly as the file asks for it, "
        "to {out} and write nothing else. Then reply with only the word SAVED.")


def questions(items):
    return '\n'.join(f'- {qid}: {text}' for qid, *_, text in items)


def defect_questions(page_type):
    return [d for d in DEFECTS if page_type in d[2]]


def reader_tasks(tasks):
    return '\n\n'.join(f'Task {t["id"]}: {t["situation"]} {t["question"]}' for t in tasks)


def reader_answers(tasks):
    return ', '.join(f'"{t["id"]}": "..."' for t in tasks)


def yes_no(tasks):
    """Format note for the tasks the key grades by a Yes or No prefix."""
    ids = [t['id'] for t in tasks if 'prefix' in t['rule']]
    if not ids:
        return ''
    which = f'the answer to task {ids[0]}' if len(ids) == 1 else 'the answers to tasks ' + ', '.join(ids[:-1]) + ' and ' + ids[-1]
    return f' Start {which} with Yes, No, or Not stated.'
