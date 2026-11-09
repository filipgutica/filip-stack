# Shared preference transport

This route refreshes the existing chezmoi transport for `field-guide.json`. It preserves local Field Guide records and leaves unrelated dotfiles alone. A caller's narrower setup-phase instruction takes precedence.

For inspection, read existing source identity/status and local preference counts only. Report absent or stale source as unverified. Keep the updater in `--dry-run`; leave pulling, initialization, import, export, and target replacement to an authorized refresh.

For a refresh:

1. Check whether chezmoi is already initialized. If its command, config, or source is absent, report preference transport as uninitialized. Do not run `chezmoi init` or install packages during refresh.
2. Record the source branch, commit, and dirty paths. Run `chezmoi update --apply=false` to pull its configured source without applying other targets or running their scripts. Stop this route on conflicts; preserve them without reset or force. Continue independent filip-stack components.
3. Resolve the source for `~/.config/filip-stack/field-guide.json` with `chezmoi source-path`, respecting `XDG_CONFIG_HOME`. If it is not managed, report transport as unconfigured and keep the local refresh. Only this existing preference file is in scope. If retrieving it would invoke a secret manager or needs new credentials, leave transport blocked; follow the host's credential rules before any lookup.
4. Snapshot the existing local preference file, when present. Write `chezmoi cat <preference-target>` to a separate temporary source input. Retain both originals until verification. Check each input's portable format against the selected checkout's `validatePortableSharedGuidance` contract before combining them; reject unsupported versions, unknown fields, and malformed arrays.
5. Construct one temporary merged portable file: `schemaVersion: 1`, both inputs' `active` records concatenated, and the deduplicated union of their `retired` fingerprints. Treat an absent local file as empty. Import this combined input once so the owner applies retirement precedence across both inputs; sequential imports can reactivate a record retired by the other input.
6. Use the selected checkout's source-owned CLI at `plugins/field-guide/skills/field-guide/scripts/field-guide.mjs`. Read its current command contract if it differs. Pass `--repo-root <checkout>` and `--guide-root <home>/.field-guide` on each call:

   ```text
   init
   import --input <temporary-merged-preference-file>
   export --output <temporary-merged-preference-file>
   ```

   Inspect import results before export. Retain the originals and block target replacement on rejected or skipped records; idempotent no-ops are expected. Use the merged file as the export seed: the owner preserves unknown retirement fingerprints from its output file, not from memory. Verify the export retains the union of retirement fingerprints and the owner's accepted active records. Replace the preference target atomically only if the original local target is still unchanged. Preserve a concurrent edit as a conflict. Do not run a later full refresh that could overwrite unresolved preference input. The regular sync imports/exports the successfully merged local file idempotently.
7. Report the dotfiles source commit, active/retired counts, and any unapplied local changes. The exported union may differ from the Git source when local guidance is unpublished; preserve it and say so. Do not commit, push, or re-add unrelated dotfiles. Remove temporary inputs after verification.

If every target is expected to be current after a separate authorized chezmoi setup, run its full `chezmoi status` check too. A fleet preference refresh alone does not assert that unrelated dotfiles are synchronized.
