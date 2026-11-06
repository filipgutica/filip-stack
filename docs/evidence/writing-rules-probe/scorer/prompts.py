"""Frozen prompts. Builders see sources and one arm; readers see only page and scenario."""

BUILD = """Role: Implementer (documentation builder). Use only this prompt and the one named
guidance file. Read no repository instructions, skills, other files, or previous study results.
Start no agents, browse nothing, run no commands except reading the named guidance and saving
your reply. You are not alone in the codebase; edit no repository file or another agent's work.
Read {guidance} and follow it; an empty file means no guidance.
{brief}
Use only the sources below. Write the page, not an evaluation report. Return Markdown only.

{sources}
"""

READER = """You are a first-time reader carrying out one task using only this page.
Read no files, browse nothing, run no commands, use no skills, and start no agents.
The scenario states the initial conditions, not facts about how the tool works.
Use the page alone to produce an ordered execution plan. Do not invent missing instructions.
When an action or completion condition is missing, list it under notStated.
Use one simple command invocation per step, without shell loops, chaining, or placeholders.
Include the instructions for completing interactive commands in action. For a status command,
put the required observed result in observe and explain any polling in action. Observations
describe conditions to check, not claims that you have actually run the fictional tool.
For a nonempty returned URL use "NONEMPTY" as its value. Use the page's field names.
Copy a short exact quotation supporting each step. You may combine adjacent page passages.
Prose and command quoting may vary; the evaluator interprets command operations and arguments.
Reply only JSON: {{"steps":[{{"action":"...","command":"...","observe":{{}},
"quote":"..."}}],"notStated":[]}}.

Starting state: {startingState}
Goal: {goal}

<<<PAGE
{page}
PAGE>>>
"""

ITEMS = {
    "path": "Is optional command/feature reference placed before the complete ordered main task path, or is the path interrupted/missing its execution-to-confirmation transition? Judge main task actions here; prerequisite placement belongs to entry. A tutorial's learning sequence is valid; do not demand that it put results first.",
    "entry": "Are necessary start requirements absent or separated from the entry point: prerequisites, installation/activation, authentication and first invocation? When both session and future-session setup matter, does the entry distinguish them? Judge the page's stated starting state; do not demand installation on an already installed machine.",
}

JUDGE = """Role: Reviewer (blinded documentation judge). Use only the supplied text.
Read no other file, browse nothing, use no skills and start no agents. Edit no repository file.
For each labeled page and each item, return defect true or false, an exact supporting quote,
and a short reason. For an omission quote the nearby step where the requirement is needed.
For no defect use an empty quote. Do not infer which treatment produced a page.
Do not penalize a tutorial for teaching in learning order or for putting confirmation last.
Compare only these two items, not overall style. The page labels have no intrinsic order.

Items:
{items}

{pages}

Reply JSON only: {{"pages":[{{"label":"A","path":{{"defect":false,"quote":"","reason":"..."}},
"entry":{{"defect":false,"quote":"","reason":"..."}}}}]}}.
"""

TASK = "Read only {prompt} and follow it exactly. Your only permitted write is your complete response to {reply}. Then reply SAVED. No agents or repository edits."
