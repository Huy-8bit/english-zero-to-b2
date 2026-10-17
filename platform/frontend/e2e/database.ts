import { execFileSync } from "node:child_process";
import path from "node:path";

/** Reset only Playwright's disposable DB between serial suites, never learner data. */
export function resetTestDatabase() {
  const db = path.resolve(import.meta.dirname, "../test-results/e2e.db");
  execFileSync(path.resolve(import.meta.dirname, "../../backend/.venv/bin/python"), ["-c", `
import sqlite3, sys
from pathlib import Path
p = Path(sys.argv[1]).resolve()
assert p.parent.name == 'test-results' and p.name == 'e2e.db'
with sqlite3.connect(p) as conn:
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    for (name,) in tables:
        if name != 'alembic_version' and not name.startswith('sqlite_'):
            conn.execute('DELETE FROM "' + name.replace('"', '""') + '"')
`, db]);
}
