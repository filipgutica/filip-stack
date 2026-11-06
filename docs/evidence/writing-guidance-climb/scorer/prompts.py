# Prompt templates for the writing-guidance climb. A build prompt differs between versions
# only by its guidance file path. A reader prompt gets only the page and the tasks.

BRIEF_WRITER = """You write test material for a documentation study. Read no other file, and do not run commands, browse, or use any skill; use only this text.

Write {n} briefs, one for each page type: {types}. Use page types as Diataxis defines them: a tutorial teaches a newcomer by doing one worked case; a how-to guide helps a competent user reach one goal; a reference describes options or parts for lookup; an explanation helps a reader understand why something works as it does.

Each brief is for a fictional developer tool, library, or service, with invented names, so no reader can know the facts already. Make the subjects ordinary developer documentation: a command-line tool, a config file, a library API, a deploy or sync service.

A writer gets the brief and its sources, not a clean list of facts. Make the sources look like what a writer really works from, 900 to 1,300 words in all, in 3 to 5 named parts chosen from: command help output, a config schema or code excerpt, a changelog, an issue or chat thread, a design note, maintainer notes. Build in these traps, each settled clearly by the sources:
- A default or behavior that a later changelog entry changed. The old value still appears in an older part.
- An exception or condition that appears only in a thread or note, not in the help output.
- A failure and its recovery, stated in a different part from the procedure it interrupts.
- Maintainer-only detail that a reader page should leave out: build internals, team names, release logistics.
- Material that is true but matters little to this page's reader.

For each brief give:
- "id": {ids} in order.
- "type": the page type.
- "wordLimit": a whole number from 350 to 500.
- "brief": two sentences: what page to write, for which reader, and "Keep the page under <wordLimit> words."
- "sources": [{{"name": "...", "text": "..."}}].
- "tasks": 5 reader tasks. A task is a situation and a question that a real reader of this page would bring to it. Make them depend on the traps, so a page that copies the older value, drops the exception, or omits the recovery fails some:
  - Each needs 1 to 3 facts that the sources settle. Give "evidence": the exact source passages, copied, that settle the answer.
  - At least one task turns on the changed default; one on the exception from the thread or note; one on the failure and its recovery; one combines two facts into a decision or a computed value.
  - No task needs maintainer-only detail.
  - The answer is short and can be checked by text patterns: either it starts with Yes or No, or it contains specific words. Give the rule as {{"prefix": "yes"}} or {{"prefix": "no"}}, or as {{"all": [...], "any": [...]}}: every "all" item and at least one "any" item must appear in the lowercased answer. An item is a string or a list of alternatives, any one of which counts. Use word stems. For every number give the digits and the word, such as ["4", "four"]. For every key word give its common synonyms, such as ["batch", "group"]. Leave "any" empty unless it is needed.
  - The task does not quote a source.

Reply with only JSON: {{"briefs": [{{"id": "...", "type": "...", "wordLimit": 400, "brief": "...", "sources": [{{"name": "...", "text": "..."}}], "tasks": [{{"id": "t1", "situation": "...", "question": "...", "evidence": ["..."], "rule": {{"all": [["4", "four"]], "any": []}}, "pass": "<the correct answer in one sentence>"}}]}}]}}"""

BUILD = """Read the file `{file}` and follow it (skip this step when the file is empty). Read no other file, and do not use any skill or plugin. {brief} Use only what the sources below support; do not add facts. Reply with the page as Markdown and nothing else. Do not edit any file except the reply file your task names, and do not start subagents or browse.

Sources:
{facts}"""

READER = """You are a first-time reader of the page below. Read no other file, and do not run commands, browse, or use any skill. Use the page alone to do each task. When the page does not give you what you need, answer "Not stated".

<<<PAGE
{page}
PAGE>>>

{tasks}

For each task, give your answer, and copy exactly from the page the passages that gave you the facts you used. For each fact, copy the first place on the page that states it. Keep each passage short: one sentence, list item, or table row.

Reply with only JSON: {{{answers}}}.{yes_no}"""

CODER = """You are doing error analysis for a documentation study. Read no other file, and do not run commands, browse, or use any skill; use only this text.

Writers turned the sources below into pages for this brief: {brief}
Page type: {page_type}

Sources:
{facts}

A first-time reader then did 4 tasks with each page. Below are the pages, each followed by the tasks the reader failed, or passed only after reading deep into the page. "Depth" is the number of words from the top of the page through the passage that gave the reader the last fact it needed.

{cases}

For each listed case, say why the page made the task fail or take long. Use one of these codes, or "other" with a short name:
- missing: the page does not state a needed fact.
- stale: the page states an older value or behavior that the sources say changed.
- buried: the fact is there, but after material the reader did not need for the task.
- split: the facts the task needs are far apart, and nothing links them.
- condition_late: a condition or exception comes after the action it controls.
- wrong_place: the fact sits in a section a reader would not look in for this task.
- ambiguous: the wording allows a wrong reading.
- reader_error: the page is clear, and the reader erred.

Then list the 3 page-level problems that cost readers the most across these pages, each with the pages it affects, and the behavior a writer should produce instead, written as an instruction for this page type.

Reply with only JSON: {{"cases": [{{"case": "c1", "code": "buried", "evidence": "<short quote from the page>", "note": "..."}}], "problems": [{{"problem": "...", "pages": ["p1"], "instead": "..."}}]}}"""

# Every dispatched call gets this one-line task; the prompt itself is in the file.
TASK = ("Read the file {path} and follow it exactly. Write your complete reply, exactly as the file asks for it, "
        "to {out} and write nothing else. Then reply with only the word SAVED.")


def reader_tasks(tasks):
    return '\n\n'.join(f'Task {t["id"]}: {t["situation"]} {t["question"]}' for t in tasks)


def reader_answers(tasks):
    return ', '.join(f'"{t["id"]}": {{"answer": "...", "passages": ["..."]}}' for t in tasks)


def yes_no(tasks):
    ids = [t['id'] for t in tasks if 'prefix' in t['rule']]
    if not ids:
        return ''
    return f' Start the answer to {", ".join(ids)} with Yes or No.'
