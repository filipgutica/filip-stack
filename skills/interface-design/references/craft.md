# Craft

Rules for making an interface read clearly, adapted from Anthropic's
`frontend-design` skill (see `THIRD_PARTY_NOTICES.md`). The owning design
system wins wherever it sets a rule; these fill the gaps it leaves.

## Before you build a new page or screen

- Open with the subject. On a product or landing page, the first screen
  leads with the most characteristic thing in the product's world, such as a
  headline, a live demo, a real product image, or the key evidence. A big number with a small
  label, supporting stats, and a gradient accent is the default first screen;
  use it only when it best serves this subject.
- Sketch first. Write a short plan, in the owning design system's tokens and
  components when there is one: the layout as one-sentence descriptions or an ASCII wireframe,
  its alignment, and the one element that should stand out.
- Check the sketch against the generic default. Keep what the owning design
  system prescribes. Revise each part it leaves free that matches what you
  would produce for any similar brief, say what you changed and why, and then
  build.

## Emphasis

- Spend emphasis in one place. The primary action on a screen is its most
  prominent control. On a product page, one memorable element, such as the
  product image, may lead the page while the primary action stays the most
  prominent control. Everything around them stays quiet.
- Before you finish, remove one decoration that does not serve the task.
- Typography carries hierarchy. Use the design system's type scale, keep
  reading lines under about 80 characters, and let weight and size, not
  extra labels, show what matters.
- Meet the quality floor without announcing it. Responsive layout, visible
  focus, reduced motion, and readable contrast need no badge or callout on
  the page.

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
- Describe what something is or does in plain terms; do not sell it.
  Specific and legible beats clever.
- A button names its result: "Save changes", not "Submit". Keep the verb
  through the flow, so "Publish" leads to "Published".
- An error says what happened and how to fix it, in the interface's voice.
  It does not apologize and is never vague.
- An empty state invites the next action.
- Use sentence case, active voice, and plain verbs, in a tone that fits the
  product and its audience. Give each piece of text one job, and cut text
  that does none.

## Signs of a templated interface

Flag these in a review when they do not serve the content. A design system
may set or record one deliberately, or the brief may ask for one; then it is
not a finding.

- All-caps labels, or a small tracked-out label above every heading.
- A label above content that says nothing the content does not.
- Numbered markers on content that is not a sequence.
- Content cut into identical cards with the same radius and shadow,
  whatever its importance.
- Gradient washes or glows used as decoration.
- Fade-in entrances on every section, or hover motion on every card.
- An arrow appended to every link or button.
- Metadata strung together with middle dots.
- Labels built as "WORD — fragment" with a spaced em dash.
- One word in a headline set apart by color, italics, or weight.
- A monospace face for small data labels.
- A tinted near-black, such as `#111`, standing in for black.
- The default first screen: a big number, a small label, supporting stats,
  and a gradient accent.
- A palette from the common generated set: a warm cream background with a
  high-contrast serif and a terracotta accent (near `#D97757`, Anthropic's
  own accent); a near-black background with one acid-green or vermilion
  accent; or a broadsheet layout with hairline rules, zero radius, and dense
  columns.

## Build notes

- Watch selector specificity. A section class and an element class that set
  the same spacing can cancel each other out.
- Write real content. Placeholder copy makes a layout look finished when it
  is not.
- Review screenshots at 375px and desktop width, in light and dark, while you
  build, not only at the end.
