# Content Audit — Kiểm định theo trạng thái thực tế

**Ngày kiểm định: 2026-10-17. Báo cáo cuối giai đoạn xây dựng: đủ nội dung theo kế hoạch; trạng thái kiểm định từng bài ghi ở bảng dưới. Không phải chứng nhận độc lập.**

## Phạm vi và phương pháp

Tạo bằng `python3 99-PROJECT/audit_content.py`; kết hợp quyết định đọc đối chiếu trong `99-PROJECT/REVIEW-LOG.md`. Nhãn COMPLETED chỉ được ghi thủ công sau kiểm tra bài–đáp án. Các mục còn lại không được nâng trạng thái chỉ nhờ đủ từ/câu hỏi.

Baseline tiếp quản: 129 Markdown, 52 bài hiện hữu, 271 lượt liên kết hỏng đến 140 đích thiếu. Báo cáo cũ ghi A2 0/30 nhưng thực tế có 10 bài. (Số liệu lịch sử lúc tiếp quản; trạng thái hiện tại ở mục dưới.)

## Kết quả tổng hợp

- Markdown hiện tại (kể cả báo cáo này): 467.
- Bài theo Curriculum Map: 128; hiện hữu: 128; chưa có: 0.
- Trạng thái: COMPLETED 128.
- Liên kết nội bộ kiểm tra: 4570; hỏng: 0 lượt, 0 đích.
- Vấn đề cấu trúc/nhãn bài–đáp án: 0.
- File trùng toàn nội dung: 0 nhóm; file dưới 100 từ: 0.
- Marker chưa hoàn thiện trong bài học/đáp án: 0; cảnh báo Mermaid bằng heuristic: 0.

Số từ là số đơn vị tách bằng khoảng trắng, chỉ để tìm dấu hiệu bài ngắn, không phải thước đo độ sâu. Nhãn bài tập đọc được cả trong bảng, nhiều câu cùng dòng và khoảng như L2.7–L2.10; khớp nhãn không đảm bảo đáp án đúng. Không phát hiện trùng toàn file không loại trừ đoạn văn trùng; phần mới đã đọc để kiểm tra trùng ý, phần cũ chưa soát hết. Heuristic Mermaid không thay thế render/parser; lần render gần nhất 159/159 khối thành công, xem Review Log.

## Phân bố module

| Module | File Markdown | Đánh giá phạm vi |
|---|---:|---|
| `00-GETTING-STARTED` | 8 | 8 tài liệu; đã sửa thứ tự A2, chưa tái kiểm định toàn bộ placement/CEFR. |
| `01-A0-FOUNDATION` | 21 | 19 bài + kỹ năng; 19/19 đã đọc đối chiếu. |
| `02-A1-BEGINNER` | 26 | 23 bài + giao tiếp/kỹ năng; 23/23 đã đọc đối chiếu. |
| `03-A2-ELEMENTARY` | 33 | 30/30 bài; Ba unit kỹ năng, giao tiếp và Exit Test đã có; xem nhật ký kiểm định. |
| `04-B1-INTERMEDIATE` | 28 | 26/26 bài + README (Mini Challenges) + Skills Practice; 26 cặp bài–đáp án đã đọc đối chiếu. |
| `05-B2-UPPER-INTERMEDIATE` | 32 | 30/30 bài + README + Skills Practice; 30 cặp bài–đáp án đã đọc đối chiếu. |
| `06-GRAMMAR-REFERENCE` | 11 | 10 tài liệu tra cứu + README (tenses, conditionals, modals, passive, articles, prepositions, lỗi thường gặp, mẫu câu, cheat sheet, master index). |
| `07-VOCABULARY` | 20 | 19 chủ đề/chuyên đề + README; đáp án ở 12/VOCABULARY. |
| `08-PRONUNCIATION` | 12 | 11 bài + README; không có audio, hướng dẫn TTS/từ điển; đáp án ở 12/PRONUNCIATION. |
| `09-FOUR-SKILLS` | 43 | 38 chương L01–L08, S01–S08, R01–R09, W01–W13 + README; transcript thay audio; đáp án ở 12/SKILLS. |
| `10-PRACTICE-LAB` | 11 | 10 bài luyện tổng hợp + README; đáp án/hướng dẫn ở 12/PRACTICE-LAB. |
| `11-EXAMS-AND-ASSESSMENTS` | 12 | Exit Test A0–B1, 2 B2 Mock Test, 2 đề mô phỏng định dạng VSTEP (không chính thức), diagnostic, vocabulary assessment, rubric; A0/A1 Exit Test còn tái kiểm định. |
| `12-ANSWERS-AND-EXPLANATIONS` | 195 | Có cặp cho mọi bài ngữ pháp hiện hữu và đáp án kỹ năng/đề hiện hữu. |
| `13-LEARNING-TRACKER` | 9 | 9 tài liệu: Progress, Error Log, Spaced Repetition, Weekly Review, Grammar Checklist, Vocabulary Tracker, Monthly Assessment, B2 Readiness Checklist, README. |
| `99-PROJECT` | 2 | Tài liệu quy trình; xem danh mục file. |
| `platform` | 0 | Chưa có nội dung. |

Mọi module trong kế hoạch đã có nội dung. AI tutor ở root. Không có audio; TTS là phương thức luyện được hướng dẫn, không phải tài nguyên âm thanh đã sản xuất.

## Danh mục trạng thái từng bài

