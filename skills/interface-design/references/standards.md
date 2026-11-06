# Standards and review questions

Public standards behind the review questions. The summaries paraphrase their
sources; follow the links for the exact wording. Use WCAG for every numeric
threshold.

## Sources

- **WCAG 2.2, level AA** ([W3C](https://www.w3.org/TR/WCAG22/)). Thresholds:
  text contrast 4.5:1, or 3:1 for large text (24px, or about 18.7px bold);
  3:1 for the visual information needed to identify controls, their states,
  and meaningful graphics, except inactive controls; pointer targets at
  least 24 by 24 CSS pixels, or spaced so a 24px circle centered on each
  does not overlap another target or its circle, except inline links and
  targets whose size the browser sets; content that reflows at 320 CSS
  pixels wide without sideways scrolling, except content such as maps and
  data tables that needs two dimensions; text that resizes to 200% without
  loss; visible focus that other content does not hide.
- **Automated checks find only part of the problem.** Deque's 2021 study of
  about 2,000 audits found that its automated testing covered 57% of
  accessibility issues on average ([Deque](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/)).
  Pair them with task checks and the questions below.
- **Accessibility by task** (Apple, [Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)).
  An app may claim a feature only when people can complete its common tasks
  with that feature on. Apply the same bar on the web: every main task works
  with reduced motion, dark mode, 200% text, and grayscale.
- **Nielsen's 10 usability heuristics** ([NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/)):
  system status, real-world language, user control, consistency, error
  prevention, recognition over recall, efficiency, minimal design, error
  recovery, and help.
- **GOV.UK Design System** ([patterns](https://design-system.service.gov.uk/patterns/))
  and **USWDS** ([patterns](https://designsystem.digital.gov/patterns/)):
  tested patterns for forms, questions, errors, and navigation. Labels sit
  above fields and stay visible; errors appear beside the field and in a
  summary that links to it.
- **Apple Human Interface Guidelines** ([design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)):
  hierarchy, harmony, and consistency. Use HIG platform conventions only for
  Mac or other Apple-platform apps; web work follows web conventions.
- **Cleveland and McGill (1984)**, graphical perception: people judge
  position on a common scale most accurately, then length, then angle and
  slope, then area, then volume and color shade. Encode the most important
  comparison with the most accurate channel.
- **Chartability** ([chartability.fizz.studio](https://chartability.fizz.studio/)):
  50 accessibility heuristics for charts and data interfaces, with a
  shortlist of 14 tests for a quick audit.
- **Draco** ([uwdata.github.io/draco](https://uwdata.github.io/draco/)):
  visualization design knowledge written as constraints over Vega-Lite
  specifications. A hard-constraint violation means the chart breaks one of
  the model's validity or design rules; call a chart misleading only with
  evidence of what a reader would misjudge.
- **VLAT and Mini-VLAT** ([arXiv:2304.07905](https://arxiv.org/abs/2304.07905)):
  measures a reader's chart literacy with tasks such as value lookup,
  comparison, and trend. Use those task types as comprehension probes; a
  wrong answer is evidence to investigate, not proof of a chart defect.

## Review questions

Answer each question that applies with yes or no, and quote the element or
name the screen region that decides it. A "no" is a finding; rank findings by
user impact.

### Hierarchy and copy

1. Within each decision group, is the primary action the most prominent
   control, and does the screen's hierarchy follow the user's task? Name the
   action and the focal element. (Apple HIG hierarchy, owning design system)
2. Does only one element compete for first attention? (UX laws: Von Restorff)
3. Do labels and messages use the user's words rather than system terms?
   (Nielsen 2)
4. Does each button name its result, and does the flow keep that verb?
   (craft.md)

### Flow and control

5. Can the user tell what the system is doing right now, including during
   loading? (Nielsen 1)
6. Can the user cancel, go back, or undo without losing work? (Nielsen 3)
7. Does the screen show the options and information needed, rather than
   relying on memory from an earlier step? (Nielsen 6)
8. Do equivalent controls look and behave the same across screens?
   (Nielsen 4)

### Forms, errors, and states

9. Does every field have a visible label that stays when the user types,
   placed as the pattern for that control places it: above text inputs and
   selects, beside checkboxes and radios? (GOV.UK, USWDS)
10. Does each error say what went wrong and how to fix it, next to the field?
    (Nielsen 9, GOV.UK)
11. Do empty, error, and success states exist and point to a next step?
    (craft.md)
12. Does the design prevent the likely mistake rather than only report it?
    (Nielsen 5)

### Accessibility

13. Do text and the visual information needed to identify each control and
    its state meet the WCAG contrast thresholds in both themes, apart from
    the documented exceptions? (WCAG 1.4.3, 1.4.11)
14. Is keyboard focus visible on every interactive element and never hidden?
    (WCAG 2.4.7, 2.4.11)
15. Is each pointer target at least 24 by 24 CSS pixels, or does it pass the
    24px circle spacing test, apart from the documented exceptions?
    (WCAG 2.5.8)
16. Does the content reflow at 320 CSS pixels wide without sideways
    scrolling, apart from content that needs two dimensions, and work with
    text at 200%? (WCAG 1.4.10, 1.4.4)
17. Is every state or series told apart by more than color? (WCAG 1.4.1)
18. Does motion stop or reduce when reduced motion is on? (Apple labels,
    WCAG 2.3.3)

### Charts

19. Does the most important comparison use position or length on a shared,
    zero-based axis where bars are used? (Cleveland and McGill)
20. Does the chart use one y-axis, a readable number of parts, and a palette
    that does not depend on hue alone? (Chartability shortlist, Draco)
21. Are units, the legend, and the labels next to the data they describe?
    (Chartability)
22. Could a reader look up a value, compare two values, and name the trend
    from the chart alone? (VLAT)
