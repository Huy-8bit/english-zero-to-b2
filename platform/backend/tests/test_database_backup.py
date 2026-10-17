"""Real SQLite WAL, corruption, and restore failures; never use learner storage."""
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tarfile

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / 'scripts'
spec = importlib.util.spec_from_file_location('db_archive', SCRIPTS / 'db_archive.py')
db_archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db_archive)


@pytest.fixture
def storage(tmp_path):
    database = tmp_path / 'data' / 'english.db'
    database.parent.mkdir()
    media = database.parent / 'media'
    media.mkdir()
    (media / 'speech.mp3').write_bytes(b'audio\x00\xff')
    conn = sqlite3.connect(database)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)')
    conn.execute('INSERT INTO notes VALUES (1, ?)', ('Giữ tiến độ của tôi',))
    conn.commit()
    yield database, media, conn
    conn.close()


def note(database):
    with sqlite3.connect(database) as conn:
        return conn.execute('SELECT text FROM notes WHERE id=1').fetchone()[0]


def test_online_snapshot_includes_wal_and_media(storage, tmp_path):
    database, media, conn = storage
    assert Path(str(database) + '-wal').stat().st_size > 0
    archive = tmp_path / 'backup.tar.gz'
    manifest = db_archive.backup(database, media, archive)
    # Snapshot is fixed while the live application can continue writing.
    conn.execute("UPDATE notes SET text='newer' WHERE id=1")
    conn.commit()
    assert db_archive.verify(archive) == manifest
    target = tmp_path / 'restored'
    db_archive.restore(archive, target / 'english.db', target / 'media',
                       replace=False, app_stopped=True, rollback_dir=tmp_path / 'rollbacks')
    assert note(target / 'english.db') == 'Giữ tiến độ của tôi'
    assert (target / 'media' / 'speech.mp3').read_bytes() == b'audio\x00\xff'
    assert note(database) == 'newer'
    assert archive.stat().st_mode & 0o777 == 0o600


def test_missing_database_does_not_create_empty_source(tmp_path):
    with pytest.raises(ValueError, match='not found'):
        db_archive.backup(tmp_path / 'missing.db', tmp_path / 'media', tmp_path / 'backup.tar.gz')
    assert not (tmp_path / 'missing.db').exists()


def test_archive_never_overwritten(storage, tmp_path):
    database, media, _ = storage
    archive = tmp_path / 'backup.tar.gz'
    db_archive.backup(database, media, archive)
    before = archive.read_bytes()
    with pytest.raises(ValueError, match='overwrite'):
        db_archive.backup(database, media, archive)
    assert archive.read_bytes() == before


@pytest.mark.parametrize('replace,stopped,message', [(False, True, '--replace'), (True, False, 'Stop all')])
def test_restore_requires_explicit_intent(storage, tmp_path, replace, stopped, message):
    database, media, _ = storage
    archive = tmp_path / 'backup.tar.gz'
    db_archive.backup(database, media, archive)
    with pytest.raises(ValueError, match=message):
        db_archive.restore(archive, database, media, replace=replace,
                           app_stopped=stopped, rollback_dir=tmp_path / 'rollback')
    assert note(database) == 'Giữ tiến độ của tôi'


def test_restore_keeps_pre_restore_snapshot_and_replaces_media(storage, tmp_path):
    database, media, conn = storage
    archive = tmp_path / 'backup.tar.gz'
    db_archive.backup(database, media, archive)
    conn.execute("UPDATE notes SET text='before restore'")
    conn.commit()
    conn.close()
    (media / 'new.mp3').write_bytes(b'new recording')
    rollback = tmp_path / 'rollback'
    db_archive.restore(archive, database, media, replace=True, app_stopped=True, rollback_dir=rollback)
    assert note(database) == 'Giữ tiến độ của tôi'
    assert not (media / 'new.mp3').exists()
    prior = next(rollback.glob('*.tar.gz'))
    clone = tmp_path / 'prior'
    db_archive.restore(prior, clone / 'english.db', clone / 'media', replace=False,
                       app_stopped=True, rollback_dir=rollback)
    assert note(clone / 'english.db') == 'before restore'
    assert (clone / 'media' / 'new.mp3').read_bytes() == b'new recording'


