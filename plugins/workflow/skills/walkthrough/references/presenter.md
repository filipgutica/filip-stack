# Read-only presenter

Use a fresh presenter context for an automated agent walkthrough. The presenter explains the change. It does not implement, independently review, or accept it.

Give the presenter:

- the user goal and non-goals
- the exact base and head or working-tree source
- the changed files
- relevant tests and verification evidence
- the presentation pattern
- the next unresolved slice after the first response

Ask the presenter to build an ordered change map that accounts for every changed file. For each turn, it returns one slice with behavior, decision, decisive evidence, verification limits, risk, and one question.

The main thread checks the cited evidence before presenting or accepting it. Keep the same presenter for clarification and later slices so its responsibility stays stable.

The presenter must not:

- edit files or external systems
- run destructive commands
- commit, push, publish, or deploy
- accept its own explanation
- treat a passing test as proof of every behavior
- invent a product or architecture decision

When it finds a possible problem, return the evidence to the main thread. The main thread classifies the concern and returns material decisions to the user.
