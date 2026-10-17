#!/usr/bin/env python3
"""Kiểm tra liên kết nội bộ và một số chỉ số chất lượng của bộ giáo trình.

Cách chạy (từ thư mục english-zero-to-b2/):
    python3 99-PROJECT/check_links.py            # kiểm tra link
    python3 99-PROJECT/check_links.py --stats    # thêm thống kê bài ngữ pháp
"""
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


def slugify(heading):
    """Mô phỏng cách GitHub tạo anchor cho heading."""
    text = heading.strip().lower()
    text = re.sub(r"<[^>]+>", "", text)
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if ch in " -":
            out.append("-" if ch == " " else ch)
        elif ch == "_" or cat[0] in ("L", "N") or cat in ("Mn", "Mc"):
            out.append(ch)
    return "".join(out)


def anchors_of(path, cache={}):
    if path not in cache:
        found = set()
        in_code = False
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.startswith("```"):
                    in_code = not in_code
                    continue
                m = HEADING_RE.match(line)
                if m and not in_code:
                    found.add(slugify(m.group(2)))
        cache[path] = found
    return cache[path]


def md_files():
    for d, dirs, files in os.walk(ROOT):
        # the learning platform (and its node_modules) is application code, not curriculum
        dirs[:] = [x for x in dirs if x not in ("platform", "node_modules") and not x.startswith(".")]
        for name in files:
            if name.endswith(".md"):
                yield os.path.join(d, name)


def check_links():
    broken = []
    total = 0
    for path in md_files():
        in_code = False
        with open(path, encoding="utf-8") as f:
            for no, line in enumerate(f, 1):
                if line.startswith("```"):
                    in_code = not in_code
                    continue
                if in_code:
                    continue
                for target in LINK_RE.findall(line):
                    if target.startswith(("http://", "https://", "mailto:")):
                        continue
                    total += 1
                    file_part, _, anchor = target.partition("#")
                    dest = path if not file_part else os.path.normpath(
                        os.path.join(os.path.dirname(path), file_part))
                    rel = os.path.relpath(path, ROOT)
                    if not os.path.exists(dest):
                        broken.append((rel, no, target, "missing file"))
                    elif anchor and dest.endswith(".md") and anchor not in anchors_of(dest):
                        broken.append((rel, no, target, "missing anchor"))
    return total, broken


MERMAID_BAD = re.compile(r"(?:\[|\{)(?!\")([^\]\}\"]*[()][^\]\}\"]*)(?:\]|\})")


def check_mermaid():
    """Phát hiện lỗi Mermaid phổ biến: nhãn không đặt trong ngoặc kép nhưng chứa ( ),
    và sơ đồ timeline có dấu ':' trong mốc thời gian."""
    problems = []
    for path in md_files():
        rel = os.path.relpath(path, ROOT)
        in_mermaid = False
        kind = ""
        with open(path, encoding="utf-8") as f:
            for no, line in enumerate(f, 1):
                if line.startswith("```mermaid"):
                    in_mermaid, kind = True, ""
                    continue
                if in_mermaid and line.startswith("```"):
                    in_mermaid = False
                    continue
                if not in_mermaid:
                    continue
                if not kind and line.strip():
                    kind = line.split()[0]
                    continue
                if kind in ("flowchart", "graph"):
                    for m in MERMAID_BAD.finditer(line):
                        problems.append((rel, no, m.group(0)))
                if kind == "timeline" and line.count(":") > 1:
                    problems.append((rel, no, line.strip()))
    return problems


def lesson_stats():
    rows = []
    for path in sorted(md_files()):
        rel = os.path.relpath(path, ROOT)
        if "/grammar/" not in rel:
            continue
        text = open(path, encoding="utf-8").read()
        words = len(re.findall(r"\w+", text))
        exercises = len(re.findall(r"\*\*L\d\.\d+", text))
        lesson_id = os.path.basename(path)[:7]
        ans = os.path.join(ROOT, "12-ANSWERS-AND-EXPLANATIONS", lesson_id[:2],
                           lesson_id + "-ANSWERS.md")
        rows.append((rel, words, exercises, os.path.exists(ans)))
    return rows


if __name__ == "__main__":
    total, broken = check_links()
    print(f"Internal links checked: {total}")
    print(f"Broken links: {len(broken)}")
    for rel, no, target, why in broken:
        print(f"  {rel}:{no} -> {target} ({why})")
    mermaid = check_mermaid()
    print(f"Mermaid warnings: {len(mermaid)}")
    for rel, no, frag in mermaid:
        print(f"  {rel}:{no} -> {frag}")
    if "--stats" in sys.argv:
        print("\nLesson | words | numbered items | answer file")
        for rel, words, ex, has_ans in lesson_stats():
            flag = "" if words >= 900 and has_ans else "  <-- CHECK"
            print(f"{rel} | {words} | {ex} | {has_ans}{flag}")
    sys.exit(1 if (broken or mermaid) else 0)
