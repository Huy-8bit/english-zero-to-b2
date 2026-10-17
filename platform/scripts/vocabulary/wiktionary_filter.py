"""Stream kaikki English JSONL from stdin; keep entries whose word is in argv[1]; write slim JSONL to argv[2]."""
import sys, json
want = {l.strip().lower() for l in open(sys.argv[1], encoding="utf-8") if l.strip()}
out = open(sys.argv[2], "w", encoding="utf-8")
n = k = 0
def rel(xs): return [x.get("word") for x in (xs or []) if x.get("word")][:15]
for line in sys.stdin:
    n += 1
    try: e = json.loads(line)
    except Exception: continue
    w = e.get("word", "")
    if e.get("lang_code") != "en" or w.lower() not in want: continue
    groups = {}
    for t in e.get("translations", []):
        g = (t.get("sense") or "")[:200]
        d = groups.setdefault(g, {"n": 0, "vi": []})
        d["n"] += 1
        if t.get("lang_code") == "vi" and t.get("word"): d["vi"].append(t["word"])
    senses = []
    for s in e.get("senses", [])[:14]:
        g = s.get("glosses") or []
        if not g: continue
        sg = {}
        for t in s.get("translations", []):
            sg["n"] = sg.get("n", 0) + 1
            if t.get("lang_code") == "vi" and t.get("word"): sg.setdefault("vi", []).append(t["word"])
        senses.append({"gloss": g[-1][:300], "tags": s.get("tags", [])[:8], "topics": s.get("topics", [])[:6],
                       "cats": [c.get("name") if isinstance(c, dict) else c for c in s.get("categories", [])][:12],
                       "examples": [{"t": x.get("text", "")[:260], "type": x.get("type"), "tr": x.get("translation") or x.get("english")} for x in s.get("examples", [])[:4] if x.get("text")],
                       "syn": rel(s.get("synonyms")), "ant": rel(s.get("antonyms")), "tr": sg})
    sounds = [{"ipa": x["ipa"], "tags": x.get("tags", [])} for x in e.get("sounds", []) if x.get("ipa")][:10]
    out.write(json.dumps({"word": w, "pos": e.get("pos"), "senses": senses, "sounds": sounds, "tgroups": groups,
                          "forms": [{"f": f.get("form"), "tags": f.get("tags", [])} for f in e.get("forms", [])[:16] if f.get("form")],
                          "derived": rel(e.get("derived"))[:40], "related": rel(e.get("related")),
                          "syn": rel(e.get("synonyms")), "ant": rel(e.get("antonyms")),
                          "cats": [c.get("name") if isinstance(c, dict) else c for c in e.get("categories", [])][:30]}, ensure_ascii=False) + "\n")
    k += 1
print(n, k, file=sys.stderr)
