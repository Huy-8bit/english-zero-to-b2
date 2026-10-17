# Database, deploy và giữ dữ liệu học

Ứng dụng đã dùng **SQLite**, một database thực lưu tiến độ, lượt trả lời, XP, ghi chú và lịch sử AI. Cấu hình hiện tại phù hợp với một hồ sơ học trên một server/instance, có ổ đĩa persistent. Không cần đổi database để deploy cấu hình này lên VPS. Hosting có filesystem tạm thời phải gắn persistent disk; không đặt file SQLite trên NFS hoặc dùng nhiều API instance cùng ghi. PostgreSQL/multi-user là bước mở rộng riêng, chưa được hỗ trợ bởi bộ script backup này.

## Dữ liệu nằm ở đâu?

| Cách chạy | Database | Media |
|---|---|---|
| Docker | Volume `english-mastery_learning-data`, file `/data/english.db` | `/data/media` trong cùng volume |
| Local | `platform/backend/data/english.db` mặc định | `platform/backend/data/media` mặc định |

`LEARNING_DATA_VOLUME` cố định tên volume Docker. Giữ nguyên biến này khi đổi thư mục hoặc cập nhật code. Đổi tên volume sẽ chọn một database khác, không phải chuyển dữ liệu. Script deploy từ chối nếu volume cấu hình khác volume backend đang có. Docker luôn đặt `DATABASE_URL=sqlite:////data/english.db` và `MEDIA_DIR=/data/media`; cấu hình DB local không ghi đè vị trí này.

Với local, nên dùng đường dẫn tuyệt đối trong `DATABASE_URL`/`MEDIA_DIR`. Script hiểu đường dẫn tương đối từ `platform/backend/`, giống `scripts/dev.sh`.

Các thao tác restart, build image, recreate container và `docker compose down` không xóa volume. `docker compose down -v`, `docker volume rm`, xóa ổ đĩa hoặc mất máy chủ có thể làm mất dữ liệu. Vì vậy cần giữ bản backup ngoài máy chủ. Script không tự xóa các bản backup cũ.

## Cập nhật rồi bật lại

Từ thư mục `platform/`:

```bash
scripts/deploy.sh
```

Script build image trước để giảm thời gian gián đoạn; sau đó dừng API, backup DB/media hiện có, chạy lại các service và đợi healthcheck. Backend áp dụng Alembic migrations khi khởi động. Backup thất bại thì dừng deploy trước migration và bật lại container cũ. Healthcheck thất bại không tự downgrade schema: xem log và bản backup trước khi chọn khôi phục. Lần đầu chưa có volume thì tạo DB mới; nếu có volume học khác, script yêu cầu chọn đúng volume thay vì âm thầm tạo dữ liệu trắng. Chỉ dùng `ALLOW_NEW_DATABASE=1` nếu thực sự muốn tạo một cài đặt khác.

Chỉ tắt/bật lại, không cập nhật code:

```bash
docker compose down
docker compose up -d --wait
```

## Backup và kiểm tra

```bash
# Docker: snapshot đầy đủ khi API tạm dừng; tự bật lại nếu ban đầu đang chạy.
scripts/backup-db.sh --stop

# Docker online: DB nhất quán nhờ SQLite backup API (bao gồm committed WAL).
scripts/backup-db.sh

# Local: dùng DATABASE_URL và MEDIA_DIR từ môi trường / platform/.env.
scripts/backup-db.sh --mode local

# Chọn nơi lưu ngoài repo.
scripts/backup-db.sh --stop --backup-dir /srv/english-backups

# Kiểm tra file, checksum SHA-256, integrity, foreign keys, revision và số dòng.
python3 scripts/database.py verify backups/docker-YYYYMMDDTHHMMSSffffffZ.tar.gz
```

Archive `.tar.gz` gồm `english.db`, `media/`, `manifest.json`. Không chứa `.env`, API key hoặc giáo trình; cần giữ cấu hình và source code riêng khi chuyển server. Backup dữ liệu người học có quyền file `600`; thư mục mặc định mới tạo có quyền `700` và bị loại khỏi Git. `PYTHON_BIN` chọn Python riêng nếu cần, mặc định dùng `backend/.venv/bin/python` hoặc `python3` (3.11+).

