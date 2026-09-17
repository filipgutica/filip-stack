# Presentation patterns

Start with behavior and show only the evidence needed to understand it.

Use this slice shape:

```text
Behavior: <what the user or system observes>
Change: <what implements it>
Decision: <why this shape was selected>
Evidence: <smallest code, diff, test, or command proof>
Risk: <material risk or none>
Lesson: <one concept this change teaches>
Example: <concrete input, interaction, or before-and-after behavior>
Try it: <optional local exercise, or worked example when execution adds little value or is unavailable>
Observe: <expected result and how it connects to the implementation>
Question: <one focused acceptance question>
```

Choose one presentation form:

- Use a short code excerpt when one implementation detail is decisive.
- Use a focused inline diff when the before-and-after relationship matters.
- Use a table for three or more items with repeated fields.
- Use a small Mermaid diagram when control flow, data flow, ownership, or state changes are hard to explain linearly.
- Use prose for a simple relationship.

Preserve exact identifiers and commands. Do not paste full files, large diffs, or noisy command output.

Order slices from public behavior and contracts through implementation, tests, and documentation. A file can appear in more than one slice only when different hunks support different behaviors. Account for every changed file before completion.

## Practical lessons

Choose one small exercise that demonstrates the slice's decisive behavior. Establish shared local setup once, then give only slice-specific steps. Ground commands, routes, sample inputs, and breakpoint locations in the inspected repository and selected revision. Verify the local checkout matches that revision before using it to demonstrate the change. Mark missing prerequisites and use a worked example when execution is unavailable; explain the limitation.

Match the exercise to the change:

- **UI:** Give the repository's startup command, local page, exact interaction, and expected visible change.
- **API:** Give the verified local endpoint, sample request, required local setup, and expected status or response fields. Use placeholders for credentials.
- **Debugger:** Name the file and symbol, identify the breakpoint location, and show how to trigger it. Specify values to inspect and what stepping forward demonstrates. Verify debugger setup from repository evidence before prescribing it; refresh locations when the range changes.
- **Test or CLI:** Give the focused command, expected output, and the behavior it proves.
- **Documentation or configuration:** Walk through a concrete input and resulting interpretation or behavior when runtime execution adds little value.

Present exercises for the user to perform. Agent execution requires existing authorization for the action and its effects; the walkthrough itself grants none. Identify writes, external effects, and any cleanup before suggesting an exercise. Prefer an isolated local example when available.

Keep expected results separate from observed results. Attribute observations to the user or an agent command. When results differ, stay on the current slice, inspect the discrepancy, and revise the explanation or record a correction. Let the user skip the exercise and continue discussing the slice. Exercise completion or skipping does not decide acceptance; ask one focused acceptance question when the user is ready to decide.
