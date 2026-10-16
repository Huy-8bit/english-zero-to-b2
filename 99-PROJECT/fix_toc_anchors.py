#!/usr/bin/env python3
"""Sửa các anchor nội bộ (#...) không khớp với heading thực tế trong cùng file.

Với mỗi liên kết dạng (#anchor) trỏ tới heading không tồn tại, script chọn
heading có slug gần giống nhất (cùng tiền tố mục, ví dụ "c-what") và thay thế.
Chạy từ thư mục english-zero-to-b2/:
    python3 99-PROJECT/fix_toc_anchors.py
"""
import difflib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_links import ROOT, md_files, slugify, HEADING_RE  # noqa: E402

ANCHOR_RE = re.compile(r"\]\(#([^)\s]+)\)")


def headings(text):
    slugs, in_code = [], False
    for line in text.splitlines():
        if line.startswith("```"):
            in_code = not in_code
            continue
        m = HEADING_RE.match(line)
        if m and not in_code:
            slugs.append(slugify(m.group(2)))
    return slugs


def main():
    fixed = 0
    for path in md_files():
        text = open(path, encoding="utf-8").read()
        slugs = headings(text)
        known = set(slugs)

        def repl(m):
            nonlocal fixed
            anchor = m.group(1)
            if anchor in known:
                return m.group(0)
            prefix = anchor.split("-")[0]
            candidates = [s for s in slugs if s.split("-")[0] == prefix] or slugs
            best = difflib.get_close_matches(anchor, candidates, n=1, cutoff=0.5)
            if not best:
                print(f"  no match: {os.path.relpath(path, ROOT)} #{anchor}")
                return m.group(0)
            fixed += 1
            return f"](#{best[0]})"

        new = ANCHOR_RE.sub(repl, text)
        if new != text:
            open(path, "w", encoding="utf-8").write(new)
    print(f"Anchors fixed: {fixed}")


if __name__ == "__main__":
    main()
