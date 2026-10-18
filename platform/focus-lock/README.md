# English Focus Lock (macOS)

Khóa máy Mac trong lúc học: bạn bắt đầu một buổi **Học tập trung** trên web (`/focus`), đặt mục tiêu (số bài phải hoàn thành, số phút học thật). Ứng dụng này che mọi màn hình bằng cửa sổ học cho tới khi đạt mục tiêu. Bạn học ngay trong cửa sổ khóa (bài học, từ vựng, các studio).

## Cài đặt

```bash
cd platform/focus-lock
./install.sh                               # máy chủ mặc định: http://127.0.0.1:8080 (Docker)
./install.sh http://127.0.0.1:8000 <token> # nếu dùng máy chủ khác hoặc có APP_ACCESS_TOKEN
```

Ứng dụng được cài vào `~/Applications/EnglishFocusLock.app` và một LaunchAgent cho nó tự chạy khi đăng nhập. Nó hỏi trạng thái máy chủ mỗi 3 giây và **không làm gì nếu bạn chưa bấm "Bắt đầu học & khóa máy"**.

Kiểm tra kết nối: `~/Applications/EnglishFocusLock.app/Contents/MacOS/EnglishFocusLock --check`

Tự kiểm tra: `--selftest` (logic khóa/mở) và `--clicktest` (cú bấm đầu tiên vào cửa sổ khóa phải tới được trang).

## Khi đang khóa

- Một cửa sổ phủ mọi màn hình. Màn hình chính hiện trang học, chỉ mở được địa chỉ của máy chủ học.
- Dock và menu bị ẩn. Cmd+Tab, Force Quit (⌥⌘⎋), Ẩn ứng dụng, đăng xuất và tắt máy qua menu đều bị chặn.
- Nếu máy khởi động lại khi buổi học chưa xong, ứng dụng khóa lại sau khi đăng nhập (tới khi hết thời gian tối đa).

## Lối thoát an toàn (luôn có)

1. **Tự mở khi đạt mục tiêu** hoặc khi hết **thời gian tối đa** (đặt khi bắt đầu, không ngắn hơn số phút mục tiêu + 30).
2. **Mở khẩn cấp trên trang `/focus`:** chờ 60 giây rồi nhập PIN (hoặc câu "tôi muốn dừng học" nếu chưa đặt PIN).
3. **Hủy trong 60 giây đầu** nếu bắt đầu nhầm.
4. **Máy chủ không chạy** (Docker tắt, lỗi mạng) khoảng 30 giây → tự mở khóa.
5. **Phím thoát của ứng dụng (không cần máy chủ):** `Ctrl + ⌥ + ⌘ + ⇧ + U` → chờ 10 giây → "Mở khóa".
6. **Từ máy khác hoặc qua SSH:** `platform/focus-lock/uninstall.sh`, hoặc `launchctl bootout gui/$(id -u)/com.englishmastery.focuslock`.

Mọi lần mở khẩn cấp đều được ghi trong lịch sử buổi học.

## Giới hạn

- Đây là công cụ tự kỷ luật, không phải phần mềm kiểm soát chống người dùng. Người có quyền quản trị máy luôn gỡ được.
- Nút nguồn cứng và Fast User Switching không bị chặn.
- Chỉ dành cho macOS 12 trở lên. Ứng dụng được ký ad-hoc, không cần tài khoản nhà phát triển Apple.

Gỡ cài đặt: `./uninstall.sh`
