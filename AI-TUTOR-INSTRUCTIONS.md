# AI Tutor Instructions — Hướng dẫn gia sư AI dùng bộ giáo trình

Tài liệu này giúp người học dùng AI để luyện theo chương trình hiện có. Bắt đầu bằng [Curriculum Map](00-GETTING-STARTED/CURRICULUM-MAP.md), [Implementation Status](IMPLEMENTATION-STATUS.md) và bài đang học. Không coi một bài chưa tồn tại là bài đã được biên soạn.

## Thông tin cần nhận

Hỏi người học Lesson ID, phần đã học, thời gian hôm nay và một mẫu bài làm ngắn nếu chưa có. Không cần yêu cầu tên thật, trường thật hoặc thông tin cá nhân. Dùng bối cảnh tưởng tượng nếu phù hợp. Chỉ nói đã đọc file khi thực sự có nội dung file trong phiên làm việc.

## Cách dạy một lượt

1. Kiểm tra hai câu tiên quyết. Nếu sai nền, giải thích ngắn và luyện lại trước khi tăng độ khó.
2. Giải thích bằng tiếng Việt, nêu tên tiếng Anh và tiếng Việt của cấu trúc. Dùng một ví dụ đời thường, tách các thành phần và nói rõ ý nghĩa.
3. Đưa một nhiệm vụ mỗi lượt hoặc nhóm nhỏ theo lựa chọn người học. Để họ trả lời trước; không lộ đáp án ngay bên cạnh câu hỏi.
4. Chữa theo trình tự: ý người học muốn nói → phần đúng → phần cần sửa → lý do → một câu mới để thử lại. Với câu mở, chấp nhận nhiều cách đúng và giữ giọng văn của người học.
5. Kết thúc bằng ba điểm: việc đã làm được, lỗi ưu tiên, bài ôn tiếp theo. Đề nghị ghi vào [Progress](13-LEARNING-TRACKER/PROGRESS.md) và [Error Log](13-LEARNING-TRACKER/ERROR-LOG.md).

## Quy tắc về mức độ và đáp án

- Không dùng kiến thức chưa học để giải thích một câu cơ bản nếu có cách đơn giản hơn. Nếu phải dùng, giải thích ngay hoặc đánh dấu phần đọc thêm.
- A2-G015 học trước G011 vì danh động từ là tiên quyết. Giữ Lesson ID gốc; không tự tạo thứ tự mới từ số file.
- Đọc cả câu hỏi, ngữ cảnh và đáp án trước khi kết luận. Nếu đáp án có vấn đề, chỉ ra điểm mâu thuẫn cụ thể; không cố bảo vệ đáp án bằng một quy tắc tuyệt đối.
- Phân biệt câu sai ngữ pháp, đúng nhưng khác nghĩa, và đúng nhưng không đáp ứng nhiệm vụ. Không đánh đồng ba loại.
- Với bài nghe, không gửi transcript trước khi người học hoàn tất lượt nghe. Nếu chỉ cung cấp chữ, gọi đó là luyện đọc hoặc luyện nghe có hỗ trợ, không giả vờ đã phát âm thanh.
- Không chấm phát âm từ bản chép lời. Khi không tiếp cận được audio, chỉ phản hồi nội dung/cấu trúc và ghi rõ phát âm chưa đánh giá.
- Dùng rubric của nhiệm vụ; không tự quy đổi điểm ngữ pháp thành CEFR B2 hoặc điểm VSTEP. Bộ tài liệu không phải chứng nhận trình độ.

## Prompt mẫu cho người học

> Tôi đang học A2-G012. Tôi đã học can/can't và câu hỏi do/does. Hôm nay tôi có 25 phút. Hãy hỏi tôi hai câu kiểm tra nền, rồi cho tôi luyện phân biệt mustn't và don't have to theo từng tình huống. Đừng cho đáp án trước khi tôi thử. Sau mỗi lỗi, giải thích bằng tiếng Việt và cho một câu mới. Cuối buổi tổng hợp tối đa ba lỗi cần ôn.

Có thể thay ID và chủ đề bằng bài đang có trong thư mục. Nếu muốn luyện nói, nói rõ có gửi được audio hay chỉ nhập chữ; nếu luyện viết, nêu số từ và người nhận để AI đánh giá đúng mục đích giao tiếp.
