# Successful-patch quality report

This offline comparison analyzes only attempts that the official SWE-bench summaries mark resolved in both arms.
It reports separate size, structure, and reuse metrics; it does not calculate a composite quality score.
Task ID and ordinal attempt number align saved artifacts and official outcomes for bookkeeping only; alignment does not imply shared randomness or justify a paired-effect estimate.

## Population

| Measure | Count |
| --- | ---: |
| Baseline verifier attempts discovered | 5 |
| Treatment verifier attempts discovered | 5 |
| Baseline resolved verifier attempts | 5 |
| Treatment resolved verifier attempts | 5 |
| Aligned attempts | 5 |
| Matched-success alignments | 5 |
| Excluded alignments | 0 |
| Matched-success fraction | 1 (5/5) |

## Median metrics

| Metric | Baseline | Treatment | Treatment - baseline median |
| --- | ---: | ---: | ---: |
| binary_patch | 0 | 0 | 0 |
| churn | 10 | 7 | -3 |
| class_definition_delta | 0 | 0 | 0 |
| dependency_manifest_files_changed | 0 | 0 | 0 |
| duplicate_new_function_body_count | 0 | 0 | 0 |
| empty_patch | 0 | 0 | 0 |
| existing_local_symbol_call_delta | 0 | 0 | 0 |
| explicit_decision_point_delta | 1 | 1 | 0 |
| files_changed | 1 | 1 | 0 |
| function_definition_delta | 0 | 0 | 0 |
| import_statement_delta | 0 | 0 | 0 |
| lines_added | 9 | 7 | -2 |
| lines_removed | 1 | 1 | 0 |
| new_helpers_called_at_least_twice_count | 0 | 0 | 0 |
| new_single_use_helper_count | 0 | 0 | 0 |
| new_top_level_public_symbol_count | 0 | 0 | 0 |
| production_python_files_changed | 1 | 1 | 0 |
| python_ast_available | 1 | 1 | 0 |
| python_files_analyzed | 1 | 1 | 0 |
| python_parse_error_count | 0 | 0 | 0 |
| source_churn | 8 | 7 | -1 |
| source_files_changed | 1 | 1 | 0 |
| source_lines_added | 7 | 7 | 0 |
| source_lines_removed | 1 | 1 | 0 |
| test_churn | 0 | 0 | 0 |
| test_files_changed | 0 | 0 | 0 |
| test_lines_added | 0 | 0 | 0 |
| test_lines_removed | 0 | 0 | 0 |

## Aligned official outcomes

| Task | Attempt | Baseline | Treatment | Included |
| --- | ---: | --- | --- | --- |
| pytest-dev__pytest-5787 | 1 | resolved | resolved | yes |
| pytest-dev__pytest-5787 | 2 | resolved | resolved | yes |
| pytest-dev__pytest-5787 | 3 | resolved | resolved | yes |
| pytest-dev__pytest-5787 | 4 | resolved | resolved | yes |
| pytest-dev__pytest-5787 | 5 | resolved | resolved | yes |

## Limits

- Only aligned attempts resolved in both arms are included in code-quality metrics.
- Ordinal attempt alignment is bookkeeping only and does not imply shared randomness or a paired effect.
- Correction turns and human review time are not measured.
- Use the normal PluginBench reports for token, cost, and latency measurements.
- The report exposes separate proxies and does not calculate a composite quality score.

Source lines are non-test files with common programming-language suffixes. Test paths use test/spec directory and filename conventions.
Python decision points count conditionals, loops, exception handlers, match cases, boolean branches, and comprehension filters.
Existing-local-symbol calls mean calls to functions or classes that already existed in the same changed Python module.
New-helper call counts report syntactic calls by function name within the same final changed module.
New top-level public symbols are new function or class definitions whose names do not start with an underscore; dynamic exports are not interpreted.
