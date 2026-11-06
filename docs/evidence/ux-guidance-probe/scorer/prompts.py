# Prompt templates. Every arm gets the same prompt apart from its guidance folder name, which is random.
# Judges get the hill-climb judge brief with its UI, fresh-start, and scorecard lines filled in.

REVIEW = """Read every file in `{guide}` and follow it (skip this step when the folder is empty).

Then review the screen in `task/`: `task/page.html` and the CSS and JavaScript it loads, the app's design system in `task/DESIGN.md`, `task/tokens.css`, and `task/app.css`, and the screenshots in `task/shots/` (desktop in light and dark themes, and a 375 px phone in light). The app supports light and dark themes and must work on phones. You cannot run a browser or shell commands here. Read only files in this folder. Do not edit any file.

Report the problems a user would hit on this screen, most important first, one per line, in this form and nothing else:
FINDING | <element: a CSS selector or the quoted visible text> | <the problem, in one sentence> | <the fix, in one sentence>
If you find no problems, reply NONE."""

BUILD = """Read every file in `{guide}` and follow it (skip this step when the folder is empty).

Then do the task in `app/BRIEF.md`. The app is in `app/`. Change only files in `app/`. You cannot run a browser or shell commands here. Read only files in this folder.

When you finish, reply with a short summary of what you built."""

CRITERIA = """# Criteria

The task is in `tasks/BRIEF.md`; the app's design system is `tasks/DESIGN.md`, `tasks/tokens.css`, and `tasks/app.css`.

C1 Task: a developer can create a key, copy its secret, and see their keys.
C2 States: the empty, validation error, server error, success, and populated states each tell the user what happened and what to do next.
C3 Access: text and controls stay readable and usable at 375 px, in dark theme, and for keyboard and screen-reader users.
C4 Fit: the screen uses the app's design system: its tokens, shared components, and conventions.

Screenshots are named `<state>-<view>.png`. States: s1-empty, s2-validation (Create key pressed with no name), s3-server-error (create failed), s4-success (key created), s5-populated (three keys). Views: 1280-light, 375-light, 375-dark.
"""

# hill-climb SKILL.md "Judge brief", with the UI and fresh-start lines in place of the code and text lines,
# and the scorecard lines in place.
JUDGE = """Judge only. Do not edit files or start subagents.
Use only the files in {bundle}. Do not read the working tree or the repository.
A and B are two versions of the same change.
A/ and B/ hold the screenshots that differ, with matching names.
A-files/ and B-files/ hold each version's copy of the files that differ, in place of A.diff and B.diff.
Compare them against each criterion in criteria.md, then overall.
Answer A, B, or SAME (no meaningful difference), with one reason each.
Then name one improvement you would make next to the version you prefer.
Rate each screen (or task) in each version from 0 to 10, and name its biggest remaining issue. 10: nothing to fix. 8: minor polish. 6: a user would notice a problem. 4: a task is harder than it should be. 2: a task fails.
If you could not open a bundle file, list it under UNREAD.
Reply:
C1 <criterion>: A|B|SAME - <reason>
C2 <criterion>: A|B|SAME - <reason>
C3 <criterion>: A|B|SAME - <reason>
C4 <criterion>: A|B|SAME - <reason>
OVERALL: A|B|SAME - <reason>
NEXT: <one improvement>
SCORE <screen>: A <0-10> - <issue> | B <0-10> - <issue>
(one SCORE line for each of s1-empty, s2-validation, s3-server-error, s4-success, s5-populated)
UNREAD: <files, or none>"""

# Codex judges get the same brief. Their screenshots are attached in the order listed, and their text
# files are inline, because the dry run could not confirm file tools for them without a paid call.
CODEX_ATTACHED = """

The bundle's screenshots are attached as images, in this order: {images}.
The bundle's text files follow.
{files}"""
