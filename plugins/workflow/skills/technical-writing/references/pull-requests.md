# Pull request descriptions

Read applicable repository and project guidance before writing. Explicit user instructions take precedence; follow the repository's required headings, checklists, and format, fitting the content below into that structure.

## Default structure

```md
## Description
<Short explanation of the problem and resulting behavior.>

## Changes
- <Meaningful change>

## Verification
1. <Concrete reviewer action, with setup when necessary.>
2. <Expected result.>
```

- **Lead with the why.** One or two sentences: the problem and the resulting behavior. Leave out the implementation history.
- **Write for the team.** Leave out background reviewers already know, such as how the platform, config, or flags work. Describe only what this PR changes.
- **One bullet per behavior.** Bold the area, then one plain sentence with the rule as a reviewer sees it. Leave out conditions and internals that don't change that behavior.
- **Simplest proof.** Each verification step is the smallest check that shows the behavior works.
- Make verification useful to a human. Include runnable commands or requests for backend, API, or CLI changes, with necessary setup and expected results. Verify commands, endpoints, inputs, and claimed results against the actual change; identify any remaining uncertainty.
- For visual changes, add screenshots where they demonstrate the result: before and after when comparison helps, or after only when sufficient. Use one image per state, labeled by state. Put states of the same screen side by side in a table. Relabel an existing image when it already shows another state. Mixed changes can use both screenshots and commands.
- Add a Screenshots section only when relevant media is available. Preserve existing user-added images, videos, and other media when updating a description.
- Leave out Risks, limits, and post-merge task sections unless the user asks for them. Tell the user about material review concerns or required follow-ups before or when opening the PR. Omit empty optional sections.
- Avoid repeating routine checks or results that CI already reports. State a material verification gap when it affects review.
- Before creating or updating the PR, check the complete body against repository guidance, this reference, and the current diff. Verify required structure, completed sections without placeholders, concrete reviewer actions and expected results, and preservation of existing user-added media; fix gaps before publishing. If required guidance is unavailable, report the blocker and do not create or update the PR. Writing a draft does not authorize publication.
- After publication, fetch the saved body, recheck the same requirements, and correct mismatches before reporting completion.

## Example

Illustrative backend change; use the actual project's setup, endpoint, fixture data, and expected result in a real PR.

````md
## Description
Fix pagination so requesting a later page returns the correct widgets.

## Changes
- Apply the requested offset when retrieving widgets.

## Verification
1. Start the local API with five widgets ordered by ID and set `API_BASE_URL` to its address.
2. Request the second page:

   ```sh
   curl --fail-with-body "$API_BASE_URL/widgets?limit=2&offset=2"
   ```

3. Confirm the response contains the third and fourth widget IDs, with no IDs from the first page.
````
