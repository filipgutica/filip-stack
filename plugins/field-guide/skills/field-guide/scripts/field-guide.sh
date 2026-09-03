#!/bin/sh

script_directory=$(CDPATH= cd "$(dirname "$0")" && pwd)
plugin_directory=$(CDPATH= cd "$script_directory/../../.." && pwd)

exec /bin/sh "$plugin_directory/scripts/run-node.sh" "$script_directory/field-guide.mjs" "$@"
