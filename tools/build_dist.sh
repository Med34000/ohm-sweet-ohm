#!/bin/sh
# Ohm Sweet Ohm — prépare le dossier `dist/` à mettre en ligne (site statique, aucun build JavaScript).
# 2026-09-30 ≈19:00 (Europe/Zurich) — Codex — OpenAI.
# Usage : sh tools/build_dist.sh ; --check vérifie les sources sans construire ou remplacer dist/.
# Liste autorisée uniquement : application, bibliothèques locales, modèles Web et registre de licences.
# L’ancien dist/ est conservé dans _archive/dist-builds/ après validation du nouveau dossier.
set -eu
cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import hashlib
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

if sys.argv[1:] not in ([], ['--check']):
    sys.exit('Usage : sh tools/build_dist.sh [--check]')
check_only = bool(sys.argv[1:])
root = Path.cwd().resolve()
dist = root / 'dist'
if dist.is_symlink() or (dist.exists() and not dist.is_dir()):
    sys.exit('dist doit être un dossier ordinaire, jamais un lien ou un fichier.')

# Les sources Blender, archives, outils, tests et exports ne font jamais partie de cette liste.
files = {
    Path('index.html'), Path('THIRD_PARTY_NOTICES.md'), Path('css/styles.css'),
    *(path.relative_to(root) for path in (root / 'js').rglob('*.js')
      if not any(part.startswith('.') for part in path.relative_to(root).parts)),
    *(Path('libs') / name for name in ['three.module.min.js', 'GLTFLoader.js', 'OrbitControls.js',
                                      'BufferGeometryUtils.js', 'meshopt_decoder.module.js']),
    *(Path('assets/web') / name for name in ['elan-sedan.glb', 'elan-sedan-manifest.json',
                                            'elan-drive-unit.glb', 'elan-wheel.glb', 'elan-charger.glb']),
}
for relative in sorted(files):
    path = root / relative
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(root):
        sys.exit(f'Ressource locale absente ou non autorisée : {relative}')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

# Figer l’empreinte avant les contrôles : une modification concurrente oblige à recommencer.
hashes = {relative: digest(root / relative) for relative in files}

references = set()
def reference(url, owner, *, runtime=False):
    parsed = urlsplit(url)
    if not url or url.startswith('#'):
        return
    if parsed.scheme or parsed.netloc:
        if runtime and parsed.scheme not in ('data', 'blob'):
            raise ValueError(f'{owner} : dépendance externe du rendu interdite ({url})')
        return
    path = unquote(parsed.path)
    if not path:
        return
    target = root / path.lstrip('/') if path.startswith('/') else (root / owner).parent / path
    target = target.resolve()
    if not target.is_relative_to(root):
        raise ValueError(f'{owner} : référence hors du site ({url})')
    relative = target.relative_to(root)
    if relative not in files:
        raise ValueError(f'{owner} : référence absente du dossier de publication ({url})')
    references.add((str(owner), str(relative)))

class DocumentReferences(HTMLParser):
    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        for key in ('src', 'href'):
            if attributes.get(key):
                reference(attributes[key], Path('index.html'), runtime=tag in ('script', 'img', 'link'))

