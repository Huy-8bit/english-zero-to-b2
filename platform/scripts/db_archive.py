"""SQLite online snapshots and checked restore. Standard library only; no app startup."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import tarfile
import tempfile
from datetime import datetime, timezone


def digest(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inspect_db(path: Path) -> dict:
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('SQLite integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('SQLite foreign key check failed')
        tables = [r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        counts = {t: db.execute('SELECT COUNT(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0]
                  for t in tables}
        version = (db.execute('SELECT version_num FROM alembic_version').fetchone()
                   if 'alembic_version' in tables else None)
        return {'rows': counts, 'alembic_revision': version[0] if version else None}


def backup(database: Path, media: Path, output: Path) -> dict:
    if not database.is_file() or database.is_symlink():
        raise ValueError(f'Database not found or is a symlink: {database}')
    if media.is_symlink() or output.resolve().is_relative_to(media.resolve()):
        raise ValueError('Media must not be a symlink; archive must be outside media')
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError(f'Refusing to overwrite archive: {output}')
    with tempfile.TemporaryDirectory(prefix='.backup-', dir=output.parent) as temp:
        stage = Path(temp)
        snapshot = stage / 'english.db'
        source = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
        target = sqlite3.connect(snapshot)
        try:
            # Includes committed WAL pages; copying the .db file alone can lose them.
            source.backup(target, pages=256, sleep=0.1)
            target.execute('PRAGMA journal_mode=DELETE')
        finally:
            target.close()
            source.close()
        meta = inspect_db(snapshot)
        (stage / 'media').mkdir()
        if media.exists():
            for item in media.rglob('*'):
                if item.is_symlink() or not (item.is_file() or item.is_dir()):
                    raise ValueError(f'Unsupported media entry: {item}')
                dest = stage / 'media' / item.relative_to(media)
                if item.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(item, dest)
        files = {p.relative_to(stage).as_posix(): {'sha256': digest(p), 'size': p.stat().st_size}
                 for p in sorted(stage.rglob('*')) if p.is_file()}
        manifest = {'format': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
                    'database': meta, 'files': files}
        (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        packed = stage / 'archive.tar.gz'
        with tarfile.open(packed, 'w:gz') as archive:
            for name in ('english.db', 'media', 'manifest.json'):
                archive.add(stage / name, arcname=name)
        os.chmod(packed, 0o600)
        # Hard link provides atomic publication without overwriting another backup.
        os.link(packed, output)
    return manifest


def unpack_checked(archive_path: Path, stage: Path) -> dict:
    seen = set()
    with tarfile.open(archive_path, 'r:gz') as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if (name.is_absolute() or '..' in name.parts or '\\' in member.name
                    or member.name in seen or not name.parts
                    or name.parts[0] not in ('english.db', 'media', 'manifest.json')
                    or (name.parts[0] != 'media' and len(name.parts) != 1)
                    or not (member.isfile() or member.isdir())):
                raise ValueError('Unsafe or unexpected archive entry')
            seen.add(member.name)
            dest = stage.joinpath(*name.parts)
            if member.isdir():
                dest.mkdir(parents=True, exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, dest.open('xb') as target:
                    shutil.copyfileobj(source, target)
                os.chmod(dest, 0o600)
    manifest = json.loads((stage / 'manifest.json').read_text())
    if manifest.get('format') != 1 or 'english.db' not in manifest.get('files', {}):
        raise ValueError('Unsupported or incomplete backup manifest')
    actual = {p.relative_to(stage).as_posix() for p in stage.rglob('*')
              if p.is_file() and p != stage / 'manifest.json'}
    if actual != set(manifest['files']):
        raise ValueError('Backup file inventory mismatch')
    for name, info in manifest['files'].items():
        path = stage / name
        if path.stat().st_size != info['size'] or digest(path) != info['sha256']:
            raise ValueError(f'Backup checksum mismatch: {name}')
    if inspect_db(stage / 'english.db') != manifest['database']:
        raise ValueError('Backup database metadata mismatch')
    (stage / 'media').mkdir(exist_ok=True)
    return manifest


def verify(archive: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix='verify-backup-') as temp:
        return unpack_checked(archive, Path(temp))


def restore(archive: Path, database: Path, media: Path, *, replace: bool,
            app_stopped: bool, rollback_dir: Path) -> dict:
    if not app_stopped:
        raise ValueError('Stop all application writers and pass --app-stopped first')
    if media == database or database.resolve().is_relative_to(media.resolve()):
        raise ValueError('Database must be outside the media directory')
    if database.is_symlink() or media.is_symlink():
        raise ValueError('Refusing to restore through a symlink')
    if (database.exists() or media.exists()) and not replace:
        raise ValueError('Destination exists; --replace is required')
    database.parent.mkdir(parents=True, exist_ok=True)
    media.parent.mkdir(parents=True, exist_ok=True)
    # Stage on destination filesystems so all renames are atomic.
    with tempfile.TemporaryDirectory(prefix='.restore-', dir=database.parent) as temp, \
            tempfile.TemporaryDirectory(prefix='.restore-media-', dir=media.parent) as mt:
        stage, media_stage = Path(temp), Path(mt) / 'media'
        manifest = unpack_checked(archive, stage)
        shutil.move(stage / 'media', media_stage)
        if database.exists():
            rollback_dir.mkdir(parents=True, exist_ok=True)
            rollback = rollback_dir / ('before-restore-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.tar.gz')
            backup(database, media, rollback)
            print(f'Pre-restore backup: {rollback}', flush=True)
        elif media.exists():
            raise ValueError('Media exists without a database; move it aside explicitly first')
        owner = database.stat() if database.exists() else database.parent.stat()
        media_owner = media.stat() if media.exists() else owner
        if os.geteuid() == 0:
            os.chown(stage / 'english.db', owner.st_uid, owner.st_gid)
            for item in [media_stage, *media_stage.rglob('*')]:
                os.chown(item, media_owner.st_uid, media_owner.st_gid)
        # Application must remain stopped throughout the swap. On ordinary I/O
        # failure, undo all completed renames; original files stay untouched.
        moved, installed = [], []
        try:
            for original, saved in [(database, stage / 'old.db'),
                                    (Path(str(database) + '-wal'), stage / 'old.wal'),
                                    (Path(str(database) + '-shm'), stage / 'old.shm'),
                                    (media, Path(mt) / 'old-media')]:
                if original.exists():
                    os.replace(original, saved)
                    moved.append((original, saved))
            for source, dest in [(stage / 'english.db', database), (media_stage, media)]:
                os.replace(source, dest)
                installed.append(dest)
        except BaseException:
            for dest in reversed(installed):
                shutil.rmtree(dest) if dest.is_dir() else dest.unlink()
            for original, saved in reversed(moved):
                os.replace(saved, original)
            raise
        return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['backup', 'verify', 'restore'])
    parser.add_argument('--database', type=Path, default=Path('/data/english.db'))
    parser.add_argument('--media', type=Path, default=Path('/data/media'))
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--rollback-dir', type=Path, default=Path('/backups'))
    parser.add_argument('--replace', action='store_true')
    parser.add_argument('--app-stopped', action='store_true')
    parser.add_argument('--output-owner', help='UID:GID for Docker host backup files')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.command == 'backup':
            result = backup(args.database, args.media, args.archive)
        elif args.command == 'verify':
            result = verify(args.archive)
        else:
            result = restore(args.archive, args.database, args.media, replace=args.replace,
                             app_stopped=args.app_stopped, rollback_dir=args.rollback_dir)
        print(json.dumps({'command': args.command, 'archive': str(args.archive),
                          'database': result['database']}, ensure_ascii=False))
    except (ValueError, OSError, sqlite3.Error, tarfile.TarError, KeyError, TypeError) as exc:
        parser.exit(1, f'Database operation failed: {exc}\n')
    finally:
        # A failed restore must still leave its safety snapshot readable on host.
        if args.output_owner and os.geteuid() == 0:
            uid, gid = map(int, args.output_owner.split(':'))
            if args.command == 'backup' and args.archive.exists():
                os.chown(args.archive, uid, gid)
            if args.command == 'restore':
                for file in args.rollback_dir.glob('before-restore-*.tar.gz'):
                    os.chown(file, uid, gid)


if __name__ == '__main__':
    main()
