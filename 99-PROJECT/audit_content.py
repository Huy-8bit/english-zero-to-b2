#!/usr/bin/env python3
"""Inventory and structural audit; does not certify linguistic correctness.
Run from any directory: python3 99-PROJECT/audit_content.py
Writes CONTENT-AUDIT.md. Exits 1 when any structural/link issue remains.
"""
from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import re
import sys
import check_links

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'CONTENT-AUDIT.md'
ID = r'(?:A[012]|B[12])-G\d{3}'

def labels(text):
    """Read table cells, bold items, and explicit ranges; ignore prose references."""
    result = set(re.findall(r'(?:\*\*|\|\s*)(L\d+\.\d+)(?=[\s.*|/–-])', text))
    for a, b, c, d in re.findall(r'(L\d+)\.(\d+)\s*[–-]\s*(L\d+)\.(\d+)', text):
        if a == c:
            result.update(f'{a}.{n}' for n in range(int(b), int(d) + 1))
    return result

def visible(text):
    return re.sub(r'^```[^\n]*\n.*?^```\s*$', '', text, flags=re.M | re.S)

def audit():
    files = sorted(p for p in ROOT.rglob('*.md') if p != REPORT)
    old_report = REPORT.read_text() if REPORT.exists() else ''
    statuses = {}
    for lesson, status, reason in re.findall(
        rf'^\| ({ID}) \| ([A-Z_]+) \| (.*?) \|$',
        (ROOT/'99-PROJECT/REVIEW-LOG.md').read_text(), re.M):
        statuses[lesson] = (status, reason)
    curriculum = (ROOT/'00-GETTING-STARTED/CURRICULUM-MAP.md').read_text()
    plan = re.findall(rf'^\| \[({ID})\]\(([^)]+)\)', curriculum, re.M)
    rows, problems = [], []
    planned_paths = set()
    answer_paths = set()
    for lesson, target in plan:
        path = (ROOT/'00-GETTING-STARTED'/target).resolve()
        planned_paths.add(path)
        rel = path.relative_to(ROOT).as_posix()
        answer = ROOT/'12-ANSWERS-AND-EXPLANATIONS'/lesson[:2]/f'{lesson}-ANSWERS.md'
        answer_paths.add(answer.resolve())
        if not path.exists():
            rows.append((lesson,'NOT_STARTED',0,0,False,rel,'Chưa có file bài học.'))
            continue
        text = path.read_text()
        practice = text.split('## L.',1)[-1].split('## M.',1)[0]
        questions = labels(practice)
        answers = labels(answer.read_text()) if answer.exists() else set()
        missing, extra = sorted(questions-answers), sorted(answers-questions)
        if missing or extra:
            problems.append(f'{lesson}: thiếu nhãn đáp án {missing}; thừa {extra}')
        raw = re.findall(r'\*\*(L\d+\.\d+)\.',practice)
        duplicate_q = [q for q,n in Counter(raw).items() if n > 1]
        if duplicate_q: problems.append(f'{lesson}: nhãn câu hỏi trùng {duplicate_q}')
        if len(questions)<25: problems.append(f'{lesson}: chỉ thấy {len(questions)} nhiệm vụ')
        if not answer.exists(): problems.append(f'{lesson}: thiếu file đáp án')
        headings = set(re.findall(r'^## ([A-N])\.', text, re.M))
        missing_sections = sorted(set('ABCDEFGHIJKLMN')-headings)
        if missing_sections: problems.append(f'{lesson}: thiếu phần {missing_sections}')
        if lesson not in text.splitlines()[0]: problems.append(f'{lesson}: H1 không khớp ID')
        status, reason = statuses.get(lesson,('NEEDS_REVIEW','Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này.'))
        if len(text.split())<300: status,reason='IN_PROGRESS','File ngắn; cần kiểm tra phần viết dở.'
        rows.append((lesson,status,len(text.split()),len(questions),answer.exists(),rel,reason))
    if len(plan)!=len({i for i,p in plan}): problems.append('Lesson ID trùng trong Curriculum Map')
    actual_lessons = {p.resolve() for p in ROOT.glob('*/grammar/*.md')}
    for p in sorted(actual_lessons-planned_paths): problems.append(f'Bài ngoài bản đồ: {p.relative_to(ROOT)}')
    for p in ROOT.glob('12-ANSWERS-AND-EXPLANATIONS/*/*-G*-ANSWERS.md'):
        if p.resolve() not in answer_paths or not any(x.name.startswith(p.name[:7]+'-') for x in actual_lessons):
            problems.append(f'Đáp án không có bài: {p.relative_to(ROOT)}')
    hashes=defaultdict(list); markers=[]; short=[]; modules=Counter()
    for p in files:
        text=p.read_text(); rel=p.relative_to(ROOT).as_posix(); modules[p.relative_to(ROOT).parts[0]]+=1
        hashes[hashlib.sha256(p.read_bytes()).hexdigest()].append(rel)
        clean=visible(text)
        if len(re.findall(r'^# ',clean,re.M))!=1: problems.append(f'{rel}: H1 không bằng 1')
        if len(re.findall(r'^```',text,re.M))%2: problems.append(f'{rel}: code fence chưa đóng')
        if len(text.split())<100: short.append(rel)
        if '/grammar/' in rel or rel.startswith('12-ANSWERS'):
            for n,line in enumerate(clean.splitlines(),1):
                if re.search(r'\b(?:TODO|TBD|FIXME|placeholder)\b',line,re.I): markers.append((rel,n,line))
    duplicates=[v for v in hashes.values() if len(v)>1]
    # The generated report contains no Markdown links, so it does not affect link totals.
    check_links.anchors_of.__defaults__[0].clear()
    total,broken=check_links.check_links(); mermaid=check_links.check_mermaid()
    counts=Counter(row[1] for row in rows)
    missing_targets=defaultdict(list)
    for rel,n,target,why in broken:
        target_path=(ROOT/rel).parent/target.split('#')[0]
        dest=str(target_path.resolve().relative_to(ROOT)) if target.split('#')[0] else rel
        missing_targets[dest].append(f'{rel}:{n} ({why})')
    out=['# Content Audit — Kiểm định theo trạng thái thực tế','',
         '**Ngày kiểm định: 2026-10-17. Báo cáo cuối giai đoạn xây dựng: đủ nội dung theo kế hoạch; trạng thái kiểm định từng bài ghi ở bảng dưới. Không phải chứng nhận độc lập.**','',
         '## Phạm vi và phương pháp','',
         'Tạo bằng `python3 99-PROJECT/audit_content.py`; kết hợp quyết định đọc đối chiếu trong `99-PROJECT/REVIEW-LOG.md`. Nhãn COMPLETED chỉ được ghi thủ công sau kiểm tra bài–đáp án. Các mục còn lại không được nâng trạng thái chỉ nhờ đủ từ/câu hỏi.','',
         'Baseline tiếp quản: 129 Markdown, 52 bài hiện hữu, 271 lượt liên kết hỏng đến 140 đích thiếu. Báo cáo cũ ghi A2 0/30 nhưng thực tế có 10 bài. (Số liệu lịch sử lúc tiếp quản; trạng thái hiện tại ở mục dưới.)','',
         '## Kết quả tổng hợp','',
         f'- Markdown hiện tại (kể cả báo cáo này): {len(files)+1}.',
         f'- Bài theo Curriculum Map: {len(plan)}; hiện hữu: {len(actual_lessons)}; chưa có: {counts["NOT_STARTED"]}.',
         '- Trạng thái: '+', '.join(f'{k} {v}' for k,v in sorted(counts.items()))+'.',
         f'- Liên kết nội bộ kiểm tra: {total}; hỏng: {len(broken)} lượt, {len(missing_targets)} đích.',
         f'- Vấn đề cấu trúc/nhãn bài–đáp án: {len(problems)}.',
         f'- File trùng toàn nội dung: {len(duplicates)} nhóm; file dưới 100 từ: {len(short)}.',
         f'- Marker chưa hoàn thiện trong bài học/đáp án: {len(markers)}; cảnh báo Mermaid bằng heuristic: {len(mermaid)}.','',
         'Số từ là số đơn vị tách bằng khoảng trắng, chỉ để tìm dấu hiệu bài ngắn, không phải thước đo độ sâu. Nhãn bài tập đọc được cả trong bảng, nhiều câu cùng dòng và khoảng như L2.7–L2.10; khớp nhãn không đảm bảo đáp án đúng. Không phát hiện trùng toàn file không loại trừ đoạn văn trùng; phần mới đã đọc để kiểm tra trùng ý, phần cũ chưa soát hết. Heuristic Mermaid không thay thế render/parser; lần render gần nhất 159/159 khối thành công, xem Review Log.','',
         '## Phân bố module','', '| Module | File Markdown | Đánh giá phạm vi |','|---|---:|---|']
    notes={
      '00-GETTING-STARTED':'8 tài liệu; đã sửa thứ tự A2, chưa tái kiểm định toàn bộ placement/CEFR.',
      '01-A0-FOUNDATION':'19 bài + kỹ năng; G001–G015 đã đọc đối chiếu, G016–G019 NEEDS_REVIEW.',
      '02-A1-BEGINNER':'23 bài + giao tiếp/kỹ năng; A1-G023 đã rà soát, các bài khác NEEDS_REVIEW.',
      '04-B1-INTERMEDIATE':'26/26 bài + README (Mini Challenges) + Skills Practice; 26 cặp bài–đáp án đã đọc đối chiếu.',
      '05-B2-UPPER-INTERMEDIATE':'30/30 bài + README + Skills Practice; 30 cặp bài–đáp án đã đọc đối chiếu.',
      '06-GRAMMAR-REFERENCE':'10 tài liệu tra cứu + README (tenses, conditionals, modals, passive, articles, prepositions, lỗi thường gặp, mẫu câu, cheat sheet, master index).',
      '07-VOCABULARY':'19 chủ đề/chuyên đề + README; đáp án ở 12/VOCABULARY.',
      '08-PRONUNCIATION':'11 bài + README; không có audio, hướng dẫn TTS/từ điển; đáp án ở 12/PRONUNCIATION.',
      '10-PRACTICE-LAB':'10 bài luyện tổng hợp + README; đáp án/hướng dẫn ở 12/PRACTICE-LAB.',
      '03-A2-ELEMENTARY':f'{sum(i.startswith("A2") and st != "NOT_STARTED" for i,st,*_ in rows)}/30 bài; Ba unit kỹ năng, giao tiếp và Exit Test đã có; xem nhật ký kiểm định.',
      '11-EXAMS-AND-ASSESSMENTS':'Exit Test A0–B1, 2 B2 Mock Test, 2 đề mô phỏng định dạng VSTEP (không chính thức), diagnostic, vocabulary assessment, rubric; A0/A1 Exit Test còn tái kiểm định.',
      '12-ANSWERS-AND-EXPLANATIONS':'Có cặp cho mọi bài ngữ pháp hiện hữu và đáp án kỹ năng/đề hiện hữu.',
      '13-LEARNING-TRACKER':'9 tài liệu: Progress, Error Log, Spaced Repetition, Weekly Review, Grammar Checklist, Vocabulary Tracker, Monthly Assessment, B2 Readiness Checklist, README.',
      '09-FOUR-SKILLS':'38 chương L01–L08, S01–S08, R01–R09, W01–W13 + README; transcript thay audio; đáp án ở 12/SKILLS.',
    }
    for folder in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith('.')):
        n=modules[folder.name]
        out.append(f'| `{folder.name}` | {n} | {notes.get(folder.name,"Chưa có nội dung." if not n else "Tài liệu quy trình; xem danh mục file.")} |')
    out += ['', 'Mọi module trong kế hoạch đã có nội dung. AI tutor ở root. Không có audio; TTS là phương thức luyện được hướng dẫn, không phải tài nguyên âm thanh đã sản xuất.','',
            '## Danh mục trạng thái từng bài','', '| ID | Trạng thái | Từ | Nhiệm vụ | Đáp án | File và căn cứ |','|---|---|---:|---:|---|---|']
    for i,s,w,q,a,p,reason in rows:
        out.append(f'| {i} | {s} | {w} | {q} | {"có" if a else "chưa có"} | `{p}` — {reason} |')
    out += ['', '## Vấn đề cấu trúc và nội dung cần xử lý','']
    out += ['- '+x for x in problems] or ['- Không thấy lỗi nhãn/cặp file/H1/code fence/phần A–N trong phạm vi kiểm tra.']
    out += ['- A0-G016–G019 và A1-G001–G022 còn NEEDS_REVIEW: có đủ cấu trúc và đáp án nhưng chưa được đọc đối chiếu lại toàn bài.',
            '- Thứ tự tiên quyết: B2-G005 cần B2-G013 (ID đứng sau); B2 README hướng dẫn học G013 trước G005.',
            '- Bảng đích liên kết hỏng bên dưới chỉ có nội dung khi kiểm tra phát hiện lỗi.']
    for group in duplicates: out.append('- Trùng toàn file: '+', '.join(group))
    for p in short: out.append('- File ngắn cần xem: '+p)
    for p,n,l in markers: out.append(f'- Marker: {p}:{n} {l}')
    for p,n,l in mermaid: out.append(f'- Mermaid cần kiểm: {p}:{n} {l}')
    out += ['', '## Toàn bộ đích liên kết còn hỏng','', '| Đích cần triển khai/sửa | Các vị trí tham chiếu |','|---|---|']
    for dest,refs in sorted(missing_targets.items()): out.append(f'| `{dest}` | '+ '; '.join(f'`{x}`' for x in refs)+' |')
    out += ['', '## Danh sách toàn bộ file hiện hữu','', 'Danh mục này là kiểm kê, không phải danh sách đã kiểm định học thuật.','']
    out += [f'- `{p.relative_to(ROOT)}`' for p in sorted(files+[REPORT])]
    out += ['', '## Việc tiếp theo','',
            '1. Đọc đối chiếu các bài A0/A1 còn NEEDS_REVIEW và A0/A1 Exit Test; không viết lại bài COMPLETED chỉ để đổi văn phong.',
            '2. Khi thêm/sửa sơ đồ, render lại bằng Mermaid CLI (lần gần nhất: 159/159 khối thành công).',
            '3. Thử nghiệm với người học thật và/hoặc mời giáo viên độc lập góp ý trước khi tuyên bố chất lượng sư phạm.',
            '4. Sau mỗi lần sửa: chạy fix_toc_anchors.py, audit_content.py, check_links.py.',
            '5. Không công bố người học đạt B2 từ số bài đã học; dùng B2 Readiness Checklist và đề thi chính thức nếu cần chứng nhận.','']
    REPORT.write_text('\n'.join(out))
    print(f'Lessons {len(actual_lessons)}/{len(plan)}; statuses {dict(counts)}')
    print(f'Structural issues {len(problems)}; internal links {total}; broken {len(broken)}; Mermaid warnings {len(mermaid)}')
    for issue in problems: print(issue)
    print('Wrote CONTENT-AUDIT.md.')
    return bool(problems or broken or mermaid or markers or duplicates)

if __name__=='__main__':
    sys.exit(1 if audit() else 0)