| ID | Trạng thái | Từ | Nhiệm vụ | Đáp án | File và căn cứ |
|---|---|---:|---:|---|---|
| A0-G001 | COMPLETED | 3557 | 28 | có | `01-A0-FOUNDATION/grammar/A0-G001-alphabet.md` — 28 nhiệm vụ; sửa double không bắt buộc, chỉ dẫn âm tên chữ, phân biệt luyện nghe có chuẩn bị; bổ sung mẫu, rubric và đáp án tự kiểm tra. |
| A0-G002 | COMPLETED | 3411 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G002-phonics-basics.md` — 27 nhiệm vụ; phân biệt nhãn phonics với độ dài âm, qu gồm hai âm, ngoại lệ và biến thể giọng; sửa cặp từ mẫu L4; bổ sung giải thích và rubric. |
| A0-G003 | COMPLETED | 3196 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G003-english-sounds-ipa.md` — Đã đọc đối chiếu toàn bài và 27 nhiệm vụ; sửa nguyên âm/IPA, phân loại /h/, đếm âm tiết, biến thể giọng và quy tắc tuyệt đối; bổ sung giải thích L2, rubric và tự kiểm tra. Không có audio đính kèm; luyện nghe mẫu qua nguồn từ điển/TTS theo hướng dẫn. |
| A0-G004 | COMPLETED | 3302 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G004-parts-of-speech.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 25 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G005 | COMPLETED | 3008 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G005-nouns-verbs-adjectives-adverbs.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 27 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G006 | COMPLETED | 2875 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G006-subject-pronouns.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 27 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G007 | COMPLETED | 2677 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G007-subject-verb-object.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 25 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G008 | COMPLETED | 3040 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G008-sentence-patterns.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 25 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G009 | COMPLETED | 3230 | 30 | có | `01-A0-FOUNDATION/grammar/A0-G009-verb-to-be.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 30 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G010 | COMPLETED | 3050 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G010-have-has.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 29 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G011 | COMPLETED | 2496 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G011-this-that-these-those.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 27 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G012 | COMPLETED | 3107 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G012-articles-basic.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 29 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G013 | COMPLETED | 2828 | 30 | có | `01-A0-FOUNDATION/grammar/A0-G013-singular-plural-nouns.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 30 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; sửa câu ví dụ D gây nhầm *new + s* với từ *news*. |
| A0-G014 | COMPLETED | 3024 | 33 | có | `01-A0-FOUNDATION/grammar/A0-G014-countable-uncountable.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 33 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G015 | COMPLETED | 3000 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G015-there-is-there-are.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); 29 nhiệm vụ khớp lời giải, kiểm tra quy tắc, ví dụ, biến thể đúng, mẫu và rubric L5; không phát hiện lỗi cần sửa; nội dung đã có rào đón biến thể từ lượt sửa trước. |
| A0-G016 | COMPLETED | 3238 | 32 | có | `01-A0-FOUNDATION/grammar/A0-G016-sentence-types.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A0-G017 | COMPLETED | 3036 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G017-question-words.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa tham chiếu mẹo QUASI cho đúng mục J. |
| A0-G018 | COMPLETED | 3503 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G018-numbers-dates-time-age.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A0-G019 | COMPLETED | 2911 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G019-likes-and-hobbies.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa ghi chú *want to learn* trong đáp án L5. |
| A1-G001 | COMPLETED | 3209 | 29 | có | `02-A1-BEGINNER/grammar/A1-G001-present-simple-affirmative.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; bỏ phép so sánh gây hiểu nhầm; ví dụ khái quát hóa thành *Many Vietnamese people eat rice*. |
| A1-G002 | COMPLETED | 2922 | 30 | có | `02-A1-BEGINNER/grammar/A1-G002-present-simple-negatives-questions.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G003 | COMPLETED | 2664 | 29 | có | `02-A1-BEGINNER/grammar/A1-G003-adverbs-of-frequency.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; viết lại dòng lỗi 7 cho rõ. |
| A1-G004 | COMPLETED | 2680 | 29 | có | `02-A1-BEGINNER/grammar/A1-G004-present-continuous.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G005 | COMPLETED | 2496 | 28 | có | `02-A1-BEGINNER/grammar/A1-G005-present-simple-vs-continuous.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G006 | COMPLETED | 2615 | 29 | có | `02-A1-BEGINNER/grammar/A1-G006-possessives.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; dòng lỗi 5 ghi là "kém tự nhiên" thay vì sai tuyệt đối. |
| A1-G007 | COMPLETED | 2517 | 29 | có | `02-A1-BEGINNER/grammar/A1-G007-object-pronouns.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G008 | COMPLETED | 2443 | 28 | có | `02-A1-BEGINNER/grammar/A1-G008-have-got.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; dòng lỗi 6 thống nhất với A0-G010 (*Have you a...?* là biến thể Anh-Anh cũ, không phải sai tuyệt đối). |
| A1-G009 | COMPLETED | 2942 | 29 | có | `02-A1-BEGINNER/grammar/A1-G009-prepositions-of-place.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; viết lại dòng lỗi 9 (*on/above*) bị lẫn; làm mềm ghi chú *near to/opposite of*. |
| A1-G010 | COMPLETED | 2639 | 29 | có | `02-A1-BEGINNER/grammar/A1-G010-prepositions-of-time.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; bỏ cặp thứ–ngày giả định trong email mẫu (thứ không khớp ngày). |
| A1-G011 | COMPLETED | 2410 | 27 | có | `02-A1-BEGINNER/grammar/A1-G011-imperatives.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa tiêu đề mục F (10 cách dùng); làm mềm khẳng định "ngoại lệ duy nhất" về lược chủ ngữ. |
| A1-G012 | COMPLETED | 2638 | 29 | có | `02-A1-BEGINNER/grammar/A1-G012-can-cant.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; L4.5 chấp nhận *the mountain*. |
| A1-G013 | COMPLETED | 2605 | 29 | có | `02-A1-BEGINNER/grammar/A1-G013-would-like.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G014 | COMPLETED | 2437 | 29 | có | `02-A1-BEGINNER/grammar/A1-G014-some-any.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; viết lại dòng lỗi 7 (*something cold*); sửa checklist số từ ghép; L1.4 ghi chú khả năng *somebody*. |
| A1-G015 | COMPLETED | 2361 | 29 | có | `02-A1-BEGINNER/grammar/A1-G015-much-many-a-lot-of.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa câu thoại không chuẩn *and not much money* thành *I didn't spend much money*. |
| A1-G016 | COMPLETED | 2478 | 29 | có | `02-A1-BEGINNER/grammar/A1-G016-past-simple-be.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G017 | COMPLETED | 3164 | 29 | có | `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; thêm ngoại lệ không gấp đôi *w/x/y*; rubric L5.1 bỏ *cried* khỏi danh sách động từ bất quy tắc. |
| A1-G018 | COMPLETED | 2483 | 29 | có | `02-A1-BEGINNER/grammar/A1-G018-past-simple-negatives-questions.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; không phát hiện lỗi cần sửa. |
| A1-G019 | COMPLETED | 2642 | 29 | có | `02-A1-BEGINNER/grammar/A1-G019-future-will.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa tiêu đề mục F; *I think he won't come* ghi là ít tự nhiên hơn, không phải sai. |
| A1-G020 | COMPLETED | 2828 | 29 | có | `02-A1-BEGINNER/grammar/A1-G020-be-going-to.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; L2.7/L2.8 chấp nhận hiện tại tiếp diễn chỉ kế hoạch; sửa câu mẫu L5.1 *or I'll probably*. |
| A1-G021 | COMPLETED | 2688 | 29 | có | `02-A1-BEGINNER/grammar/A1-G021-basic-conjunctions.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; làm mềm quy tắc *But* đầu câu (chỉ tránh trong văn học thuật/rất trang trọng). |
| A1-G022 | COMPLETED | 2621 | 29 | có | `02-A1-BEGINNER/grammar/A1-G022-comparatives.md` — Đã đọc đối chiếu B–M và đáp án (2026-10-17); khóa đáp án khớp nhiệm vụ L1–L4, mẫu và tiêu chí L5 có; bổ sung Knowledge Check vào file đáp án; sửa phần breakdown *more spacious*; *than I* ghi là trang trọng/cứng thay vì đánh dấu sai. |
| A1-G023 | COMPLETED | 3213 | 29 | có | `02-A1-BEGINNER/grammar/A1-G023-superlatives.md` — Đã đọc đối chiếu 29 nhiệm vụ; 12 ví dụ có phân tích; bổ sung lý do L2–L4/rubric; sửa khẳng định tuyệt đối về the, nhóm hai và tính từ hai âm tiết; thay xếp hạng địa lý mơ hồ bằng tình huống xác định hoặc ý kiến. |
| A2-G001 | COMPLETED | 3161 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G001-past-continuous.md` — Quá khứ tiếp diễn: sửa quy tắc thời lượng/trạng thái, phân tích 12 ví dụ, lời giải 29 nhiệm vụ và mẫu 84 từ. |
| A2-G002 | COMPLETED | 3448 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G002-past-simple-vs-past-continuous.md` — Hai thì quá khứ: When/While đều đúng trong câu cho phép; everyone was; sửa các câu không thực sự sai và bổ sung ngữ cảnh; 29 nhiệm vụ, mẫu 105 từ. |
| A2-G003 | COMPLETED | 3682 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G003-present-perfect-form.md` — Present perfect: bảng 54 động từ, get/got/gotten, since và dạng rút gọn; 29 nhiệm vụ, mẫu 61 từ. |
| A2-G004 | COMPLETED | 3259 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G004-present-perfect-experience.md` — Trải nghiệm: been/gone và ever không tuyệt đối; 29 nhiệm vụ, mẫu 83 từ và đủ mẫu nói. |
| A2-G005 | COMPLETED | 2864 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G005-present-perfect-just-already-yet.md` — Just/already/yet: chấp nhận have not yet finished, giải thích biến thể; 29 nhiệm vụ, mẫu 75 từ. |
| A2-G006 | COMPLETED | 3332 | 32 | có | `03-A2-ELEMENTARY/grammar/A2-G006-present-perfect-since-for.md` — Since/for: mốc 2025 minh họa nhất quán, trạng thái/thời lượng không suy quá nghĩa; 32 nhiệm vụ, mẫu 84 từ. |
| A2-G007 | COMPLETED | 3460 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G007-present-perfect-vs-past-simple.md` — Hai thì: loại khẳng định tuyệt đối theo dấu hiệu, dùng sự kiện hư cấu có mốc; đáp án mở chấp nhận góc nhìn hợp lệ; 29 nhiệm vụ, mẫu 127 từ. |
| A2-G008 | COMPLETED | 3150 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G008-present-continuous-future.md` — Lịch tương lai: không suy chắc vé/hợp đồng, không bắt buộc trạng ngữ thời gian trong mọi câu; 29 nhiệm vụ, mẫu 90 từ. |
| A2-G009 | COMPLETED | 3047 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G009-might-may-possibility.md` — May/might: bỏ phần trăm xác suất cố định, phân biệt ý nghĩa, sửa lỗi thực sự về dạng động từ; 29 nhiệm vụ, mẫu 75 từ đủ năm hình thức đề yêu cầu. |
| A2-G010 | COMPLETED | 3349 | 29 | có | `03-A2-ELEMENTARY/grammar/A2-G010-used-to.md` — Đọc lại toàn bài và 29 nhiệm vụ; thêm phân tích 10 ví dụ, lý do L2–L4, rubric và tự kiểm tra; sửa quy tắc thời lượng/năm, thêm ngữ cảnh sự kiện duy nhất; cập nhật tiên quyết và liên kết. |
| A2-G011 | COMPLETED | 2275 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G011-be-used-to-get-used-to.md` — 8 ví dụ phân tích, 25 nhiệm vụ khớp đáp án; kiểm tra trạng thái/quá trình, dạng sau giới từ, các thì và trả lời ngắn; có mẫu/rubric/tự kiểm tra. |
| A2-G012 | COMPLETED | 2147 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G012-must-have-to.md` — 8 ví dụ, 25 nhiệm vụ; kiểm tra cấm/không bắt buộc, must/have to không phân loại tuyệt đối, quá khứ/tương lai; đủ lời giải và rubric. |
| A2-G013 | COMPLETED | 2131 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G013-permission-can-could-may.md` — 8 ví dụ, 25 nhiệm vụ; kiểm tra người thực hiện, may I/could you, trả lời cho phép hiện tại; giải thích đáp án mở và biến thể. |
| A2-G014 | COMPLETED | 2091 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G014-should-ought-to.md` — 8 ví dụ, 25 nhiệm vụ; kiểm tra should/ought to, advice/obligation, câu hỏi và phủ định; mẫu viết trong giới hạn và rubric. |
| A2-G015 | COMPLETED | 2192 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G015-gerunds-infinitives-basic.md` — 8 ví dụ, 25 nhiệm vụ; đối chiếu enjoy/finish/avoid và want/plan/hope; phân biệt V-ing với thì tiếp diễn, chia V1; có mẫu/rubric/tự kiểm tra. |
| A2-G016 | COMPLETED | 2115 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G016-zero-conditional.md` — Đã đọc đối chiếu phần A–N, 8 ví dụ phân tích, 25 nhiệm vụ và lời giải; kiểm tra ngữ cảnh, biến thể đúng, rubric mở và tự kiểm tra. |
| A2-G017 | COMPLETED | 2122 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G017-first-conditional.md` — Đã đọc đối chiếu phần A–N, 8 ví dụ phân tích, 25 nhiệm vụ và lời giải; kiểm tra ngữ cảnh, biến thể đúng, rubric mở và tự kiểm tra. |
| A2-G018 | COMPLETED | 2127 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G018-relative-clauses-basic.md` — Đã đọc đối chiếu phần A–N, 8 ví dụ phân tích, 25 nhiệm vụ và lời giải; kiểm tra ngữ cảnh, biến thể đúng, rubric mở và tự kiểm tra. |
| A2-G019 | COMPLETED | 2031 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G019-passive-voice-basic.md` — Đã đọc đối chiếu phần A–N, 8 ví dụ phân tích, 25 nhiệm vụ và lời giải; kiểm tra ngữ cảnh, biến thể đúng, rubric mở và tự kiểm tra. |
| A2-G020 | COMPLETED | 2005 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G020-question-tags.md` — Đã đọc đối chiếu phần A–N, 8 ví dụ phân tích, 25 nhiệm vụ và lời giải; kiểm tra ngữ cảnh, biến thể đúng, rubric mở và tự kiểm tra. |
| A2-G021 | COMPLETED | 1997 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G021-adjective-order.md` — 8 ví dụ, 25 nhiệm vụ; thứ tự trung tính có ngoại lệ, a/an theo âm, tính từ không chia số nhiều; mẫu viết 61 từ. |
| A2-G022 | COMPLETED | 1836 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G022-adverbs-of-manner.md` — 9 ví dụ, 25 nhiệm vụ; phân biệt từ loại, good/well, hard/hardly, fast và vị trí trạng từ; mẫu viết 56 từ. |
| A2-G023 | COMPLETED | 1901 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G023-ed-ing-adjectives.md` — 9 ví dụ, 25 nhiệm vụ; phân biệt nguồn gây cảm xúc và người/vật trải nghiệm, không dùng quy tắc người/vật tuyệt đối; mẫu viết 60 từ. |
| A2-G024 | COMPLETED | 2032 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G024-quantifiers.md` — 9 ví dụ, 25 nhiệm vụ; a little không luôn đủ, loại danh từ, no/none và none of; lời giải chấp nhận biến thể đúng. |
| A2-G025 | COMPLETED | 2068 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G025-too-enough.md` — 9 ví dụ, 25 nhiệm vụ; too/very, enough với danh từ/tính từ/trạng từ, for + người + to V; lời giải và rubric mở. |
| A2-G026 | COMPLETED | 2274 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G026-articles-advanced.md` — Đã đối chiếu A–N, 9–10 ví dụ và 25 nhiệm vụ/lời giải; kiểm tra ý nghĩa, biến thể, câu mở, mẫu viết 50–70 từ và liên kết. |
| A2-G027 | COMPLETED | 2221 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G027-comparisons.md` — Đã đối chiếu A–N, 9–10 ví dụ và 25 nhiệm vụ/lời giải; kiểm tra ý nghĩa, biến thể, câu mở, mẫu viết 50–70 từ và liên kết. |
| A2-G028 | COMPLETED | 2165 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G028-indirect-questions.md` — Đã đối chiếu A–N, 9–10 ví dụ và 25 nhiệm vụ/lời giải; kiểm tra ý nghĩa, biến thể, câu mở, mẫu viết 50–70 từ và liên kết. |
| A2-G029 | COMPLETED | 2018 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G029-subject-object-questions.md` — Đã đối chiếu A–N, 9–10 ví dụ và 25 nhiệm vụ/lời giải; kiểm tra ý nghĩa, biến thể, câu mở, mẫu viết 50–70 từ và liên kết. |
| A2-G030 | COMPLETED | 2064 | 25 | có | `03-A2-ELEMENTARY/grammar/A2-G030-reflexive-pronouns.md` — Đã đối chiếu A–N, 9–10 ví dụ và 25 nhiệm vụ/lời giải; kiểm tra ý nghĩa, biến thể, câu mở, mẫu viết 50–70 từ và liên kết. |
| B1-G001 | COMPLETED | 3237 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G001-present-perfect-continuous.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G002 | COMPLETED | 3005 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G002-past-perfect.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa mẫu L5.1 (*had learned* → *learned* ở câu kết). |
| B1-G003 | COMPLETED | 2536 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G003-past-perfect-continuous.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G004 | COMPLETED | 2658 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G004-narrative-tenses.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa câu kết mẫu L5.1 cho đúng quan hệ nhân quả. |
| B1-G005 | COMPLETED | 2377 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G005-future-continuous.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa dòng lỗi I#6 bị trộn. |
| B1-G006 | COMPLETED | 2365 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G006-future-perfect.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa bản dịch F#8. |
| B1-G007 | COMPLETED | 2853 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G007-second-conditional.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; làm mềm quy tắc dấu phẩy khi *if* ở giữa câu. |
| B1-G008 | COMPLETED | 2802 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G008-third-conditional.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G009 | COMPLETED | 2458 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G009-wish-if-only.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G010 | COMPLETED | 2751 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G010-reported-statements.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G011 | COMPLETED | 2500 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G011-reported-questions-commands.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G012 | COMPLETED | 2506 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G012-passive-all-tenses.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa dòng lỗi I#6, đếm lại động từ bị động ở K, bỏ mốc niên đại còn tranh luận của Truyện Kiều. |
| B1-G013 | COMPLETED | 2824 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G013-defining-non-defining-relatives.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; thay số dân TP.HCM đã lỗi thời bằng dữ kiện ổn định. |
| B1-G014 | COMPLETED | 2500 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G014-modals-deduction-present.md` — Đã đọc đối chiếu B–M (11 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G015 | COMPLETED | 2589 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G015-modal-perfects.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G016 | COMPLETED | 2694 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G016-gerund-vs-infinitive.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 30 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G017 | COMPLETED | 2441 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G017-causative-have-get.md` — Đã đọc đối chiếu B–M (10 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G018 | COMPLETED | 2887 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa số chức năng từ nối trong K. |
| B1-G019 | COMPLETED | 2733 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G019-complex-sentences.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G020 | COMPLETED | 2935 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; mẫu L5.1 bổ sung đủ phrasal verb tách được có đại từ ở giữa. |
| B1-G021 | COMPLETED | 2785 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G021-verb-patterns.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G022 | COMPLETED | 2717 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G022-comparison-structures.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa ví dụ E1 bị dấu hỏi gây nhiễu. |
| B1-G023 | COMPLETED | 2898 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G023-adverbial-clauses.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G024 | COMPLETED | 2531 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G024-so-such.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B1-G025 | COMPLETED | 2551 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G025-both-either-neither-each-every.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; thay ví dụ *not ... either* thiếu tự nhiên; sửa *Neither does* trong hội thoại K. |
| B1-G026 | COMPLETED | 2878 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G001 | COMPLETED | 2909 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G001-mixed-conditionals.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G002 | COMPLETED | 2690 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G002-advanced-conditionals.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa hai chỗ *otherwise* sai logic (email K, mẫu L5.1). |
| B2-G003 | COMPLETED | 2649 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G003-unless-provided-in-case.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G004 | COMPLETED | 2660 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G005 | COMPLETED | 2743 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G006 | COMPLETED | 2720 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G006-advanced-reported-speech.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G007 | COMPLETED | 2930 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G007-relative-clause-reduction.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G008 | COMPLETED | 2568 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G008-participle-clauses.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G009 | COMPLETED | 2920 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G009-inversion.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G010 | COMPLETED | 2800 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G010-cleft-sentences-emphasis.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G011 | COMPLETED | 3036 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G011-advanced-modals.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G012 | COMPLETED | 2690 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G012-future-perfect-continuous.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa mâu thuẫn *was about to ... he agreed* trong email K. |
| B2-G013 | COMPLETED | 2707 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G013-perfect-infinitives-gerunds.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G014 | COMPLETED | 2862 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G014-advanced-gerund-infinitive.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G015 | COMPLETED | 2550 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G015-subjunctive.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G016 | COMPLETED | 2700 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G016-unreal-past-would-rather.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G017 | COMPLETED | 2909 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G017-advanced-linking-devices.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G018 | COMPLETED | 2891 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G018-contrast-concession.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; xóa dòng phân cách thừa trong bảng H. |
| B2-G019 | COMPLETED | 2867 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G019-purpose-result-reason.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G020 | COMPLETED | 2558 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G020-complex-noun-phrases.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G021 | COMPLETED | 2685 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G021-nominalisation.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; sửa ví dụ *a rapid growth* (growth không đếm được). |
| B2-G022 | COMPLETED | 2710 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G022-subject-verb-agreement.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G023 | COMPLETED | 2649 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G023-ellipsis-substitution.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; mẫu L5.1 bổ sung tỉnh lược sau trợ động từ cho khớp rubric. |
| B2-G024 | COMPLETED | 2645 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G024-parallel-structures.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G025 | COMPLETED | 2557 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G025-hedging-academic-language.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; thay mẹo ghi nhớ viết tắt sai chữ. |
| B2-G026 | COMPLETED | 2500 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G026-collocations.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; tách *fully understand* (động từ) khỏi cột tính từ. |
| B2-G027 | COMPLETED | 2776 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G027-discourse-markers.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; thay DM *In short* không hợp ngữ cảnh ở mẫu L5.1. |
| B2-G028 | COMPLETED | 2551 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G028-formal-informal.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; bỏ cặp thứ–ngày cố định chỉ đúng với một số năm. |
| B2-G029 | COMPLETED | 2881 | 28 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G029-sentence-transformation.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 28 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |
| B2-G030 | COMPLETED | 2954 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G030-argumentation.md` — Đã đọc đối chiếu B–M (12 ví dụ phân tích) và đáp án; 29 nhiệm vụ khớp lời giải, kiểm tra biến thể đúng, câu mở và mẫu/rubric L5; không phát hiện lỗi cần sửa. |

## Vấn đề cấu trúc và nội dung cần xử lý

- Không thấy lỗi nhãn/cặp file/H1/code fence/phần A–N trong phạm vi kiểm tra.
- Thứ tự tiên quyết: B2-G005 cần B2-G013 (ID đứng sau); B2 README hướng dẫn học G013 trước G005.
- Bảng đích liên kết hỏng bên dưới chỉ có nội dung khi kiểm tra phát hiện lỗi.

## Toàn bộ đích liên kết còn hỏng

| Đích cần triển khai/sửa | Các vị trí tham chiếu |
|---|---|

## Danh sách toàn bộ file hiện hữu

Danh mục này là kiểm kê, không phải danh sách đã kiểm định học thuật.

- `00-GETTING-STARTED/CURRICULUM-MAP.md`
- `00-GETTING-STARTED/HOW-TO-LEARN.md`
- `00-GETTING-STARTED/LEARNING-TECHNIQUES.md`
- `00-GETTING-STARTED/PLACEMENT-ANSWERS.md`
- `00-GETTING-STARTED/PLACEMENT-TEST.md`
- `00-GETTING-STARTED/README.md`
- `00-GETTING-STARTED/ROADMAP.md`
- `00-GETTING-STARTED/STUDY-SCHEDULE.md`
- `01-A0-FOUNDATION/A0-SKILLS-PRACTICE.md`
- `01-A0-FOUNDATION/README.md`
- `01-A0-FOUNDATION/grammar/A0-G001-alphabet.md`
- `01-A0-FOUNDATION/grammar/A0-G002-phonics-basics.md`
- `01-A0-FOUNDATION/grammar/A0-G003-english-sounds-ipa.md`
- `01-A0-FOUNDATION/grammar/A0-G004-parts-of-speech.md`
- `01-A0-FOUNDATION/grammar/A0-G005-nouns-verbs-adjectives-adverbs.md`
- `01-A0-FOUNDATION/grammar/A0-G006-subject-pronouns.md`
- `01-A0-FOUNDATION/grammar/A0-G007-subject-verb-object.md`
- `01-A0-FOUNDATION/grammar/A0-G008-sentence-patterns.md`
- `01-A0-FOUNDATION/grammar/A0-G009-verb-to-be.md`
- `01-A0-FOUNDATION/grammar/A0-G010-have-has.md`
- `01-A0-FOUNDATION/grammar/A0-G011-this-that-these-those.md`
- `01-A0-FOUNDATION/grammar/A0-G012-articles-basic.md`
- `01-A0-FOUNDATION/grammar/A0-G013-singular-plural-nouns.md`
- `01-A0-FOUNDATION/grammar/A0-G014-countable-uncountable.md`
- `01-A0-FOUNDATION/grammar/A0-G015-there-is-there-are.md`
- `01-A0-FOUNDATION/grammar/A0-G016-sentence-types.md`
- `01-A0-FOUNDATION/grammar/A0-G017-question-words.md`
- `01-A0-FOUNDATION/grammar/A0-G018-numbers-dates-time-age.md`
- `01-A0-FOUNDATION/grammar/A0-G019-likes-and-hobbies.md`
- `02-A1-BEGINNER/A1-COMMUNICATION.md`
- `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md`
- `02-A1-BEGINNER/README.md`
- `02-A1-BEGINNER/grammar/A1-G001-present-simple-affirmative.md`
- `02-A1-BEGINNER/grammar/A1-G002-present-simple-negatives-questions.md`
- `02-A1-BEGINNER/grammar/A1-G003-adverbs-of-frequency.md`
- `02-A1-BEGINNER/grammar/A1-G004-present-continuous.md`
- `02-A1-BEGINNER/grammar/A1-G005-present-simple-vs-continuous.md`
- `02-A1-BEGINNER/grammar/A1-G006-possessives.md`
- `02-A1-BEGINNER/grammar/A1-G007-object-pronouns.md`
- `02-A1-BEGINNER/grammar/A1-G008-have-got.md`
- `02-A1-BEGINNER/grammar/A1-G009-prepositions-of-place.md`
- `02-A1-BEGINNER/grammar/A1-G010-prepositions-of-time.md`
- `02-A1-BEGINNER/grammar/A1-G011-imperatives.md`
- `02-A1-BEGINNER/grammar/A1-G012-can-cant.md`
- `02-A1-BEGINNER/grammar/A1-G013-would-like.md`
- `02-A1-BEGINNER/grammar/A1-G014-some-any.md`
- `02-A1-BEGINNER/grammar/A1-G015-much-many-a-lot-of.md`
- `02-A1-BEGINNER/grammar/A1-G016-past-simple-be.md`
- `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md`
- `02-A1-BEGINNER/grammar/A1-G018-past-simple-negatives-questions.md`
- `02-A1-BEGINNER/grammar/A1-G019-future-will.md`
- `02-A1-BEGINNER/grammar/A1-G020-be-going-to.md`
- `02-A1-BEGINNER/grammar/A1-G021-basic-conjunctions.md`
- `02-A1-BEGINNER/grammar/A1-G022-comparatives.md`
- `02-A1-BEGINNER/grammar/A1-G023-superlatives.md`
- `03-A2-ELEMENTARY/A2-COMMUNICATION.md`
- `03-A2-ELEMENTARY/A2-SKILLS-PRACTICE.md`
- `03-A2-ELEMENTARY/README.md`
- `03-A2-ELEMENTARY/grammar/A2-G001-past-continuous.md`
- `03-A2-ELEMENTARY/grammar/A2-G002-past-simple-vs-past-continuous.md`
- `03-A2-ELEMENTARY/grammar/A2-G003-present-perfect-form.md`
- `03-A2-ELEMENTARY/grammar/A2-G004-present-perfect-experience.md`
- `03-A2-ELEMENTARY/grammar/A2-G005-present-perfect-just-already-yet.md`
- `03-A2-ELEMENTARY/grammar/A2-G006-present-perfect-since-for.md`
- `03-A2-ELEMENTARY/grammar/A2-G007-present-perfect-vs-past-simple.md`
- `03-A2-ELEMENTARY/grammar/A2-G008-present-continuous-future.md`
- `03-A2-ELEMENTARY/grammar/A2-G009-might-may-possibility.md`
- `03-A2-ELEMENTARY/grammar/A2-G010-used-to.md`
- `03-A2-ELEMENTARY/grammar/A2-G011-be-used-to-get-used-to.md`
- `03-A2-ELEMENTARY/grammar/A2-G012-must-have-to.md`
- `03-A2-ELEMENTARY/grammar/A2-G013-permission-can-could-may.md`
- `03-A2-ELEMENTARY/grammar/A2-G014-should-ought-to.md`
- `03-A2-ELEMENTARY/grammar/A2-G015-gerunds-infinitives-basic.md`
- `03-A2-ELEMENTARY/grammar/A2-G016-zero-conditional.md`
- `03-A2-ELEMENTARY/grammar/A2-G017-first-conditional.md`
- `03-A2-ELEMENTARY/grammar/A2-G018-relative-clauses-basic.md`
- `03-A2-ELEMENTARY/grammar/A2-G019-passive-voice-basic.md`
- `03-A2-ELEMENTARY/grammar/A2-G020-question-tags.md`
- `03-A2-ELEMENTARY/grammar/A2-G021-adjective-order.md`
- `03-A2-ELEMENTARY/grammar/A2-G022-adverbs-of-manner.md`
- `03-A2-ELEMENTARY/grammar/A2-G023-ed-ing-adjectives.md`
- `03-A2-ELEMENTARY/grammar/A2-G024-quantifiers.md`
- `03-A2-ELEMENTARY/grammar/A2-G025-too-enough.md`
- `03-A2-ELEMENTARY/grammar/A2-G026-articles-advanced.md`
- `03-A2-ELEMENTARY/grammar/A2-G027-comparisons.md`
- `03-A2-ELEMENTARY/grammar/A2-G028-indirect-questions.md`
- `03-A2-ELEMENTARY/grammar/A2-G029-subject-object-questions.md`
- `03-A2-ELEMENTARY/grammar/A2-G030-reflexive-pronouns.md`
- `04-B1-INTERMEDIATE/B1-SKILLS-PRACTICE.md`
- `04-B1-INTERMEDIATE/README.md`
- `04-B1-INTERMEDIATE/grammar/B1-G001-present-perfect-continuous.md`
- `04-B1-INTERMEDIATE/grammar/B1-G002-past-perfect.md`
- `04-B1-INTERMEDIATE/grammar/B1-G003-past-perfect-continuous.md`
- `04-B1-INTERMEDIATE/grammar/B1-G004-narrative-tenses.md`
- `04-B1-INTERMEDIATE/grammar/B1-G005-future-continuous.md`
- `04-B1-INTERMEDIATE/grammar/B1-G006-future-perfect.md`
- `04-B1-INTERMEDIATE/grammar/B1-G007-second-conditional.md`
- `04-B1-INTERMEDIATE/grammar/B1-G008-third-conditional.md`
- `04-B1-INTERMEDIATE/grammar/B1-G009-wish-if-only.md`
- `04-B1-INTERMEDIATE/grammar/B1-G010-reported-statements.md`
- `04-B1-INTERMEDIATE/grammar/B1-G011-reported-questions-commands.md`
- `04-B1-INTERMEDIATE/grammar/B1-G012-passive-all-tenses.md`
- `04-B1-INTERMEDIATE/grammar/B1-G013-defining-non-defining-relatives.md`
- `04-B1-INTERMEDIATE/grammar/B1-G014-modals-deduction-present.md`
- `04-B1-INTERMEDIATE/grammar/B1-G015-modal-perfects.md`
- `04-B1-INTERMEDIATE/grammar/B1-G016-gerund-vs-infinitive.md`
- `04-B1-INTERMEDIATE/grammar/B1-G017-causative-have-get.md`
- `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md`
- `04-B1-INTERMEDIATE/grammar/B1-G019-complex-sentences.md`
- `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md`
- `04-B1-INTERMEDIATE/grammar/B1-G021-verb-patterns.md`
- `04-B1-INTERMEDIATE/grammar/B1-G022-comparison-structures.md`
- `04-B1-INTERMEDIATE/grammar/B1-G023-adverbial-clauses.md`
- `04-B1-INTERMEDIATE/grammar/B1-G024-so-such.md`
- `04-B1-INTERMEDIATE/grammar/B1-G025-both-either-neither-each-every.md`
- `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md`
- `05-B2-UPPER-INTERMEDIATE/B2-SKILLS-PRACTICE.md`
- `05-B2-UPPER-INTERMEDIATE/README.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G001-mixed-conditionals.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G002-advanced-conditionals.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G003-unless-provided-in-case.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G006-advanced-reported-speech.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G007-relative-clause-reduction.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G008-participle-clauses.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G009-inversion.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G010-cleft-sentences-emphasis.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G011-advanced-modals.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G012-future-perfect-continuous.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G013-perfect-infinitives-gerunds.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G014-advanced-gerund-infinitive.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G015-subjunctive.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G016-unreal-past-would-rather.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G017-advanced-linking-devices.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G018-contrast-concession.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G019-purpose-result-reason.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G020-complex-noun-phrases.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G021-nominalisation.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G022-subject-verb-agreement.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G023-ellipsis-substitution.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G024-parallel-structures.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G025-hedging-academic-language.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G026-collocations.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G027-discourse-markers.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G028-formal-informal.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G029-sentence-transformation.md`
- `05-B2-UPPER-INTERMEDIATE/grammar/B2-G030-argumentation.md`
- `06-GRAMMAR-REFERENCE/ALL-CONDITIONALS.md`
- `06-GRAMMAR-REFERENCE/ALL-TENSES-COMPARISON.md`
- `06-GRAMMAR-REFERENCE/ARTICLES-GUIDE.md`
- `06-GRAMMAR-REFERENCE/COMMON-GRAMMAR-MISTAKES.md`
- `06-GRAMMAR-REFERENCE/GRAMMAR-CHEAT-SHEET.md`
- `06-GRAMMAR-REFERENCE/GRAMMAR-MASTER-INDEX.md`
- `06-GRAMMAR-REFERENCE/MODAL-VERBS-COMPARISON.md`
- `06-GRAMMAR-REFERENCE/PASSIVE-VOICE-GUIDE.md`
- `06-GRAMMAR-REFERENCE/PREPOSITIONS-GUIDE.md`
- `06-GRAMMAR-REFERENCE/README.md`
- `06-GRAMMAR-REFERENCE/SENTENCE-PATTERNS.md`
- `07-VOCABULARY/README.md`
- `07-VOCABULARY/VOC-01-daily-life.md`
- `07-VOCABULARY/VOC-02-family-relationships.md`
- `07-VOCABULARY/VOC-03-education.md`
- `07-VOCABULARY/VOC-04-work-careers.md`
- `07-VOCABULARY/VOC-05-travel-transportation.md`
- `07-VOCABULARY/VOC-06-food-health.md`
- `07-VOCABULARY/VOC-07-shopping-money.md`
- `07-VOCABULARY/VOC-08-technology.md`
- `07-VOCABULARY/VOC-09-environment.md`
- `07-VOCABULARY/VOC-10-society.md`
- `07-VOCABULARY/VOC-11-communication.md`
- `07-VOCABULARY/VOC-12-science.md`
- `07-VOCABULARY/VOC-13-culture.md`
- `07-VOCABULARY/VOC-14-media.md`
- `07-VOCABULARY/VOC-15-business.md`
- `07-VOCABULARY/VOC-16-common-phrasal-verbs.md`
- `07-VOCABULARY/VOC-17-common-collocations.md`
- `07-VOCABULARY/VOC-18-word-families.md`
- `07-VOCABULARY/VOC-19-commonly-confused-words.md`
- `08-PRONUNCIATION/PRON-01-ipa-reference.md`
- `08-PRONUNCIATION/PRON-02-vowels-consonants.md`
- `08-PRONUNCIATION/PRON-03-minimal-pairs.md`
- `08-PRONUNCIATION/PRON-04-word-stress.md`
- `08-PRONUNCIATION/PRON-05-sentence-stress.md`
- `08-PRONUNCIATION/PRON-06-connected-speech.md`
- `08-PRONUNCIATION/PRON-07-linking-sounds.md`
- `08-PRONUNCIATION/PRON-08-weak-forms.md`
- `08-PRONUNCIATION/PRON-09-intonation.md`
- `08-PRONUNCIATION/PRON-10-shadowing-practice.md`
- `08-PRONUNCIATION/PRON-11-vietnamese-learner-mistakes.md`
- `08-PRONUNCIATION/README.md`
- `09-FOUR-SKILLS/Listening/L01-basic-listening.md`
- `09-FOUR-SKILLS/Listening/L02-listening-for-keywords.md`
- `09-FOUR-SKILLS/Listening/L03-listening-for-main-ideas.md`
- `09-FOUR-SKILLS/Listening/L04-listening-for-details.md`
- `09-FOUR-SKILLS/Listening/L05-understanding-paraphrases.md`
- `09-FOUR-SKILLS/Listening/L06-note-completion.md`
- `09-FOUR-SKILLS/Listening/L07-concentration-exercises.md`
- `09-FOUR-SKILLS/Listening/L08-b1-b2-listening-practice.md`
- `09-FOUR-SKILLS/Listening/README.md`
- `09-FOUR-SKILLS/README.md`
- `09-FOUR-SKILLS/Reading/R01-reading-fundamentals.md`
- `09-FOUR-SKILLS/Reading/R02-skimming.md`
- `09-FOUR-SKILLS/Reading/R03-scanning.md`
- `09-FOUR-SKILLS/Reading/R04-finding-main-ideas.md`
- `09-FOUR-SKILLS/Reading/R05-inference.md`
- `09-FOUR-SKILLS/Reading/R06-paraphrase-recognition.md`
- `09-FOUR-SKILLS/Reading/R07-vocabulary-in-context.md`
- `09-FOUR-SKILLS/Reading/R08-b1-b2-reading-practice.md`
- `09-FOUR-SKILLS/Reading/R09-vstep-reading-strategies.md`
- `09-FOUR-SKILLS/Reading/README.md`
- `09-FOUR-SKILLS/Speaking/README.md`
- `09-FOUR-SKILLS/Speaking/S01-basic-sentence-building.md`
- `09-FOUR-SKILLS/Speaking/S02-everyday-conversations.md`
- `09-FOUR-SKILLS/Speaking/S03-describing-people-places.md`
- `09-FOUR-SKILLS/Speaking/S04-expressing-opinions.md`
- `09-FOUR-SKILLS/Speaking/S05-storytelling.md`
- `09-FOUR-SKILLS/Speaking/S06-fluency-exercises.md`
- `09-FOUR-SKILLS/Speaking/S07-vstep-speaking.md`
- `09-FOUR-SKILLS/Speaking/S08-speaking-evaluation-rubrics.md`
- `09-FOUR-SKILLS/Writing/README.md`
- `09-FOUR-SKILLS/Writing/W01-sentence-construction.md`
- `09-FOUR-SKILLS/Writing/W02-paragraph-writing.md`
- `09-FOUR-SKILLS/Writing/W03-topic-sentences.md`
- `09-FOUR-SKILLS/Writing/W04-supporting-ideas.md`
- `09-FOUR-SKILLS/Writing/W05-cohesion-coherence.md`
- `09-FOUR-SKILLS/Writing/W06-email-writing.md`
- `09-FOUR-SKILLS/Writing/W07-essay-writing.md`
- `09-FOUR-SKILLS/Writing/W08-opinion-essays.md`
- `09-FOUR-SKILLS/Writing/W09-discussion-essays.md`
- `09-FOUR-SKILLS/Writing/W10-advantages-disadvantages.md`
- `09-FOUR-SKILLS/Writing/W11-problem-solution.md`
- `09-FOUR-SKILLS/Writing/W12-vstep-writing-tasks.md`
- `09-FOUR-SKILLS/Writing/W13-writing-evaluation-rubrics.md`
- `10-PRACTICE-LAB/LAB-01-daily-grammar-drills.md`
- `10-PRACTICE-LAB/LAB-02-mixed-grammar-exercises.md`
- `10-PRACTICE-LAB/LAB-03-error-correction.md`
- `10-PRACTICE-LAB/LAB-04-sentence-transformation.md`
- `10-PRACTICE-LAB/LAB-05-translation-practice.md`
- `10-PRACTICE-LAB/LAB-06-real-life-dialogues.md`
- `10-PRACTICE-LAB/LAB-07-speaking-challenges.md`
- `10-PRACTICE-LAB/LAB-08-writing-challenges.md`
- `10-PRACTICE-LAB/LAB-09-weekly-review.md`
- `10-PRACTICE-LAB/LAB-10-monthly-review.md`
- `10-PRACTICE-LAB/README.md`
- `11-EXAMS-AND-ASSESSMENTS/A0-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/A1-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/A2-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/B1-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/B2-MOCK-TEST-1.md`
- `11-EXAMS-AND-ASSESSMENTS/B2-MOCK-TEST-2.md`
- `11-EXAMS-AND-ASSESSMENTS/GRAMMAR-DIAGNOSTIC-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/README.md`
- `11-EXAMS-AND-ASSESSMENTS/SKILL-EVALUATION-RUBRICS.md`
- `11-EXAMS-AND-ASSESSMENTS/VOCABULARY-ASSESSMENT.md`
- `11-EXAMS-AND-ASSESSMENTS/VSTEP-STYLE-MOCK-EXAM-1.md`
- `11-EXAMS-AND-ASSESSMENTS/VSTEP-STYLE-MOCK-EXAM-2.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G001-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G002-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G003-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G004-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G005-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G006-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G007-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G008-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G009-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G010-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G011-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G012-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G013-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G014-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G015-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G016-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G017-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G018-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A0/A0-G019-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G001-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G002-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G003-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G004-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G005-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G006-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G007-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G008-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G009-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G010-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G011-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G012-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G013-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G014-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G015-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G016-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G017-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G018-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G019-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G020-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G021-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G022-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A1/A1-G023-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G001-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G002-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G003-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G004-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G005-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G006-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G007-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G008-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G009-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G010-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G011-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G012-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G013-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G014-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G015-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G016-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G017-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G018-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G019-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G020-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G021-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G022-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G023-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G024-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G025-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G026-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G027-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G028-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G029-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/A2/A2-G030-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G001-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G002-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G003-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G004-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G005-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G006-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G007-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G008-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G009-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G010-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G011-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G012-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G013-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G014-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G015-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G016-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G017-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G018-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G019-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G020-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G021-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G022-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G023-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G024-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G025-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B1/B1-G026-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G001-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G002-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G003-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G004-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G005-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G006-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G007-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G008-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G009-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G010-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G011-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G012-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G013-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G014-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G015-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G016-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G017-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G018-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G019-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G020-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G021-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G022-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G023-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G024-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G025-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G026-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G027-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G028-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G029-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/B2/B2-G030-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A0-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A1-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A2-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B2-MOCK-TEST-1-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B2-MOCK-TEST-2-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/GRAMMAR-DIAGNOSTIC-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/VOCABULARY-ASSESSMENT-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/VSTEP-STYLE-MOCK-EXAM-1-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/VSTEP-STYLE-MOCK-EXAM-2-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-01-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-02-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-03-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-04-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-05-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-06-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-07-GUIDE.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-08-GUIDE.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-09-GUIDE.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRACTICE-LAB/LAB-10-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-01-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-02-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-03-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-04-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-05-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-06-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-07-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-08-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-09-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-10-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/PRONUNCIATION/PRON-11-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/README.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A0-LISTENING-TRANSCRIPTS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A0-SKILLS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A1-COMMUNICATION-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A1-LISTENING-TRANSCRIPTS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A1-SKILLS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A2-COMMUNICATION-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A2-LISTENING-TRANSCRIPTS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A2-SKILLS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/B1-LISTENING-TRANSCRIPTS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/B1-SKILLS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/B2-LISTENING-TRANSCRIPTS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/B2-SKILLS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/LISTENING-CHAPTERS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/READING-CHAPTERS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/SPEAKING-CHAPTERS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/SKILLS/WRITING-CHAPTERS-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-01-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-02-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-03-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-04-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-05-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-06-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-07-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-08-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-09-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-10-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-11-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-12-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-13-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-14-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-15-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-16-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-17-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-18-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/VOCABULARY/VOC-19-ANSWERS.md`
- `13-LEARNING-TRACKER/B2-READINESS-CHECKLIST.md`
- `13-LEARNING-TRACKER/ERROR-LOG.md`
- `13-LEARNING-TRACKER/GRAMMAR-CHECKLIST.md`
- `13-LEARNING-TRACKER/MONTHLY-ASSESSMENT.md`
- `13-LEARNING-TRACKER/PROGRESS.md`
- `13-LEARNING-TRACKER/README.md`
- `13-LEARNING-TRACKER/SPACED-REPETITION.md`
- `13-LEARNING-TRACKER/VOCABULARY-TRACKER.md`
- `13-LEARNING-TRACKER/WEEKLY-REVIEW.md`
- `99-PROJECT/AUTHORING-STANDARDS.md`
- `99-PROJECT/REVIEW-LOG.md`
- `AI-TUTOR-INSTRUCTIONS.md`
- `CONTENT-AUDIT.md`
- `IMPLEMENTATION-STATUS.md`
- `README.md`

## Việc tiếp theo

1. Khi sửa nội dung, không viết lại bài COMPLETED chỉ để đổi văn phong; ghi căn cứ vào Review Log.
2. Khi thêm/sửa sơ đồ, render lại bằng Mermaid CLI (lần gần nhất: 159/159 khối thành công).
3. Thử nghiệm với người học thật và/hoặc mời giáo viên độc lập góp ý trước khi tuyên bố chất lượng sư phạm.
4. Sau mỗi lần sửa: chạy fix_toc_anchors.py, audit_content.py, check_links.py.
5. Không công bố người học đạt B2 từ số bài đã học; dùng B2 Readiness Checklist và đề thi chính thức nếu cần chứng nhận.
