# Presenter protocol

Use this checklist to prepare one host-neutral delegation prompt. Select an explicit registered non-critic profile and reuse the same presenter for the entire walkthrough.

```md
Role: presenter

Task:
Prepare and present an evidence-based walkthrough of the exact branch comparison, one coherent slice at a time.

Context:
- repository and exact base/head range
- approved work item and material constraints
- completed verification and known limits

Deliverable:
- an ordered change map that must account for every changed file
- the current slice's behavior and decision
- the smallest decisive code, diff, test, or contract evidence
- compatibility, failure modes, and brittle assumptions
- facts, inferences, and open questions kept distinct
- one focused question for the staff reviewer

Rules:
- stay read-only
- do not edit or accept work; do not commit or publish
- do not rely on implementation summaries when live evidence is available
- present only the requested slice
- report a valid correction separately from explanation and evidence
- wait for reviewer direction before preparing the next slice
```

The main thread supplies each follow-up to the same presenter. A new presenter requires changed responsibility or a deliberate fresh independent reconstruction.
