#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 <<'PY'
import re
import sys
from pathlib import Path

ROOT = Path('.')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'dist', 'venv', '.cursor'}
LONG_DASHES = ('\u2013', '\u2014')  # en dash, em dash
JOHN_DOE = re.compile(r'john[\s._-]*doe', re.IGNORECASE)

def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

violations = []
for path in sorted(ROOT.rglob('*')):
    if not path.is_file() or should_skip(path):
        continue
    if path.name == 'check-content-policy.sh':
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, PermissionError):
        continue
    for i, line in enumerate(text.splitlines(), start=1):
        for dash in LONG_DASHES:
            if dash in line:
                violations.append(f'{path}:{i}: long dash found')
                break
        if JOHN_DOE.search(line):
            violations.append(f'{path}:{i}: placeholder name "John Doe" found')

if violations:
    print('Content policy violations found:', file=sys.stderr)
    print('- No long dashes (en dash or em dash). Use a hyphen (-), comma, or colon instead.', file=sys.stderr)
    print('- No placeholder name "John Doe" (including john.doe, john_doe, etc.).', file=sys.stderr)
    for v in violations:
        print(v, file=sys.stderr)
    sys.exit(1)

print('Content policy checks passed.')
PY
