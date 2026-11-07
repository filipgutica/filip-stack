"""Builds the planted-defect calibration pairs from two reference solutions.

Usage: python build-calibration.py <calibration dir>

The directory holds `true-myth/` and `adaptix/` clones whose HEAD commit is the task's reference
solution on top of the task's base commit. Each pair writes `<pair>/clean.patch` and
`<pair>/defect.patch`, both against the base commit, plus `<pair>/planted.txt`, which names the
defect for scoring only. Judges and the reviewer never see `planted.txt`.
"""

import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])

TRUE_MYTH_SEQUENCE = """export function sequence<T extends {}>(maybes: Iterable<Maybe<T>>): Maybe<T[]> {
  const values: T[] = [];
  for (const m of maybes) {
    if (m.isNothing) return nothing();
    values.push(m.value);
  }
  return just(values);
}
"""

TRUE_MYTH_TEST = """import { describe, expect, test } from 'vitest';

import Maybe, { sequence } from 'true-myth/maybe';

describe('sequence', () => {
  test('collects every Just value in order', () => {
    expect(sequence([Maybe.just(1), Maybe.just(2)])).toStrictEqual(Maybe.just([1, 2]));
  });

  test('returns Nothing when any item is Nothing', () => {
    expect(sequence([Maybe.just(1), Maybe.nothing<number>()])).toStrictEqual(Maybe.nothing());
  });
});
"""

DUPLICATE_TEST = """
describe('sequence with arrays', () => {
  test('gathers Just values', () => {
    expect(sequence([Maybe.just(1), Maybe.just(2)])).toStrictEqual(Maybe.just([1, 2]));
  });

  test('is Nothing if one item is Nothing', () => {
    expect(sequence([Maybe.just(1), Maybe.nothing<number>()])).toStrictEqual(Maybe.nothing());
  });
});
"""

ADAPTIX_COMPONENT = 'src/adaptix/_internal/morphing/name_layout/component.py'
ADAPTIX_VALIDATE_CALL = '        self._validate_aliases(request, fields_to_paths, aliases)\n'


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match for planted edit')
    path.write_text(text.replace(old, new))


def git(repo: Path, *args: str) -> str:
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True, text=True).stdout


def build(name: str, repo: str, planted: str, plant, *, extra=None) -> None:
    """Writes one pair. `extra` adds the same change to both sides, such as a clean test file."""
    clone = root / repo
    git(clone, 'checkout', '-q', '--force', 'HEAD')
    git(clone, 'clean', '-qfd')
    if extra:
        extra(clone)
    git(clone, 'add', '-A')
    clean = git(clone, 'diff', '--cached', 'HEAD~1')
    plant(clone)
    git(clone, 'add', '-A')
    defect = git(clone, 'diff', '--cached', 'HEAD~1')
    git(clone, 'reset', '-q', '--hard', 'HEAD')
    git(clone, 'clean', '-qfd')
    out = root / 'pairs' / name
    out.mkdir(parents=True, exist_ok=True)
    (out / 'clean.patch').write_text(clean)
    (out / 'defect.patch').write_text(defect)
    (out / 'planted.txt').write_text(planted + '\n')


def single_use_layer(clone: Path) -> None:
    replace(clone / 'src/maybe.ts', TRUE_MYTH_SEQUENCE, """class MaybeCollector<T extends {}> {
  private readonly values: T[] = [];

  add(m: Maybe<T>): boolean {
    if (m.isNothing) return false;
    this.values.push(m.value);
    return true;
  }

  result(): Maybe<T[]> {
    return just(this.values);
  }
}

export function sequence<T extends {}>(maybes: Iterable<Maybe<T>>): Maybe<T[]> {
  const collector = new MaybeCollector<T>();
  for (const m of maybes) {
    if (!collector.add(m)) return nothing();
  }
  return collector.result();
}
""")


def dead_helper(clone: Path) -> None:
    path = clone / 'src/toolbelt.ts'
    path.write_text(path.read_text() + """
function allJust<T extends {}>(maybes: ReadonlyArray<Maybe<T>>): boolean {
  return maybes.every((m) => m.isJust);
}
""")


def leaked_internal(clone: Path) -> None:
    replace(clone / 'src/maybe.ts', TRUE_MYTH_SEQUENCE, """/** @internal Reads `.value` without checking; callers must check `isJust` first. */
export function unsafeJustValues<T extends {}>(maybes: ReadonlyArray<Maybe<T>>): T[] {
  return maybes.map((m) => (m as Just<T>).value);
}

export function sequence<T extends {}>(maybes: Iterable<Maybe<T>>): Maybe<T[]> {
  const items = Array.from(maybes);
  if (items.some((m) => m.isNothing)) return nothing();
  return just(unsafeJustValues(items));
}
""")


def add_sequence_test(clone: Path) -> None:
    (clone / 'test/sequence.test.ts').write_text(TRUE_MYTH_TEST)


def duplicate_test(clone: Path) -> None:
    path = clone / 'test/sequence.test.ts'
    path.write_text(path.read_text() + DUPLICATE_TEST)


def adaptix_dead_helper(clone: Path) -> None:
    replace(clone / ADAPTIX_COMPONENT, '    def make_inp_structure(\n', '''    def _alias_count(self, aliases: Mapping[str, tuple[str, ...]]) -> int:
        return sum(len(field_aliases) for field_aliases in aliases.values())

    def make_inp_structure(
''')


def adaptix_single_use_layer(clone: Path) -> None:
    path = clone / ADAPTIX_COMPONENT
    replace(path, ADAPTIX_VALIDATE_CALL, '        AliasValidationRunner(self).run(request, fields_to_paths, aliases)\n')
    replace(path, '@dataclass(frozen=True)\nclass AliasesSchema(Schema):\n', '''class AliasValidationRunner:
    def __init__(self, maker: "BuiltinStructureMaker"):
        self._maker = maker

    def run(
        self,
        request: LocatedRequest,
        fields_to_paths: Iterable[FieldAndPath],
        aliases: Mapping[str, tuple[str, ...]],
    ) -> None:
        self._maker._validate_aliases(request, fields_to_paths, aliases)


@dataclass(frozen=True)
class AliasesSchema(Schema):
''')


build('p1', 'true-myth', 'single-use layer: MaybeCollector class wraps sequence', single_use_layer)
build('p2', 'true-myth', 'dead helper: unused allJust in toolbelt.ts', dead_helper)
build('p3', 'true-myth', 'leaked internal: exported unsafeJustValues', leaked_internal)
build('p4', 'true-myth', 'duplicated test: second describe repeats sequence tests', duplicate_test, extra=add_sequence_test)
build('p5', 'adaptix', 'dead helper: unused _alias_count method', adaptix_dead_helper)
build('p6', 'adaptix', 'single-use layer: AliasValidationRunner forwards to _validate_aliases', adaptix_single_use_layer)
print('built pairs p1-p6')
