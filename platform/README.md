# English Mastery — Interactive Learning Platform

Ứng dụng web học tiếng Anh tương tác, xây dựng trực tiếp từ giáo trình Markdown *English Mastery: From Zero to B2* nằm ngay thư mục cha (`../`). Giáo trình **không bị sao chép hay sửa**: backend đọc Markdown, tách thành các slide học và bài tập có chấm điểm. Khi bạn sửa Markdown, nội dung trên web tự cập nhật sau vài giây.

```text
Dashboard → Lộ trình → chọn bài → học từng slide → làm bài tập → xem giải thích → hoàn thành → bài tiếp theo
```

## Chạy bằng Docker Compose (khuyến nghị)

Yêu cầu: Docker với Compose v2; Python 3.11+ trên máy chủ cho script deploy/backup (hoặc `backend/.venv` từ setup).

```bash
cd platform
scripts/deploy.sh               # build → backup nếu đã có DB → migrate → kiểm tra healthy
```

Mở <http://localhost:8080>.

- **Hai container:**
  - `backend`: FastAPI, cổng nội bộ 8000.
  - `frontend`: nginx phục vụ bản build React và chuyển `/api` sang backend.
- **Giáo trình** (thư mục cha của `platform/`) được mount **chỉ đọc** vào `/content`. Sửa Markdown thì web tự cập nhật sau vài giây, không cần build lại.
- **Database có sẵn:** SQLite với WAL, foreign keys và Alembic migrations. DB `/data/english.db` và media `/data/media` nằm trong volume cố định `english-mastery_learning-data`; vẫn còn sau khi restart, rebuild hoặc `docker compose down`. Tên volume không phụ thuộc tên thư mục checkout.
- **Gia sư AI:** tạo `platform/.env` từ `.env.example` và điền `OPENAI_API_KEY`. Compose tự đọc file này; không có file vẫn chạy bình thường.
- **Đổi cổng:** `WEB_PORT=3000 docker compose up -d`.

Các lệnh hay dùng:

```bash
docker compose logs -f backend      # xem log
scripts/deploy.sh                   # cập nhật an toàn, có backup trước migration
docker compose down                 # dừng (giữ dữ liệu học)
docker compose up -d --wait          # bật lại, dùng DB cũ
```

Backup gồm DB + media + manifest/checksum; mặc định lưu vào `platform/backups/` (không đưa vào Git):

```bash
scripts/backup-db.sh --stop          # tạm dừng API, backup nhất quán DB + media, rồi bật lại
scripts/backup-db.sh                 # backup online: SQLite an toàn cả khi đang có WAL
scripts/restore-db.sh backups/docker-YYYYMMDDTHHMMSSffffffZ.tar.gz --replace
```

Restore Docker kiểm tra archive trước, dừng API nếu đang chạy, tạo bản `before-restore-*.tar.gz`, khôi phục DB/media và bật lại API nếu trước đó đang chạy. `--replace` cho phép thay thế dữ liệu đích; không có cờ này thì từ chối ghi đè. Nếu restore lỗi, API được giữ dừng để kiểm tra. **Không dùng `docker compose down -v` hoặc xóa volume nếu cần giữ dữ liệu.** Xem [hướng dẫn database, chuyển server và khôi phục](DATABASE.md).

## Chạy trực tiếp trên máy (phát triển)

Yêu cầu: Python 3.11+ (khuyến nghị có `uv`), Node.js 20+, và `ffprobe` (cài FFmpeg) để xác minh thời lượng file ghi âm trước khi gửi OpenAI. Docker đã bao gồm FFmpeg.

```bash
cd platform
scripts/setup.sh        # tạo backend/.venv, cài thư viện Python và npm, tạo .env từ .env.example
scripts/dev.sh          # backend http://localhost:8000 + frontend http://localhost:5173 (hot reload)
```

Dữ liệu học khi chạy trực tiếp nằm ở `backend/data/english.db`, tách riêng với volume Docker. Dùng `scripts/backup-db.sh --mode local`; script đọc `DATABASE_URL`/`MEDIA_DIR` giống backend. Chuyển local sang Docker bằng backup/restore theo [DATABASE.md](DATABASE.md), không tự động trộn hai database.

## Kiểm thử

