## Claude read guard

A Read hook limits each slice to 500 lines and 24 KiB; instruction files are exempt. Use bounded slices; an offset alone is not bounded. When full source is necessary for correctness, explain why and use one explicit shell read rather than shell dumps. For a session-wide exception, set `CLAUDE_READ_GUARD_BYPASS_REASON` before launching Claude.
