"""Ohm Sweet Ohm — atelier local d'export vidéo, 2026-09-22 — Codex / OpenAI.
Reçoit les images de notre page de tournage et encode un MP4 à cadence fixe.
Écoute uniquement sur 127.0.0.1 ; aucun service ni envoi extérieur.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
STAGING = Path(tempfile.mkdtemp(prefix="elan-film-"))
lock = threading.Lock()
job = {"process": None, "frames": 0}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if self.path.startswith('/film-api/') and self.path != '/film-api/frame':
            print(fmt % args, flush=True)

    def respond(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        if length > 16_000_000:
            return self.respond({'error': 'Image trop volumineuse'}, 413)
        data = self.rfile.read(length)
        with lock:
            if self.path == '/film-api/start':
                if job['process'] and job['process'].poll() is None:
                    return self.respond({'error': 'Un export est déjà actif'}, 409)
                config = json.loads(data)
                aspect = 'vertical' if config.get('vertical') else 'horizontal'
                destination = STAGING / f'elan-{aspect}-silent.mp4'
                logfile = open(STAGING / f'{aspect}-encoder.log', 'w')
                proc = subprocess.Popen([
                    '/opt/homebrew/bin/ffmpeg', '-y', '-hide_banner', '-loglevel', 'warning',
                    '-f', 'image2pipe', '-framerate', '30', '-vcodec', 'mjpeg', '-i', 'pipe:0',
                    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    '-metadata', 'title=Ohm Sweet Ohm — L’électrique, de l’intérieur',
                    '-metadata', 'artist=Médéric Morin · réalisation Codex / OpenAI',
                    str(destination),
                ], stdin=subprocess.PIPE, stderr=logfile)
                job.update(process=proc, frames=0, path=str(destination), log=logfile)
                return self.respond({'ok': True, 'path': str(destination)})
            if self.path == '/film-api/frame':
                if not job['process'] or job['process'].poll() is not None:
                    return self.respond({'error': 'Encodeur inactif'}, 409)
                try:
                    job['process'].stdin.write(data)
                    job['frames'] += 1
                    return self.respond({'frames': job['frames']})
                except BrokenPipeError:
                    return self.respond({'error': 'Encodage interrompu'}, 500)
            if self.path == '/film-api/finish':
                if not job['process']:
                    return self.respond({'error': 'Aucun export'}, 409)
                job['process'].stdin.close()
                code = job['process'].wait(timeout=60)
                job['log'].close()
                return self.respond({'ok': code == 0, 'path': job['path'], 'frames': job['frames']})
            return self.respond({'error': 'Route inconnue'}, 404)

print(f'Atelier vidéo http://127.0.0.1:8132/tools/presentation.html — {STAGING}', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8132), Handler).serve_forever()
