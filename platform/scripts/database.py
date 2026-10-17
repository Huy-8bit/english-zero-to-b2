#!/usr/bin/env python3
"""Backup/restore the deployed Docker volume or the configured local SQLite DB."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys

from db_archive import backup, restore, verify

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '--project-directory', str(ROOT), '-f', str(ROOT / 'docker-compose.yml')]


def run(args: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['backup', 'restore', 'verify'])
    parser.add_argument('archive', type=Path, nargs='?')
    parser.add_argument('--mode', choices=['docker', 'local'], default='docker')
    parser.add_argument('--backup-dir', type=Path, default=Path(os.getenv('BACKUP_DIR', ROOT / 'backups')))
    parser.add_argument('--replace', action='store_true', help='Allow replacing existing destination data')
    parser.add_argument('--app-stopped', action='store_true', help='Required for local restore: all writers are stopped')
    parser.add_argument('--stop', action='store_true', help='Docker backup: briefly stop API for a consistent media snapshot')
    args = parser.parse_args()
    if args.command != 'backup' and args.archive is None:
        parser.error('An archive path is required')
    os.umask(0o077)
    args.backup_dir = args.backup_dir.resolve()
    args.backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    archive = (args.archive or args.backup_dir / f'{args.mode}-{stamp}.tar.gz').resolve()
    if args.command == 'verify':
        print(json.dumps(verify(archive), indent=2))
        return
    # Serialize operations from this checkout. Multiple deployment hosts must not
    # share the SQLite volume; this deployment uses one API instance.
    with (args.backup_dir / '.operation.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.mode == 'local':
            # Match scripts/dev.sh for legacy relative SQLite/media paths.
            os.chdir(ROOT / 'backend')
            sys.path.insert(0, str(ROOT / 'backend'))
            from app.config import DATABASE_URL, MEDIA_DIR
            if not DATABASE_URL.startswith('sqlite:///') or ':memory:' in DATABASE_URL:
                parser.error('Only file-backed SQLite is supported by these scripts')
            database = Path(DATABASE_URL.removeprefix('sqlite:///')).resolve()
            if args.command == 'backup':
                backup(database, MEDIA_DIR, archive)
            else:
                restore(archive, database, MEDIA_DIR, replace=args.replace,
                        app_stopped=args.app_stopped, rollback_dir=args.backup_dir)
        else:
            config = json.loads(run(COMPOSE + ['config', '--format', 'json'], capture=True))
            volume = config['volumes']['learning-data']['name']
            running = run(COMPOSE + ['ps', '--status', 'running', '-q', 'backend'], capture=True)
            existing_backend = run(COMPOSE + ['ps', '-a', '-q', 'backend'], capture=True)
            if existing_backend:
                containers = json.loads(run(['docker', 'inspect', *existing_backend.splitlines()], capture=True))
                if any(not any(m.get('Name') == volume and m['Destination'] == '/data'
                               for m in c['Mounts']) for c in containers):
                    raise ValueError('Existing backend uses a different volume. Keep LEARNING_DATA_VOLUME unchanged or use a separate Compose project for a new installation')
            stop = args.command == 'restore' or args.stop
            if args.command == 'restore':
                verify(archive)  # Reject invalid archives before stopping the API.
                existing = subprocess.run(['docker', 'volume', 'inspect', volume],
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
                if existing and not args.replace:
                    raise ValueError('Destination volume exists; pass --replace to restore over it')
            else:
                # Never create an empty source volume and call it a successful backup.
                run(['docker', 'volume', 'inspect', '--format', '{{.Name}}', volume], capture=True)
                archive.parent.mkdir(parents=True, exist_ok=True)
            if stop and running:
                run(COMPOSE + ['stop', '-t', '60', 'backend'])
            success = False
            try:
                if stop:
                    users = run(['docker', 'ps', '-q', '--filter', f'volume={volume}'], capture=True)
                    if users:
                        raise ValueError('Other containers still use the data volume; stop them first')
                command = COMPOSE + ['run', '--rm', '--no-deps', '-T', '--user', '0',
                    '--entrypoint', 'python',
                    '-v', f'{ROOT / "scripts/db_archive.py"}:/tmp/db_archive.py:ro',
                    '-v', f'{args.backup_dir}:/backups',
                    '-v', f'{archive.parent}:/archive' + (':ro' if args.command == 'restore' else ''),
                    'backend', '/tmp/db_archive.py', args.command,
                    '--archive', f'/archive/{archive.name}',
                    '--output-owner', f'{os.getuid()}:{os.getgid()}']
                if args.command == 'restore':
                    command += ['--app-stopped']
                    if args.replace:
                        command += ['--replace']
                run(command)
                success = True
            finally:
                if stop and running:
                    if success or args.command == 'backup':
                        run(COMPOSE + ['start', '--wait', '--wait-timeout', '120', 'backend'])
                    else:
                        print('Restore failed; backend remains stopped. Inspect the error and pre-restore backup before starting.', file=sys.stderr)
        print(f'{args.command.capitalize()} OK: {archive}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        sys.exit(f'Database operation failed: {exc}')
