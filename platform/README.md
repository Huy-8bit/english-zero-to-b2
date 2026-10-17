# English Mastery — Interactive Learning Platform

Ứng dụng web học tiếng Anh tương tác, xây dựng trực tiếp từ giáo trình Markdown *English Mastery: From Zero to B2* nằm ngay thư mục cha (`../`). Giáo trình **không bị sao chép hay sửa**: backend đọc Markdown, tách thành các slide học và bài tập có chấm điểm. Khi bạn sửa Markdown, nội dung trên web tự cập nhật sau vài giây.

```text
Dashboard → Lộ trình → chọn bài → học từng slide → làm bài tập → xem giải thích → hoàn thành → bài tiếp theo
```

## Chạy bằng Docker Compose (khuyến nghị)

Yêu cầu: Docker với Compose v2.

```bash
cd platform
docker compose up -d --build     # lần đầu build ~1–2 phút
```

Mở <http://localhost:8080>.

- **Hai container:**
  - `backend`: FastAPI, cổng nội bộ 8000.
  - `frontend`: nginx phục vụ bản build React và chuyển `/api` sang backend.
- **Giáo trình** (thư mục cha của `platform/`) được mount **chỉ đọc** vào `/content`. Sửa Markdown thì web tự cập nhật sau vài giây, không cần build lại.
- **Dữ liệu học** (SQLite) nằm trong volume `english-mastery_learning-data`, nên vẫn còn sau `docker compose down` và khi khởi động lại.
- **Gia sư AI:** tạo `platform/.env` từ `.env.example` và điền `ANTHROPIC_API_KEY`. Compose tự đọc file này; không có file vẫn chạy bình thường.
- **Đổi cổng:** `WEB_PORT=3000 docker compose up -d`.

Các lệnh hay dùng:

```bash
docker compose logs -f backend      # xem log
docker compose up -d --build        # cập nhật sau khi sửa code ứng dụng
docker compose down                 # dừng (giữ dữ liệu học)
docker compose down -v              # dừng và XÓA dữ liệu học
```

Sao lưu dữ liệu học:

```bash
docker compose cp backend:/data/english.db ./english-backup.db
```

## Chạy trực tiếp trên máy (phát triển)

