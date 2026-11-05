# VSTEP: đối chiếu đề cụ thể, 05/11/2026

## Nguồn đã đọc

Đã tải PDF, đọc phần Writing/Speaking và xem ảnh trang Speaking để kiểm tra các nhánh sơ đồ. Không lưu PDF của trường vào repository; ứng dụng dẫn tới bản gốc. Đây là **đề minh họa công bố**, không phải bằng chứng đề đã được sử dụng trong một ca thi cụ thể.

| Nguồn | Vị trí đã kiểm tra | Cách dùng |
| --- | --- | --- |
| [ULIS – ĐHQGHN: thể thức VSTEP](https://vstep.vnu.edu.vn/test-format/) | Bảng Writing và Speaking | Writing 60 phút: thư/email ≥120 từ, bài luận ≥250 từ. Speaking 12 phút: hỏi đáp hai chủ đề; chọn một trong ba giải pháp; phát triển chủ đề và hỏi đáp. |
| [Đại học Đồng Tháp: PDF đề minh họa](https://vstep.dthu.edu.vn/mainpage/page/27.pdf) | Trang PDF 17–18 | Thư tư vấn chuyến thăm; luận về học chung nam nữ; nói về ảnh/đồ ăn, quà đi xa, lợi ích du lịch. |
| [ĐH Ngoại ngữ – ĐH Đà Nẵng: PDF đề minh họa](https://vstep.ufl.udn.vn/files/2025/2025_9_3_41_23_569_de_thi_mau_vstep_3.5.pdf) | Trang PDF 15–16 | Giới thiệu người ở nhờ; tác động du lịch đến cộng đồng; nói về thời gian rảnh/khu phố, phương tiện Đà Nẵng–Hà Nội, đọc sách. |

Các đề trong ứng dụng được diễn đạt lại ngắn gọn, không chép nguyên trang thi. Bài trả lời, ví dụ, nhân vật phụ, dịch vụ và giá do ứng dụng tự biên soạn; không lấy đáp án của trường hoặc trang luyện thi. Đối với đề tự biên soạn, liên kết thể thức chỉ xác nhận cấu trúc, **không được trình bày như nguồn của tình huống**. Không gắn nhãn “đề thật”, ngày ca thi hoặc điểm B2 được chứng nhận.

## Những lỗi của bộ cũ và cách sửa

- 50 tình huống bị nhân qua 31 dạng để tạo 1.550 bài. Nhiều thư trở thành tổ chức hoạt động/hội thảo, nhiều bài luận dùng cùng lập luận chung. Số lượng này không chứng minh độ phủ đề thực tế.
- Khung thư mặc định ba yêu cầu có thể bỏ sót các câu hỏi nhỏ. Bộ mới đối chiếu từng nội dung của đề, kể cả giá, điều kiện dịch vụ và lịch trình.
- Speaking Part 2 cần cân nhắc ba lựa chọn theo tình huống. Bộ mới có mười bộ phương án khác nhau; giả định ngoài đề được nói rõ.
- Part 3 phát triển luận điểm theo nhánh gợi ý cụ thể hoặc ý riêng phù hợp. Không ép mọi chủ đề thành lợi ích–khó khăn–giải pháp.
- Những câu chung được thêm chỉ để đủ từ làm bài khó học và yếu lập luận. Hai mươi bài Writing mới được viết riêng, mỗi đoạn có nhiệm vụ và dẫn chứng theo đề.
- Các dạng bài trong UI là nhóm phục vụ học tập, không phải danh sách dạng đề chính thức hoặc đầy đủ của kỳ thi.

## Phạm vi thay đổi

Bộ chính mới: **50 bài**, gồm 10 bài cho mỗi Writing task / Speaking part. Mỗi nhóm có 2 bài phỏng theo đề minh họa và 8 đề luyện tự biên soạn (tổng 10 + 40). Các bài mới dùng ID `exam-*` để không nhận nhầm tiến độ của bài cũ.

Bộ 1.550 bài giữ nguyên trong mục “Bộ cũ · luyện thay ý theo khung”, có thông báo giới hạn ngay cả khi mở liên kết đã lưu. Đây không phải tuyên bố đã nghiên cứu và viết lại toàn bộ 1.550 bài. Chưa đạt lại quy mô cũ 5 nhóm × 10 bài cho từng mục đích thư/dạng luận trong bộ mới; ưu tiên sửa chất lượng và nguồn gốc trước khi tăng số lượng.

Reader hiển thị nguồn và trang PDF, yêu cầu tiếng Việt, nhánh Speaking, câu hỏi trước phần trả lời, đối chiếu yêu cầu với trích đoạn từ bài mẫu, và gạch chân ngôn ngữ chức năng. Chỉ học thuộc cách diễn đạt phù hợp; nội dung luận điểm phải thay theo đề. Các bài nói không có yêu cầu số từ chính thức trong thể thức đã đối chiếu; số từ UI là thống kê nội dung.

## Kiểm tra có thể tái chạy

```sh
python3 platform/scripts/reference_library/build_exam_library.py --check
python3 platform/scripts/reference_library/build_library.py --check
cd platform/frontend
npm run typecheck
npm run lint
npm test -- src/features/model-library
npx playwright test exam-library.spec.ts exam-library.mobile.spec.ts model-library.spec.ts model-library.mobile.spec.ts writing-memory.spec.ts --project=desktop --project=mobile
npm run build
```

Kiểm tra tự động bao gồm số lượng, số từ Writing, cấu trúc từng phần Speaking, nguồn/trang PDF, dữ liệu đối chiếu thực sự xuất hiện trong bài, nguyên văn trước/sau gạch chân, ID/tiến độ riêng, lỗi tải dữ liệu và giữ liên kết cũ. Kiểm tra này không thay thế chấm bài bởi giám khảo; không có điểm số tự nhận.