Backup online đảm bảo snapshot SQLite nhất quán. Media được copy sau DB; nếu AI đang tạo/xóa file thì hai phần có thể khác thời điểm. Dùng `--stop` cho bản chuyển server/cập nhật quan trọng. Với local, dừng `scripts/dev.sh` trước khi cần snapshot media nhất quán. Không copy riêng `english.db` khi app đang chạy vì các giao dịch mới có thể còn trong `english.db-wal`.

Ví dụ cron trên Linux, chỉnh PATH và đường dẫn theo máy (Docker daemon phải chạy; tài khoản cron có quyền Docker):

```cron
PATH=/usr/local/bin:/usr/bin:/bin
0 3 * * * /srv/english-zero-to-b2/platform/scripts/backup-db.sh --stop --backup-dir /srv/english-backups >> /srv/english-backup.log 2>&1
```

Cron trên chỉ là ví dụ, không được tự cài. Sao chép archive sang máy/ổ lưu trữ khác theo lịch; một file backup trên cùng ổ đĩa không bảo vệ được khi ổ hỏng. Không có cơ chế tự xóa/retention; theo dõi dung lượng lưu trữ.

## Restore

Docker đang chạy hoặc đã dừng:

```bash
scripts/restore-db.sh /duong-dan/backup.tar.gz --replace
docker compose up -d --wait   # cần nếu ứng dụng đã dừng từ trước
```

Script xác minh archive trước khi dừng API. Nó kiểm tra không còn container khác đang dùng volume, tạo `backups/before-restore-*.tar.gz`, rồi thay DB và media. Checksum sai, archive lỗi hoặc thiếu `--replace` sẽ bị từ chối. File WAL/SHM cũ được loại khỏi DB mới khi app đã dừng. Giữ owner để user không phải root trong container vẫn đọc/ghi được. Restore không tự merge: trạng thái sau restore là thời điểm backup; phần mới hơn nằm trong backup `before-restore`.

Khi restore thành công, API tự bật lại nếu ban đầu đang chạy. Khi lỗi, kiểm tra thông báo và bản `before-restore`, sau đó mới chạy `docker compose start --wait backend`. Nếu máy bị tắt giữa lúc restore, có thể còn thư mục `.restore-*` trong data volume; giữ chúng và khôi phục lại từ archive hợp lệ. Luôn dùng code cùng phiên bản với backup hoặc phiên bản có migration đi lên tương thích; không dùng code cũ với schema mới.

Local:

```bash
# Dừng dev.sh/uvicorn và mọi tiến trình đang ghi vào DB trước.
scripts/restore-db.sh /duong-dan/backup.tar.gz --mode local --app-stopped --replace
scripts/dev.sh
```

`--app-stopped` là xác nhận của người vận hành cho local, không tự phát hiện mọi tiến trình ghi DB. Không chạy restore cùng lúc với deploy hoặc một phiên restore khác; các lệnh backup/restore cùng thư mục backup có khóa để tránh chạy đồng thời.

## Chuyển máy hoặc chuyển dữ liệu local sang Docker

1. Trên máy nguồn, chạy `scripts/backup-db.sh --stop` (Docker) hoặc dừng dev rồi chạy `scripts/backup-db.sh --mode local`.
2. Chuyển archive và repository (gồm giáo trình) sang server mới. Tạo `.env` từ `.env.example`, cấu hình token/AI riêng. Với truy cập từ xa, đặt `APP_ACCESS_TOKEN`, cấu hình HTTPS reverse proxy và cổng/bind phù hợp.
3. Trên server mới, trong `platform/`, chạy:

```bash
docker compose build
scripts/restore-db.sh /duong-dan/backup.tar.gz
docker compose up -d --wait
```

Nếu volume đích đã tồn tại, thêm `--replace` có chủ đích. Script sẽ sao lưu dữ liệu đang có trước khi thay. Không cần bật app tạo dữ liệu trắng trước restore. Local và Docker dùng chung định dạng archive; không có bước import làm mất ID hoặc lịch sử.

Các bản nháp AI chỉ lưu trong localStorage của trình duyệt chưa nằm trong database: backup DB không chuyển được phần nháp đó sang trình duyệt khác. Kết quả đã nộp, tiến độ server và lịch sử đã lưu trong DB vẫn được backup.
