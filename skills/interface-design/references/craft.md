# Craft

Rules for making an interface read clearly, adapted from Anthropic's
`frontend-design` skill (see `THIRD_PARTY_NOTICES.md`). The owning design
system wins wherever it sets a rule; these fill the gaps it leaves.

## Emphasis

- Spend emphasis in one place. The primary action on a screen is its most
  prominent element; everything around it stays quiet.
- Before you finish, remove one decoration that does not serve the task.
- Typography carries hierarchy. Use the design system's type scale, keep
  reading lines under about 80 characters, and let weight and size, not
  extra labels, show what matters.

## Structure carries information

- Borders, dividers, numbering, labels, and small headings above content
  must encode something about the content. Decoration that looks structural
  misleads.
- Number items only when they form a real sequence, such as steps or a
  timeline.
- Group by meaning: related items share a region, spacing, or treatment;
  unrelated items do not.

## Motion

- Follow the owning design system's motion rules. `DESIGN.md` keeps content
  visible without entrance or reveal effects.
- Motion that answers a person's action, such as opening, expanding, or
  confirming, is welcome when it shows what changed.
- Honor reduced motion everywhere, including smooth scrolling.

## Interface copy

- Use the user's words for things, not the system's: "notifications", not
  "webhook config".
- A button names its result: "Save changes", not "Submit". Keep the verb
  through the flow, so "Publish" leads to "Published".
- An error says what happened and how to fix it, in the interface's voice.
  It does not apologize and is never vague.
- An empty state invites the next action.
- Use sentence case, active voice, and plain verbs. Give each piece of text
  one job, and cut text that does none.

## Signs of a templated interface

Flag these in a review when they do not serve the content. A design system
may use one deliberately; then it is not a finding.

- A small all-caps label above every heading.
- Numbered markers on content that is not a sequence.
- Content cut into identical cards with the same radius and shadow,
  whatever its importance.
- Gradient washes or glows used as decoration.
- Fade-in entrances on every section, or hover motion on every card.
- An arrow appended to every link or button.
- Metadata strung together with middle dots.
- One word in a headline set apart by color, italics, or weight.

## Build notes

- Watch selector specificity. A section class and an element class that set
  the same spacing can cancel each other out.
- Write real content. Placeholder copy makes a layout look finished when it
  is not.
- Review screenshots at 375px and desktop width, in light and dark, while you
  build, not only at the end.
