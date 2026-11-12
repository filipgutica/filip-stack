# Tickets

Draft tickets for the tracker that owns the work, such as Jira or GitHub issues. Return the draft in conversation, or write it to the tracker when the user asks. Do not create local ticket files or mirror tracker status.

Create one ticket for one independently reviewable outcome. To break a specification into tickets, create one ticket per independently owned outcome, not one per implementation step. Keep implementation steps inside the story. Add a subtask only when part of a story needs separate ownership. Add a dependency only when another ticket produces required input.

## Mark what you could not verify

Draft the ticket even when some facts are unverified. Mark each unverified owner, location, or behavior inline as `TBD: <what to check>`. Do not present a guess as an instruction. When the work itself is to find a cause or an owner, write the ticket as an investigation with its own acceptance criteria.

Include a ticket key, parent, relationship, or code link only when you verified it. Link code with a repository URL, ref, and path, and add a line anchor only when you verified it. Never put a machine-local path in a ticket.

## Default formats

Use the tracker's or the repository's template when one exists. Otherwise use these. Acceptance criteria describe behavior that someone can observe. Do not repeat a criterion in Notes.

### Story or issue

```md
## Goal
<One outcome, in one or two sentences.>
## Acceptance criteria
- [ ] <Observable condition.>
## Notes
<Optional: context, links, non-goals, and TBD items.>
```

### Bug

```md
## Observed behavior
<Actual and expected behavior, with reproduction steps.>
## Acceptance criteria
- [ ] <Observable condition after the fix.>
## Notes
<Optional: environment, root-cause evidence with suspected causes labeled, and links.>
```

### Epic or parent

```md
## Goal
<Shared outcome.>
## Children
| Story | Repository | Depends on |
| --- | --- | --- |
| <Short descriptive name, linked when it exists> | <repository> | <story or none> |
## Acceptance criteria
- [ ] <Condition for the overall outcome.>
```

### Example story

```md
## Goal
Let users copy an export job's identifier from its details page.
## Acceptance criteria
- [ ] The copy action beside the identifier copies it and confirms success.
- [ ] A clipboard failure shows an error and leaves the identifier selectable.
## Notes
Out of scope: export creation and identifier format.
```
