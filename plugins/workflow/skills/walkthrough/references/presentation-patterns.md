# Presentation patterns

Start with behavior and show only the evidence needed to understand it.

Use this slice shape:

```text
Behavior: <what the user or system observes>
Change: <what implements it>
Decision: <why this shape was selected>
Evidence: <smallest code, diff, test, or command proof>
Risk: <material risk or none>
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
