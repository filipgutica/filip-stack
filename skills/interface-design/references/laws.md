# UX laws reference

Use this as a selection guide. A law is relevant only when it helps the current user and task. The summaries are adapted from [Maze's collection of 21 UX laws](https://maze.co/collections/ux-ui-design/ux-laws/).

## Expectations and perceived usability

- **Jakob's Law:** Reuse familiar interaction patterns so users can transfer existing mental models. Check that familiarity does not preserve an inaccessible or harmful convention.
- **Aesthetic-Usability Effect:** Visual polish can increase perceived usability and tolerance of minor friction. Never let polish conceal actual usability defects.

## Cognitive load and simplicity

- **Hick's Law:** More or harder-to-compare choices increase decision time. Reduce, group, stage, or recommend choices without hiding necessary options.
- **Miller's Law:** Working memory is limited. Chunk information and keep needed context visible; do not treat seven items as a universal hard limit.
- **Law of Prägnanz:** People interpret complexity as the simplest stable form they can find. Prefer clear shapes, hierarchy, and recognizable controls.
- **Occam's Razor:** Prefer the least complicated design that fully supports the user goal. Remove elements only when function, clarity, and recovery remain intact.
- **Tesler's Law:** Some complexity is intrinsic. Move it to the system when the system can handle it reliably instead of merely shifting it to another user step.

## Grouping and emphasis

- **Law of Common Region:** Elements inside the same boundary appear related. Use containers or backgrounds when a meaningful group needs definition.
- **Law of Proximity:** Nearby elements appear related. Use spacing to communicate relationships and separate unrelated controls.
- **Law of Uniform Connectedness:** Visually connected elements appear more related. Use lines, containers, or shared treatment for actual relationships.
- **Law of Similarity:** Elements with similar appearance are assumed to share meaning or behavior. Keep equivalent controls consistent and make different behaviors distinguishable.
- **Von Restorff Effect:** An item that differs from its peers attracts attention and is more memorable. Reserve distinction for the primary item; competing emphasis destroys the effect.

## Action and feedback

- **Fitts's Law:** Targets are easier to acquire when they are large and near the user's current position. Prioritize generous hit areas, spacing, and reachable placement.
- **Doherty Threshold:** Fast, visible feedback helps interaction feel responsive. Acknowledge input immediately and show honest progress when work continues; avoid decorative delay.
- **Goal-Gradient Effect:** Visible progress can increase motivation as completion approaches. Show accurate steps or remaining work without manipulating users into unwanted completion.
- **Parkinson's Law:** Tasks tend to fill the time available. Remove avoidable steps and match completion time to user expectations established through evidence.

## Memory and motivation

- **Serial Position Effect:** People tend to remember the first and last items in a sequence. Place important content deliberately, but do not rely on position alone for discovery.
- **Peak-End Rule:** Memorable high points and the ending disproportionately shape retrospective judgment. Protect critical moments and make completion, failure, and recovery clear and humane.
- **Zeigarnik Effect:** Incomplete tasks can remain more memorable than completed ones. Preserve progress and offer a clear return path; never manufacture anxiety or fake incompleteness.

## Robustness and prioritization

- **Postel's Law:** Accept reasonable input variation while keeping output predictable. Normalize safely, explain constraints, and never weaken validation or security.
- **Pareto Principle:** A small set of flows often creates most user value. Use observed behavior and product goals to prioritize; do not invent an 80/20 split without data.

## Verification prompts

- Can the user identify the primary action and predict its result?
- Are related items grouped and equivalent controls consistent?
- Is any element competing with the intended point of emphasis?
- Can the user complete, cancel, recover, and resume the task?
- Does feedback accurately represent system state?
- Which assumption needs a prototype or usability test rather than another heuristic?
