import sqlite3,json,hashlib
c=sqlite3.connect("file:/data/english.db?mode=ro",uri=True)
c.execute("BEGIN")
result={}
for (table,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
 rows=c.execute('SELECT * FROM "'+table.replace('"','""')+'"').fetchall()
 result[table]={"count":len(rows),"sha256":hashlib.sha256(json.dumps(sorted(rows,key=repr),ensure_ascii=False,default=repr).encode()).hexdigest()}
print(json.dumps(result,sort_keys=True))