def test_failed_swap_rolls_back_database_and_media(storage, tmp_path, monkeypatch):
    database, media, conn = storage
    archive = tmp_path / 'backup.tar.gz'
    db_archive.backup(database, media, archive)
    conn.execute("UPDATE notes SET text='must survive failure'")
    conn.commit()
    conn.close()
    original = os.replace

    def fail_install_media(source, dest):
        if Path(source).name == 'media' and Path(dest) == media:
            raise OSError('simulated disk error')
        return original(source, dest)

    monkeypatch.setattr(db_archive.os, 'replace', fail_install_media)
    with pytest.raises(OSError, match='simulated'):
        db_archive.restore(archive, database, media, replace=True, app_stopped=True,
                           rollback_dir=tmp_path / 'rollback')
    assert note(database) == 'must survive failure'
    assert (media / 'speech.mp3').exists()


@pytest.mark.parametrize('bad_name,symlink', [('../escaped', False), ('/tmp/escaped', False), ('media/link', True)])
def test_unsafe_archive_rejected_before_restore(storage, tmp_path, bad_name, symlink):
    database, media, conn = storage
    conn.close()
    archive = tmp_path / 'bad.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        entry = tarfile.TarInfo(bad_name)
        if symlink:
            entry.type, entry.linkname = tarfile.SYMTYPE, '/etc/passwd'
        else:
            entry.size = 1
        tar.addfile(entry, None if symlink else io.BytesIO(b'x'))
    with pytest.raises(ValueError, match='Unsafe'):
        db_archive.restore(archive, database, media, replace=True, app_stopped=True,
                           rollback_dir=tmp_path / 'rollback')
    assert note(database) == 'Giữ tiến độ của tôi'
    assert not (tmp_path / 'escaped').exists()


def test_corruption_rejected_before_existing_data_changes(storage, tmp_path):
    database, media, conn = storage
    conn.close()
    archive = tmp_path / 'backup.tar.gz'
    db_archive.backup(database, media, archive)
    corrupted = tmp_path / 'corrupt.tar.gz'
    with tarfile.open(archive) as source, tarfile.open(corrupted, 'w:gz') as dest:
        for member in source:
            if member.isfile():
                data = source.extractfile(member).read()
                if member.name == 'media/speech.mp3':
                    data = b'X' * len(data)
                dest.addfile(member, io.BytesIO(data))
            else:
                dest.addfile(member)
    with pytest.raises(ValueError, match='checksum'):
        db_archive.restore(corrupted, database, media, replace=True, app_stopped=True,
                           rollback_dir=tmp_path / 'rollback')
    assert note(database) == 'Giữ tiến độ của tôi'


def test_local_cli_honors_configured_database_and_media(storage, tmp_path):
    database, media, conn = storage
    conn.close()
    archive = tmp_path / 'cli.tar.gz'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{database}', 'MEDIA_DIR': str(media)}
    args = [sys.executable, str(SCRIPTS / 'database.py')]
    subprocess.run(args + ['backup', str(archive), '--mode', 'local', '--backup-dir', str(tmp_path / 'backups')],
                   env=env, check=True, capture_output=True)
    env.update(DATABASE_URL=f'sqlite:///{tmp_path}/clone/english.db', MEDIA_DIR=str(tmp_path / 'clone/media'))
    result = subprocess.run(args + ['restore', str(archive), '--mode', 'local', '--app-stopped',
                                   '--backup-dir', str(tmp_path / 'backups')], env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert note(tmp_path / 'clone/english.db') == 'Giữ tiến độ của tôi'