```bash
cd backend && .venv/bin/python -m pytest -q                     # API + bất biến của content engine
cd frontend && npm run lint && npm test                                          # Vitest + Testing Library
cd frontend && npx playwright test                               # E2E desktop + mobile + axe a11y
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
│   ├── app/api/            REST: content, learning, vocab, analytics, auth, ai
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
- **Lịch ôn FSRS** (thư viện `py-fsrs`, tham số mặc định FSRS-6): Quên / Khó / Nhớ / Dễ. Thẻ trong bài học và module Từ vựng dùng **chung một tiến độ**. Tiến độ SM-2 cũ được chuyển sang một lần; bảng cũ được giữ nguyên.
- **Đề xuất:** bài đang dở → bài ngữ pháp kế tiếp từ cấp xuất phát → bài cần ôn → thẻ đến hạn → kỹ năng/kiểm tra khi xong ngữ pháp một cấp. Cấp xuất phát lấy từ Placement Test theo đúng 3 bước trong `PLACEMENT-ANSWERS.md` (khung tổng điểm, phần đầu tiên dưới 11/15, chọn cấp thấp hơn).

### API chính

`GET /api/levels · /api/modules · /api/lessons · /api/lessons/{id} · /api/lessons/{id}/steps · /api/path`
`PUT /api/progress/{id} · POST /api/lessons/{id}/complete · GET /api/progress`
`GET /api/quizzes/{id} · POST /api/quizzes/{id}/submit · POST /api/attempts/{id}/self-assess · GET /api/mistakes`
`GET /api/vocabulary · GET /api/vocabulary/due · POST /api/vocabulary/review · GET /api/vocabulary/stats` (thẻ trong bài học, FSRS)
`GET /api/vocab/overview · /topics · /entries · /entries/{id} · /lookup · /plan · /stats · /collections · POST /api/vocab/sessions · /sessions/{id}/answer · /sessions/{id}/finish · /capture · /tutor · /dialogue · /enrichment/*`
`GET /api/dashboard · /api/stats · /api/recommendations · GET|PUT /api/profile`
`GET /api/search?q= · /api/library · /api/docs?path= · /api/content/status · POST /api/content/reload`
`POST /api/activity/heartbeat · GET|POST /api/writing · GET|PUT /api/notes/{id} · GET /api/ai/status · POST /api/ai/tutor/chat`

Tài liệu tương tác: <http://localhost:8000/docs>.

### Bảo mật

Markdown render bằng `react-markdown` (không bật HTML thô) + `rehype-sanitize`: không có script, `onerror` hay link `javascript:` nào chạy được (có test). Mermaid chạy với `securityLevel: "strict"` và chỉ tải khi có sơ đồ. API `/api/docs` chặn path traversal và không phục vụ thư mục `platform/`. Mọi body request được Pydantic kiểm tra (độ dài, khoảng giá trị). Điểm và XP do server tính, không nhận từ frontend. Khóa API chỉ đọc ở backend.

## Từ vựng

**Kho từ.** 5.083 mục, trong đó 4.654 từ và cụm động từ khác nhau, A1–B2. Kho được tạo bởi `scripts/vocabulary/build_lexicon.py`:
- Từ giáo trình được dùng trước; không tạo lại.
- Nguồn bổ sung: CEFR-J 1.5, NGSL/NAWL 1.2, Wiktionary (kaikki.org), Tatoeba. Giấy phép xem `backend/app/vocabulary/data/SOURCES.md`.
- IPA chỉ lấy từ từ điển.
- Nghĩa lấy từ Wiktionary được đánh dấu là chưa được giáo viên rà soát.
- Tạo lại kho: `scripts/vocabulary/fetch_sources.sh`, rồi `backend/.venv/bin/python scripts/vocabulary/build_lexicon.py`. Backend tự nhập lại khi file thay đổi; tiến độ học được giữ.

**Học.**
- 10 chế độ: học từ mới, flashcards, gõ đáp án, nghe-chép, ngữ cảnh, collocation, sắp xếp câu, tự đặt câu (AI), ôn nhanh, hội thoại tình huống (AI).
- Có thêm luyện từ hay quên và bài tập AI cho từ yếu.
- Đáp án của các chế độ không dùng AI được chấm ở server; đáp án không gửi về trình duyệt trước khi bạn trả lời.
- Mỗi từ chỉ được xếp lịch FSRS một lần trong mỗi vòng của phiên học. Luyện thêm từ chưa đến hạn không làm đổi lịch ôn.
- Trang “Hôm nay” tính kế hoạch từ dữ liệu: số từ đến hạn, độ chính xác gần đây và tùy chọn của bạn.

**Bổ sung bằng AI.** `python -m app.vocabulary.enrich queue|run|review|approve|reject` (hoặc dùng mục “Dữ liệu từ vựng” trong trang Thống kê) xử lý các từ chưa có nghĩa tiếng Việt từ nguồn mở:
- chạy theo lô, mỗi lô có checkpoint, tự thử lại khi lỗi;
- kết quả phải được người duyệt mới xuất bản;
- AI không bao giờ được hỏi IPA.

**Liên kết với các module khác.**
- Reading/Listening: bấm vào từ để tra nghĩa theo ngữ cảnh rồi lưu.
- Writing: các gợi ý từ vựng có nút lưu.
- Speaking: các cụm từ hữu ích có nút lưu.
- Từ đã học xuất hiện trong bài viết hoặc bài nói được tính là “đã dùng”.

## Trợ lý học tập

Mở bằng nút **Trợ lý** trên thanh trên cùng, có ở mọi trang. Bạn có thể hỏi về:
- tiến độ học;
- từ vựng;
- khi nào hoàn thành mục tiêu;
- lỗi hay mắc;
- nên học gì tiếp.

Có thể bấm câu hỏi nhanh hoặc gõ câu hỏi tự do.

Cách trợ lý trả lời:
- **Số liệu do backend tính từ dữ liệu học thật** (`app/assistant.py`, `GET /api/assistant/insights`). AI chỉ diễn giải bằng tiếng Việt và được dặn không tự đưa ra con số.
- Thời gian hoàn thành được ước lượng theo nhịp học 4 tuần gần nhất (số bài hoàn thành mỗi tuần). Nếu chưa đủ dữ liệu, ước lượng theo mục tiêu số bài mỗi tuần. Câu trả lời luôn ghi rõ đây là ước lượng.
- Khi AI tắt hoặc lỗi, câu hỏi nhanh vẫn được trả lời trực tiếp từ dữ liệu.
- Lịch sử trò chuyện được lưu ở server và có thể xóa. Câu hỏi nhanh được cache khi dữ liệu học chưa đổi.

## Bàn phím

`→` / `←` chuyển slide (khi không gõ trong ô nhập) · `Enter` kiểm tra bài hoặc sang slide tiếp · `Esc` thoát chế độ tập trung / đóng hộp thoại · `⌘K` hoặc `/` tìm kiếm · Flashcards: `Space` lật, `1–4` chấm (Quên / Khó / Nhớ / Dễ) · Phiên học từ vựng: `1–4` chọn đáp án, `Enter` kiểm tra / tiếp tục, `Backspace` bỏ từ cuối khi sắp xếp câu.

## OpenAI và các studio

Sao chép `.env.example` thành `.env` nếu chưa có; đặt `OPENAI_API_KEY` ở backend và khởi động lại. Không có khóa: bài Markdown, quiz xác định, ghi chú, tiến độ và flashcards vẫn hoạt động. `AI_PROVIDER=fake` chỉ dùng cho test; UI hiển thị rõ “AI giả lập”. Không dùng kết quả giả lập làm đánh giá năng lực thật.

- **Gia sư:** ngữ cảnh slide hiện tại + đoạn giáo trình liên quan + tiến độ/lỗi gần đây; lịch sử được lưu.
- **Tạo bài tập AI:** chọn bài, dạng, độ khó, số câu; Structured Outputs, kiểm tra cấu trúc và lượt giải độc lập; lưu bộ bài, chấm xác định hoặc ngữ nghĩa, giải thích tiếng Việt, cập nhật lỗi và độ thành thạo.
- **Writing Studio:** đề từ giáo trình hoặc AI, bản nháp tự lưu trong trình duyệt, ba chế độ góp ý, lỗi theo câu, so sánh bản sửa, lịch sử ở DB.
- **Speaking Studio:** micro → upload → transcription → góp ý nội dung/ngữ pháp → câu tiếp theo và TTS; read aloud, hội thoại, role-play, VSTEP-style. Bản chép lời không phải bằng chứng để chấm phát âm. Audio học viên không lưu mặc định (`AI_STORE_USER_AUDIO=false`).
- **Listening Studio:** đoạn nghe và câu hỏi sinh cùng nhau, TTS cache; transcript ẩn trong kiểm tra đến khi nộp.
- **Reading Studio:** bài đọc, câu hỏi, trích dẫn bằng chứng, bấm giờ và lịch sử.
- **Sổ lỗi / kế hoạch / phân tích:** dựa vào dữ liệu đã lưu, không có thống kê giả. Điểm CEFR/VSTEP là ước tính tham khảo.

Model có thể đổi bằng `OPENAI_MODEL_*`. Các mặc định được đối chiếu với [model GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) và [bảng giá](https://developers.openai.com/api/docs/pricing) ngày 2026-10-17. Khả năng truy cập phụ thuộc tài khoản; vào **Cài đặt → kiểm tra model** sau khi thêm khóa. Chưa có khóa trong môi trường recovery nên chưa chạy API thật. Test SDK dùng HTTP mock, test luồng AI dùng FakeProvider.

`AI_RATE_LIMIT_PER_MINUTE`, `AI_DAILY_REQUEST_LIMIT`, `AI_MONTHLY_BUDGET_USD`, `AI_MAX_EXERCISE_COUNT`, `AI_MAX_AUDIO_SECONDS`, `AI_MAX_AUDIO_MB` giới hạn sử dụng. Giới hạn trong UI không vượt trần môi trường. `AI_TIMEOUT_SECONDS` và `AI_MAX_RETRIES` giới hạn timeout/retry. Chi phí là ước tính, không phải hóa đơn; model tùy chỉnh phải có giá trong `OPENAI_PRICING_JSON`. Ngân sách hiện chặn khi tổng ước tính đã đạt ngưỡng; chưa phải hard cap tài chính xuyên nhiều worker hoặc phiên Realtime. Nên giữ một API worker cho cấu hình cục bộ này.

## Truy cập, lưu trữ và nâng cấp

Một hồ sơ học cục bộ, không phải hệ thống tài khoản nhiều người. Docker mặc định chỉ bind `127.0.0.1:${WEB_PORT:-8080}`. Muốn mở mạng, đặt `APP_ACCESS_TOKEN` dài ngẫu nhiên trước khi đổi `WEB_BIND`; dùng HTTPS qua reverse proxy cho truy cập từ xa và microphone. Token đổi thành cookie HttpOnly; API key không đi ra frontend. Không đưa `.env` vào Git.

Backend tự chạy Alembic khi khởi động. DB cũ không có `alembic_version` được nhận diện và nâng từ baseline; test migration xác minh giữ user và attempts, test restart xác minh giữ slide, bản nháp, ghi chú. Sao lưu trước khi cập nhật bản chạy thật. Không dùng `docker compose down -v` nếu cần giữ dữ liệu.

API mới: `/api/ai/status`, `/api/ai/models/check`, `/api/ai/usage`, `/api/ai/tutor/chat`, `/api/ai/exercises/generate`, `/api/exercises`, `/api/ai/writing/evaluate`, `/api/ai/speaking/session`, `/api/ai/listening/generate`, `/api/ai/reading/generate`, `/api/learning/mistakes`, `/api/learning/recommendations`, `/api/learning/settings`. Xem schema đầy đủ tại `/docs` của backend.

## Kiểm thử và giới hạn

- Xem kết quả mới nhất, lỗi còn lại và bước tiếp theo trong [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Các con số cũ trong phần lịch sử không chứng minh trạng thái hiện tại.
- Pytest dùng DB/media tạm và AI tắt hoặc fake; Playwright dùng DB/media riêng ở `frontend/test-results`, mock microphone của Chrome, backend 8001 và frontend 5174. Không chạy test trên DB học thật.
- Chưa xác minh chất lượng AI thật, thoại Realtime, microphone thật hoặc độ chính xác chấm theo giáo viên độc lập. Không chứng nhận VSTEP/CEFR.
- PostgreSQL chưa được kiểm thử trong phiên này; runtime hiện được xác minh trên SQLite.
- Giáo trình không có audio thu sẵn. TTS do trình duyệt/OpenAI sinh; replay sử dụng cache. Test fake chỉ chứng minh luồng, không chứng minh chất lượng giọng nói.
- Bản nháp AI lưu trong trình duyệt; kết quả đã nộp ở DB. Không đồng bộ bản nháp AI giữa thiết bị.
- Chưa có service worker: khi API AI tắt, bài có sẵn vẫn dùng được qua backend; khi mất kết nối backend hoàn toàn, không tải bài mới.
- 36/128 bài có phần “Ký hiệu” cho trình khám phá công thức; bài khác giữ bảng gốc. Các mục không chuyển thành quiz được báo trong `CONTENT-IMPORT-REPORT.md` và giữ ở dạng nội dung.
- Tô sáng đoạn có định dạng phức tạp có thể không được khôi phục đúng vị trí.
