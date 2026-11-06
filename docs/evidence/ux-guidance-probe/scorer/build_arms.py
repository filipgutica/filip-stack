# Builds one guidance folder per arm and a manifest of sha256 hashes. Files are copied unchanged, with
# their relative paths, so links between a skill's files resolve inside the folder.
# Run it from the repository root. Usage:
#   build_arms.py <out-dir> --frontend-design <file>
# <file> is anthropics/skills skills/frontend-design/SKILL.md at the pinned commit; the script checks its hash.
import hashlib, json, os, subprocess, sys

BASE_REF = '119c74ea^1'        # main just before PR #112 replaced ux-laws with interface-design
HEAD_REF = 'origin/main'
FRONTEND_DESIGN_COMMIT = '41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f'
FRONTEND_DESIGN_SHA256 = 'd91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3'
# Guidance an agent reads. Metadata such as agents/openai.yaml and THIRD_PARTY_NOTICES.md is left out.
BASE_FILES = ['skills/ux-laws/SKILL.md', 'skills/ux-laws/references/laws.md']
HEAD_DIR = 'skills/interface-design'
HEAD_PARTS = ('SKILL.md', 'references/', 'scripts/')


def git(*args):
    return subprocess.run(['git', *args], capture_output=True, check=True).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(root, rel, data):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def head_files(ref):
    names = git('ls-tree', '-r', '--name-only', ref, '--', HEAD_DIR).decode().split()
    return [n for n in names if n[len(HEAD_DIR) + 1:].startswith(HEAD_PARTS)]


def build(out, frontend_design):
    fd = open(frontend_design, 'rb').read()
    if sha(fd) != FRONTEND_DESIGN_SHA256:
        sys.exit(f'{frontend_design} does not match frontend-design at {FRONTEND_DESIGN_COMMIT}')
    arms = {
        'vanilla': {},
        'base': {**{p[len('skills/'):]: git('show', f'{BASE_REF}:{p}') for p in BASE_FILES},
                 'frontend-design/SKILL.md': fd},
        'head': {p[len('skills/'):]: git('show', f'{HEAD_REF}:{p}') for p in head_files(HEAD_REF)},
    }
    manifest = {'refs': {'base': git('rev-parse', BASE_REF).decode().strip(), 'head': git('rev-parse', HEAD_REF).decode().strip(),
                         'frontend-design': FRONTEND_DESIGN_COMMIT}, 'arms': {}}
    for arm, files in arms.items():
        os.makedirs(os.path.join(out, arm), exist_ok=True)
        for rel, data in files.items():
            write(os.path.join(out, arm), rel, data)
        hashes = {rel: sha(data) for rel, data in sorted(files.items())}
        words = sum(len(data.decode().split()) for rel, data in files.items() if rel.endswith('.md'))
        bundle = sha(''.join(f'{h}  {rel}\n' for rel, h in hashes.items()).encode())
        manifest['arms'][arm] = {'files': hashes, 'markdown_words': words, 'bundle_sha256': bundle}
    with open(os.path.join(out, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print(json.dumps({a: {k: v for k, v in m.items() if k != 'files'} for a, m in manifest['arms'].items()}, indent=1))


if __name__ == '__main__':
    build(sys.argv[1], sys.argv[sys.argv.index('--frontend-design') + 1])
