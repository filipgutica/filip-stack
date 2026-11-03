// The lesson links these exact files in skills/agent-ready-environments/references.
// Each pillar's anchor is its file name without ".md", so a renamed file must
// fail the build rather than silently change a published anchor.
export const lessonPillars = [
  { number: 1, title: "Code shape", job: "Tell", file: "pillar-1-code-shape.md" },
  { number: 2, title: "Static gates", job: "Check", file: "pillar-2-static-gates.md" },
  { number: 3, title: "Test gates with signal", job: "Check", file: "pillar-3-test-gates.md" },
  { number: 4, title: "Documentation", job: "Tell", file: "pillar-4-documentation.md" },
  { number: 5, title: "Review gates chosen by risk", job: "Check", file: "pillar-5-review-gates.md" },
  { number: 6, title: "Reproducible environment", job: "Check", file: "pillar-6-reproducible-environment.md" },
  { number: 7, title: "Bounded autonomy", job: "Bound", file: "pillar-7-bounded-autonomy.md" },
  { number: 8, title: "Guidance is evaluated", job: "Tell", file: "pillar-8-guidance-evaluated.md" },
] as const;

export const maintenanceFile = "maintenance.md";

/**
 * Throws unless the skill ships every reference the lesson links. Call it from
 * Astro's getStaticPaths: a throw while Vue renders the page is only logged.
 */
export const assertLessonReferences = (references: readonly string[]) => {
  const missing = [...lessonPillars.map(({ file }) => file), maintenanceFile]
    .filter((file) => !references.includes(file));
  if (missing.length)
    throw new Error(`agent-ready-environments has no reference named ${missing.join(", ")}`);
};
