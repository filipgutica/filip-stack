#!/bin/sh
# Wait for n running calls, then print the next batch compactly: request id, target, prompt path.
cd "$(dirname "$0")"
python3 -B runner.py wait paid-run 580 "${1:-8}" && python3 -B runner.py next paid-run | python3 -c "
import sys,json
for l in sys.stdin:
    o=json.loads(l); t=o['target']; print(o['clientRequestId'], t['model'], t['options'].get('reasoningEffort', t['options'].get('effort')), o['task'].split('\`')[1], 'BUILD' if 'one file it names' in o['task'] else 'SCORE')"