Yêu cầu: Python 3.11+ (khuyến nghị có [`uv`](https://docs.astral.sh/uv/)), Node.js 20+.

```bash
cd platform
scripts/setup.sh        # tạo backend/.venv, cài thư viện Python và npm, tạo .env từ .env.example
scripts/dev.sh          # backend http://localhost:8000 + frontend http://localhost:5173 (hot reload)
```

Dữ liệu học khi chạy trực tiếp nằm ở `backend/data/english.db`, tách riêng với volume Docker.

## Kiểm thử

```bash
cd backend && .venv/bin/python -m pytest -q                     # API + bất biến của content engine (24 test)
cd frontend && npm test                                          # Vitest + Testing Library (14 test)
cd frontend && npx playwright test                               # E2E desktop + mobile + axe a11y (13 test)
backend/.venv/bin/python scripts/content_validation/validate_content.py   # → CONTENT-IMPORT-REPORT.md
```

Playwright tự khởi động backend riêng (cổng 8001, SQLite tạm trong `frontend/test-results/`) và Vite (5174), không đụng vào dữ liệu học thật. Mặc định dùng Google Chrome đã cài (`channel: chrome`); để dùng Chromium của Playwright: `npx playwright install chromium` và chạy với `PW_CHANNEL=` (rỗng).

## Kiến trúc

```text
platform/
├── backend/                FastAPI + SQLAlchemy + Pydantic
│   ├── app/content/        Content engine: catalog.py (khám phá bài), builder.py (Markdown → slide),
│   │                       exercises.py (bài tập & đáp án), md.py (bảng, heading), store.py (cache, tự reload, tìm kiếm)
│   ├── app/services/       grading.py (chấm), progress.py (XP, streak, huy hiệu, SM-2, đề xuất, xếp lớp)
│   ├── app/api/            REST: content, learning, vocab, analytics, tutor
│   └── tests/
├── frontend/               React 19 + TypeScript + Vite + Tailwind 4 + React Router + TanStack Query + Zustand + Motion
│   └── src/features/       dashboard, learning-path, lesson-player, quizzes, flashcards, vocabulary,
│                           progress, reference, search, tutor, catalog
├── docker-compose.yml      backend + frontend (nginx), giáo trình mount chỉ đọc, volume dữ liệu học
├── scripts/                setup.sh, dev.sh, content_validation/validate_content.py
└── CONTENT-IMPORT-REPORT.md   (sinh tự động)
```

### Content engine — từ Markdown đến slide

- **Phát hiện bài:** 128 bài ngữ pháp (theo ID `A1-G001`, khối học đọc từ README từng cấp), 19 chủ đề từ vựng, 11 bài phát âm, 38 chương kỹ năng, 10 bài Practice Lab, 11 bài kiểm tra (gồm Placement Test), 5 Skills Practice và 2 Communication: **224 bài học**. 51 tài liệu còn lại (tra cứu ngữ pháp, lộ trình, tracker…) mở ở Reference Mode.
- **Bài ngữ pháp (mục A–N)** → slide có kiểu riêng: A giới thiệu · B–D, J khái niệm · E công thức (bảng + thành phần bấm được khi bài có “Ký hiệu”) · F ví dụ (ẩn/hiện bản dịch, phân tích, nghe TTS) · G minh họa/timeline · H so sánh · I lỗi thường gặp (tự sửa rồi xem câu đúng) · K hội thoại (nghe từng câu) hoặc bài đọc · L bài tập theo Level · M tự kiểm tra (đáp án từ mục *Knowledge Check* của file đáp án) + checklist + tổng kết. Mục quá dài được tách theo heading `###`, không bao giờ cắt giữa bảng, công thức hay ví dụ.
- **Bài khác** tách theo heading của chính tài liệu; nhóm bài tập trở thành slide quiz, có biến thể *nghe* (gắn transcript tìm được trong file đáp án/transcript), *đọc* (bài đọc cạnh câu hỏi) và *kiểm tra* (đáp án chỉ hiện sau khi nộp toàn bài).
- **Bài tập chỉ tạo từ nhãn có sẵn trong nguồn** (`**L1.1.**`, `**12.**`, `**G01.**`, `**Nhiệm vụ 1:**`, danh sách đánh số của Practice Lab khi file đáp án có đúng các số đó). Đáp án ghép với mục tương ứng trong file đáp án theo tiêu đề và độ phủ nhãn (ví dụ “Listening 2” không nhận đáp án của “Listening 1”). **Không tự tạo đáp án.**
- **Dạng câu hỏi** suy ra từ nguồn: trắc nghiệm `A. … B. …`; True/False/Not Given; chọn trong ngoặc `(is / are)`; mã đáp án khai báo trong hướng dẫn (`**S** (simple)`, `quá rộng (R)`, `C/U`, ghép người A–D); sắp xếp câu (`a / b / c` + “Sắp xếp”); sửa lỗi (điền sẵn câu sai); dịch, viết lại câu; viết đoạn (trình soạn có đếm từ); nói (ghi âm).
- **Không lộ đáp án:** API `/steps` chỉ gửi đề bài; đáp án, giải thích và phương án đúng chỉ trả về sau `POST /api/quizzes/{id}/submit`. Có test tự động kiểm tra điều này.

### Chấm điểm

| Loại câu | Cách chấm |
|---|---|
| Trắc nghiệm, T/F/NG, chọn từ, mã đáp án | Tự động, đúng/sai tuyệt đối theo đáp án nguồn |
| Điền từ, sửa lỗi, viết lại, dịch, sắp xếp | Khớp với các biến thể ghi trong đáp án (chuẩn hóa hoa/thường, dấu câu, viết tắt) → **Đúng**. Không khớp → *không* kết luận sai: hiện đáp án mẫu để người học tự đánh giá |
| Viết đoạn, nói, tự kiểm tra | Hiện bài mẫu/rubric của giáo trình, người học tự đánh giá |

Điểm bài = (câu tự chấm đúng + câu tự đánh giá đúng) / số câu đã chấm, **tính ở server** từ lần trả lời gần nhất. Dưới 60% → trạng thái *Cần ôn lại*. Không thể hoàn thành bài khi chưa đi tới slide cuối.

### Tiến độ, XP, ôn tập

- Lưu thật trong DB: slide hiện tại, bản nháp câu trả lời, checklist, tô sáng, mọi lượt trả lời, điểm, thời gian học (heartbeat 30 giây khi tab đang mở và có thao tác), streak, lịch ôn từ vựng, lịch sử bài viết, ghi chú. Trạng thái bài còn được nhân bản vào `localStorage` nên mất mạng/refresh không mất câu trả lời; bản mới hơn được dùng khi mở lại.
- **XP** qua bảng sự kiện có khóa duy nhất: mỗi câu đúng lần đầu +10, tự đánh giá đúng +6, nộp bài viết/nói +8, hoàn thành bài +50 (một lần), ôn thẻ +2 (mỗi thẻ mỗi ngày), đạt mục tiêu ngày +20. Reload hay gửi trùng không cộng thêm.
- **Flashcards SM-2:** “Chưa nhớ” → ôn lại sau 1 ngày; nhớ → 1 ngày, 6 ngày, rồi nhân hệ số dễ (≥ 1.3).
- **Đề xuất:** bài đang dở → bài ngữ pháp kế tiếp từ cấp xuất phát → bài cần ôn → thẻ đến hạn → kỹ năng/kiểm tra khi xong ngữ pháp một cấp. Cấp xuất phát lấy từ Placement Test theo đúng 3 bước trong `PLACEMENT-ANSWERS.md` (khung tổng điểm, phần đầu tiên dưới 11/15, chọn cấp thấp hơn).

### API chính

`GET /api/levels · /api/modules · /api/lessons · /api/lessons/{id} · /api/lessons/{id}/steps · /api/path`
`PUT /api/progress/{id} · POST /api/lessons/{id}/complete · GET /api/progress`
`GET /api/quizzes/{id} · POST /api/quizzes/{id}/submit · POST /api/attempts/{id}/self-assess · GET /api/mistakes`
`GET /api/vocabulary · GET /api/vocabulary/due · POST /api/vocabulary/review · GET /api/vocabulary/stats`
`GET /api/dashboard · /api/stats · /api/recommendations · GET|PUT /api/profile`
`GET /api/search?q= · /api/library · /api/docs?path= · /api/content/status · POST /api/content/reload`
`POST /api/activity/heartbeat · GET|POST /api/writing · GET|PUT /api/notes/{id} · GET /api/tutor/status · POST /api/tutor/ask`

Tài liệu tương tác: <http://localhost:8000/docs>.

### Bảo mật

Markdown render bằng `react-markdown` (không bật HTML thô) + `rehype-sanitize`: không có script, `onerror` hay link `javascript:` nào chạy được (có test). Mermaid chạy với `securityLevel: "strict"` và chỉ tải khi có sơ đồ. API `/api/docs` chặn path traversal và không phục vụ thư mục `platform/`. Mọi body request được Pydantic kiểm tra (độ dài, khoảng giá trị). Điểm và XP do server tính, không nhận từ frontend. Khóa API chỉ đọc ở backend.

## Bàn phím

`→` / `←` chuyển slide (khi không gõ trong ô nhập) · `Enter` kiểm tra bài hoặc sang slide tiếp · `Esc` thoát chế độ tập trung / đóng hộp thoại · `⌘K` hoặc `/` tìm kiếm · Flashcards: `Space` lật, `1–4` chấm.

## Gia sư AI (tùy chọn)

Đặt `ANTHROPIC_API_KEY` trong `.env` để bật nút Gia sư trong trình học (model mặc định `claude-opus-5-5`, đổi bằng `TUTOR_MODEL`). Gia sư nhận nội dung slide hiện tại; đáp án bài tập chỉ được đưa vào ngữ cảnh khi người học đã nộp câu đó. Không có khóa → nút ẩn, mọi tính năng khác chạy bình thường.

## Giới hạn hiện tại

- **Một hồ sơ cục bộ**, chưa có đăng nhập/đồng bộ nhiều thiết bị (mô hình dữ liệu đã có `user_id` để bổ sung sau).
- **Không có audio gốc:** bài nghe, ví dụ, hội thoại dùng giọng đọc tổng hợp của trình duyệt (luôn ghi rõ). Chất lượng giọng phụ thuộc trình duyệt/hệ điều hành.
- **Ghi âm nói** chỉ lưu tạm trong tab (không gửi server). Nhận diện giọng nói (nếu trình duyệt có) chỉ chép lời gần đúng; hệ thống **không chấm phát âm**.
- **Câu trả lời mở** chỉ khớp với biến thể có trong đáp án; câu đúng nhưng diễn đạt khác cần người học tự đánh giá.
- **Gia sư AI** mới được kiểm thử ở trạng thái tắt (không có khóa API trong môi trường phát triển); luồng gọi API thật chưa chạy thử.
- Trình khám phá công thức chỉ xuất hiện ở 36/128 bài có phần “Ký hiệu”; các bài khác hiển thị bảng công thức gốc.
- 7 mục có tiêu đề giống bài tập nhưng là hướng dẫn/khung trả lời được giữ ở dạng slide nội dung (xem `CONTENT-IMPORT-REPORT.md`).
- Tô sáng bài đọc được khôi phục theo lần xuất hiện đầu tiên của đoạn chữ; đoạn tô vắt qua nhiều định dạng có thể không áp lại được.
- Chưa có service worker: offline chỉ giữ được tiến độ bài đang mở, không tải được bài mới.
- Thành phần UI viết theo phong cách shadcn/ui trên Radix (không sinh bằng CLI shadcn).
