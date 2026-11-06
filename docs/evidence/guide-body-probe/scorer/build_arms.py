# Build one guidance file per arm from a git ref. Links are rewritten so nothing
# resolves against a checkout. Run it from the repository root, because git ls-tree
# lists paths relative to the working directory. Usage: build_arms.py <ref> <out-file>
import re, subprocess, sys
ref, out = sys.argv[1], sys.argv[2]
show = lambda p: subprocess.run(['git', 'show', f'{ref}:{p}'], capture_output=True, text=True, check=True).stdout
ls = lambda p: subprocess.run(['git', 'ls-tree', '--name-only', f'{ref}:{p}'], capture_output=True, text=True, check=True).stdout.split()
def section(text, heading):
    m = re.search(rf'^## {re.escape(heading)}\n.*?(?=^## |\Z)', text, flags=re.S | re.M)
    return m.group(0).strip()
def delink(text):
    text = re.sub(r'\[([^\]]+)\]\((?:references/)?([\w-]+\.md)(?:#[\w-]+)?\)', r'\1 (the "\2" part of this file)', text)
    text = re.sub(r'\[([^\]]+)\]\((?!https?:)[^)]+\)', r'\1', text)
    # A skill name would let the builder load the installed copy instead of this file.
    text = text.replace("`$workflow:technical-writing`'s", 'the technical-writing')
    return re.sub(r'`\$workflow:([\w-]+)`', r'the \1 guidance', text)
tw = 'plugins/workflow/skills/technical-writing'
parts = [('technical-writing/SKILL.md', re.sub(r'^---\n.*?\n---\n', '', show(f'{tw}/SKILL.md'), flags=re.S))]
parts += [(f'{n}', show(f'{tw}/references/{n}')) for n in ls(f'{tw}/references')]
parts.append(('Global guidance: Written deliverables', section(show('host-config/guidance/core.md'), 'Written deliverables')))
parts.append(('Design language: Copy and density', section(show('host-config/design-language/DESIGN.md'), 'Copy and density')))
body = '\n\n'.join(f'<!-- part: {name} -->\n\n{delink(text).strip()}' for name, text in parts)
open(out, 'w').write(body + '\n')