try:
    html = (root / 'index.html').read_text()
    DocumentReferences().feed(html)
    maps = re.findall(r'<script\b[^>]*type=["\']importmap["\'][^>]*>([\s\S]*?)</script>', html)
    import_map = json.loads(maps[0]).get('imports', {}) if maps else {}
    for url in import_map.values():
        reference(url, Path('index.html'), runtime=True)
    static_import = re.compile(r'\b(?:import|export)\s+(?:[^;"\']*?\bfrom\s*)?["\']([^"\']+)["\']')
    dynamic_import = re.compile(r'\bimport\s*\(\s*["\']([^"\']+)["\']')
    for relative in sorted(path for path in files if path.suffix == '.js'):
        source = (root / relative).read_text()
        for specifier in static_import.findall(source) + dynamic_import.findall(source):
            if specifier.startswith(('.', '/')):
                reference(specifier, relative, runtime=True)
            elif specifier in import_map:
                reference(import_map[specifier], Path('index.html'), runtime=True)
            else:
                raise ValueError(f'{relative} : module sans résolution locale ({specifier})')
        # Les URLs GLTFLoader se résolvent depuis index.html, pas depuis le module JS.
        if relative.parts[0] == 'js':
            for url in re.findall(r'["\']((?:/?assets|/?libs|/?css)/[^"\'\r\n]+)["\']', source):
                reference(url, Path('index.html'), runtime=True)
    for match in re.finditer(r'url\(\s*(["\']?)(.*?)\1\s*\)', (root / 'css/styles.css').read_text()):
        reference(match.group(2), Path('css/styles.css'), runtime=True)
    for relative in sorted(path for path in files if path.suffix == '.glb'):
        data = (root / relative).read_bytes()
        magic, version, size = struct.unpack_from('<4sII', data)
        chunk_size, chunk_type = struct.unpack_from('<I4s', data, 12)
        if magic != b'glTF' or version != 2 or size != len(data) or chunk_type != b'JSON':
            raise ValueError(f'{relative} : fichier GLB invalide')
        gltf = json.loads(data[20:20 + chunk_size])
        for section in ('buffers', 'images'):
            for item in gltf.get(section, []):
                if item.get('uri'):
                    reference(item['uri'], relative, runtime=True)
    json.loads((root / 'assets/web/elan-sedan-manifest.json').read_text())
    node = shutil.which('node')
    if not node:
        raise ValueError('Node.js est requis pour vérifier la syntaxe des modules locaux.')
    for relative in sorted(path for path in files if path.suffix == '.js'):
        result = subprocess.run([node, '--check', str(root / relative)], capture_output=True, text=True)
        if result.returncode:
            raise ValueError(f'{relative} : syntaxe JavaScript invalide\n{result.stderr.strip()}')
except (ValueError, OSError, struct.error) as error:
    sys.exit(f'Publication non préparée : {error}')

print(f'Vérification locale réussie : {len(files)} fichiers autorisés, {len(references)} références résolues, GLB et JavaScript valides.')
if check_only:
    print('Lecture seule : dist/ et toutes les sources sont inchangés.')
    sys.exit(0)

staging = Path(tempfile.mkdtemp(prefix='.dist-staging-', dir=root))
backup = None
try:
    for relative in sorted(files):
        target = staging / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / relative, target)
        if digest(target) != hashes[relative]:
            raise ValueError(f'{relative} a changé pendant la copie : relancer après la fin des modifications.')
    timestamp = datetime.now(ZoneInfo('Europe/Zurich'))
    # Les noms actuels ne sont pas des empreintes du contenu : éviter un cache navigateur immuable.
    # Le CDN Netlify conserve son cache statique et l’invalide au déploiement ; le navigateur revalide.
    (staging / '_headers').write_text(
        f'# {timestamp:%Y-%m-%d %H:%M} (Europe/Zurich) — Codex — OpenAI\n'
        '# Dossier généré et vérifié ; ne pas copier les archives dans Netlify.\n'
        '/*\n'
        '  Cache-Control: public, max-age=0, must-revalidate\n'
        '  X-Content-Type-Options: nosniff\n'
        '  Referrer-Policy: strict-origin-when-cross-origin\n'
    )
    if dist.exists():
        backups = root / '_archive' / 'dist-builds'
        backups.mkdir(parents=True, exist_ok=True)
        backup = backups / f'{timestamp:%Y-%m-%d-%H%M%S}-{uuid.uuid4().hex[:8]}'
        dist.rename(backup)
    try:
        staging.rename(dist)
    except OSError:
        if backup is not None and not dist.exists():
            backup.rename(dist)
        raise
except (ValueError, OSError) as error:
    sys.exit(f'Préparation interrompue, sources conservées : {error}')
finally:
    # Seule la copie de travail créée par ce script peut être nettoyée.
    if staging.exists():
        shutil.rmtree(staging)

size = sum(path.stat().st_size for path in dist.rglob('*') if path.is_file())
print(f'Dossier prêt pour un dépôt manuel sur Netlify : {dist} ({size / 1_000_000:.2f} Mo, {len(files) + 1} fichiers).')
if backup is not None:
    print(f'Ancien dist/ conservé : {backup}')
print('Aucune publication effectuée.')
PY
