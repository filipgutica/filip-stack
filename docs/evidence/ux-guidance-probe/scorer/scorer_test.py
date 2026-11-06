"""Free owner-boundary regressions. Run: python3 -B scorer_test.py."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('probe', Path(__file__).with_name('probe.py'))
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class ScorerContracts(unittest.TestCase):
    def test_saturation_retains_no_harm_and_build_success(self):
        # Score real run artifacts; judge popularity must not rescue review harm or failed builds.
        with tempfile.TemporaryDirectory() as run:
            def write(name, value):
                probe.dump(f'{run}/{name}', value)
            write('ledger.json', [
                {'id': f'{arm}-{n}', 'arm': arm, 'task': task}
                for arm in probe.ARMS for task, n in [('R1', 0), ('B1', 1), ('B1', 2), ('B1', 3)]
            ])
            write('judge-ledger.json', [
                {'pair': f'{other}-{n}', 'pairing': f'head-vs-{other}', 'attempt': 1, 'A': 'head', 'B': other}
                for other in probe.PAIRINGS for n in (1, 2, 3)
            ])
            Path(f'{run}/judges').mkdir()
            for other in [f'{arm}-{n}' for arm in probe.PAIRINGS for n in (1, 2, 3)]:
                for judge in ('astra', 'sol'):
                    Path(f'{run}/judges/{other}-{judge}.txt').write_text('OVERALL: A - preferred\nUNREAD: none')
            cases = [
                # vanilla saturation cannot excuse harm against either control
                ('vanilla harm', 0, 0, 2.5, 3, False),
                ('base harm', 2.5, 3, 2.5, 3, False),
                ('zero builds', 3, 3, 3, 0, False),
                ('one build', 3, 3, 3, 1, False),
                ('two builds, saturated tie', 3, 3, 3, 2, True),
                ('unsaturated gain missing', 2, 2, 2, 3, False),
                ('unsaturated gain met', 2.5, 2, 2, 3, True),
            ]
            for name, head, base, vanilla, builds, supported in cases:
                with self.subTest(name=name):
                    write('review-scores.json', {'by_arm': {
                        arm: {'mean_score': value, 'attempts': 1}
                        for arm, value in [('head', head), ('base', base), ('vanilla', vanilla)]
                    }})
                    write('gates.json', {f'{arm}-{n}': {'pass': n <= builds} for arm in probe.ARMS for n in (1, 2, 3)})
                    with contextlib.redirect_stdout(io.StringIO()):
                        probe.score(run)
                    self.assertEqual(probe.load(f'{run}/scores.json')['verdict'].startswith('supported'), supported)

    def test_codex_judge_rejects_all_execution(self):
        with tempfile.TemporaryDirectory() as root:
            trace = Path(root)/'trace.jsonl'
            # Absolute-directory heuristics missed discovery, relative reads, and shell expansion.
            for command in ['find / -name judge-ledger.json -exec cat {} \\;', 'cat criteria.md', 'cat "$HOME/file"']:
                with self.subTest(command=command):
                    trace.write_text(json.dumps({'type': 'item.completed', 'item': {'type': 'command_execution', 'command': command}}))
                    self.assertTrue(probe.check_codex_trace(trace, root)[0])
            trace.write_text(json.dumps({'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'OVERALL: A'}}))
            self.assertFalse(probe.check_codex_trace(trace, root)[0])

    def test_bundle_blocks_residual_markers_even_in_identical_files(self):
        with tempfile.TemporaryDirectory() as run:
            for arm in probe.ARMS:
                app = Path(run)/arm/'app'
                app.mkdir(parents=True)
                (app/'index.html').write_text('<script>const x = 1; // interface-design\n</script>')
            probe.dump(f'{run}/ledger.json', [
                {'id': arm, 'arm': arm, 'task': 'B1', 'attempt': 1, 'workspace': f'{run}/{arm}'}
                for arm in probe.ARMS
            ])
            Path(f'{run}/prompts').mkdir()
            Path(f'{run}/judge-commands.sh').write_text('stale commands')
            with self.assertRaisesRegex(SystemExit, 'Residual arm identifiers'):
                probe.bundle(run)
            self.assertFalse(Path(f'{run}/judge-commands.sh').exists())
            self.assertFalse(Path(f'{run}/judge-ledger.json').exists())


if __name__ == '__main__':
    unittest.main()
