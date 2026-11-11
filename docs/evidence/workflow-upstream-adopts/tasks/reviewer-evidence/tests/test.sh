#!/bin/sh
# This reward checks report delivery only. Behavior needs the native trace audit.
mkdir -p /logs/verifier
if test -s /logs/artifacts/handoff.md; then
  printf '1\n' > /logs/verifier/reward.txt
else
  printf '0\n' > /logs/verifier/reward.txt
fi
