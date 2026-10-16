# Content Audit — Kiểm định theo trạng thái thực tế

**Ngày kiểm định: 2026-10-16. Đây là báo cáo giữa kỳ, không phải chứng nhận hoàn thành dự án.**

## Phạm vi và phương pháp

Tạo bằng `python3 99-PROJECT/audit_content.py`; kết hợp quyết định đọc đối chiếu trong `99-PROJECT/REVIEW-LOG.md`. Nhãn COMPLETED chỉ được ghi thủ công sau kiểm tra bài–đáp án. Các mục còn lại không được nâng trạng thái chỉ nhờ đủ từ/câu hỏi.

Baseline tiếp quản: 129 Markdown, 52 bài hiện hữu, 271 lượt liên kết hỏng đến 140 đích thiếu. Báo cáo cũ ghi A2 0/30 nhưng thực tế có 10 bài. Không có Git metadata, AGENTS.md hoặc CLAUDE.md trong dự án.

## Kết quả tổng hợp

- Markdown hiện tại (kể cả báo cáo này): 264.
- Bài theo Curriculum Map: 128; hiện hữu: 108; chưa có: 20.
- Trạng thái: COMPLETED 34, NEEDS_REVIEW 74, NOT_STARTED 20.
- Liên kết nội bộ kiểm tra: 2755; hỏng: 213 lượt, 90 đích.
- Vấn đề cấu trúc/nhãn bài–đáp án: 0.
- File trùng toàn nội dung: 0 nhóm; file dưới 100 từ: 0.
- Marker chưa hoàn thiện trong bài học/đáp án: 0; cảnh báo Mermaid bằng heuristic: 0.

Số từ là số đơn vị tách bằng khoảng trắng, chỉ để tìm dấu hiệu bài ngắn, không phải thước đo độ sâu. Nhãn bài tập đọc được cả trong bảng, nhiều câu cùng dòng và khoảng như L2.7–L2.10; khớp nhãn không đảm bảo đáp án đúng. Không phát hiện trùng toàn file không loại trừ đoạn văn trùng; phần mới đã đọc để kiểm tra trùng ý, phần cũ chưa soát hết. Heuristic Mermaid không thay thế render/parser; 84 khối đã render thành công, xem Review Log.

## Phân bố module

| Module | File Markdown | Đánh giá phạm vi |
|---|---:|---|
| `00-GETTING-STARTED` | 8 | 8 tài liệu; đã sửa thứ tự A2, chưa tái kiểm định toàn bộ placement/CEFR. |
| `01-A0-FOUNDATION` | 21 | 19 bài + kỹ năng; G003 đã sửa và rà soát, các bài khác xem bảng trạng thái. |
| `02-A1-BEGINNER` | 26 | 23 bài + giao tiếp/kỹ năng; cần rà soát đáp án và chiều sâu ví dụ. |
| `03-A2-ELEMENTARY` | 33 | 30/30 bài; Ba unit kỹ năng, giao tiếp và Exit Test đã có; xem nhật ký kiểm định. |
| `04-B1-INTERMEDIATE` | 28 | Tài liệu quy trình; xem danh mục file. |
| `05-B2-UPPER-INTERMEDIATE` | 10 | Tài liệu quy trình; xem danh mục file. |
| `06-GRAMMAR-REFERENCE` | 0 | Chưa có nội dung. |
| `07-VOCABULARY` | 0 | Chưa có nội dung. |
| `08-PRONUNCIATION` | 0 | Chưa có nội dung. |
| `09-FOUR-SKILLS` | 1 | Có Listening README, bài kỹ năng nằm ở từng cấp; chưa có chuyên đề L/S/R/W. |
| `10-PRACTICE-LAB` | 0 | Chưa có nội dung. |
| `11-EXAMS-AND-ASSESSMENTS` | 4 | Có A0/A1/A2 Exit Test; A2 đã đối chiếu, A0/A1 còn tái kiểm định. |
| `12-ANSWERS-AND-EXPLANATIONS` | 122 | Có cặp cho mọi bài ngữ pháp hiện hữu và đáp án kỹ năng/đề hiện hữu. |
| `13-LEARNING-TRACKER` | 5 | 5 tài liệu dùng ngay; còn thiếu Vocabulary Tracker và B2 Checklist. |
| `99-PROJECT` | 2 | Tài liệu quy trình; xem danh mục file. |

Các module Grammar Reference, Vocabulary, Pronunciation, Practice Lab, B1 và B2 vẫn chưa có bài. AI tutor đã có ở root. Không có audio; TTS là phương thức luyện được hướng dẫn, không phải tài nguyên âm thanh đã sản xuất.

## Danh mục trạng thái từng bài

| ID | Trạng thái | Từ | Nhiệm vụ | Đáp án | File và căn cứ |
|---|---|---:|---:|---|---|
| A0-G001 | COMPLETED | 3557 | 28 | có | `01-A0-FOUNDATION/grammar/A0-G001-alphabet.md` — 28 nhiệm vụ; sửa double không bắt buộc, chỉ dẫn âm tên chữ, phân biệt luyện nghe có chuẩn bị; bổ sung mẫu, rubric và đáp án tự kiểm tra. |
| A0-G002 | COMPLETED | 3411 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G002-phonics-basics.md` — 27 nhiệm vụ; phân biệt nhãn phonics với độ dài âm, qu gồm hai âm, ngoại lệ và biến thể giọng; sửa cặp từ mẫu L4; bổ sung giải thích và rubric. |
| A0-G003 | COMPLETED | 3196 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G003-english-sounds-ipa.md` — Đã đọc đối chiếu toàn bài và 27 nhiệm vụ; sửa nguyên âm/IPA, phân loại /h/, đếm âm tiết, biến thể giọng và quy tắc tuyệt đối; bổ sung giải thích L2, rubric và tự kiểm tra. Không có audio đính kèm; luyện nghe mẫu qua nguồn từ điển/TTS theo hướng dẫn. |
| A0-G004 | NEEDS_REVIEW | 3302 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G004-parts-of-speech.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G005 | NEEDS_REVIEW | 3008 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G005-nouns-verbs-adjectives-adverbs.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G006 | NEEDS_REVIEW | 2875 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G006-subject-pronouns.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G007 | NEEDS_REVIEW | 2677 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G007-subject-verb-object.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G008 | NEEDS_REVIEW | 3040 | 25 | có | `01-A0-FOUNDATION/grammar/A0-G008-sentence-patterns.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G009 | NEEDS_REVIEW | 3230 | 30 | có | `01-A0-FOUNDATION/grammar/A0-G009-verb-to-be.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G010 | NEEDS_REVIEW | 3050 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G010-have-has.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G011 | NEEDS_REVIEW | 2496 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G011-this-that-these-those.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G012 | NEEDS_REVIEW | 3107 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G012-articles-basic.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G013 | NEEDS_REVIEW | 2826 | 30 | có | `01-A0-FOUNDATION/grammar/A0-G013-singular-plural-nouns.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G014 | NEEDS_REVIEW | 3024 | 33 | có | `01-A0-FOUNDATION/grammar/A0-G014-countable-uncountable.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G015 | NEEDS_REVIEW | 3000 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G015-there-is-there-are.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G016 | NEEDS_REVIEW | 3238 | 32 | có | `01-A0-FOUNDATION/grammar/A0-G016-sentence-types.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G017 | NEEDS_REVIEW | 3033 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G017-question-words.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G018 | NEEDS_REVIEW | 3503 | 27 | có | `01-A0-FOUNDATION/grammar/A0-G018-numbers-dates-time-age.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A0-G019 | NEEDS_REVIEW | 2911 | 29 | có | `01-A0-FOUNDATION/grammar/A0-G019-likes-and-hobbies.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G001 | NEEDS_REVIEW | 3207 | 29 | có | `02-A1-BEGINNER/grammar/A1-G001-present-simple-affirmative.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G002 | NEEDS_REVIEW | 2922 | 30 | có | `02-A1-BEGINNER/grammar/A1-G002-present-simple-negatives-questions.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G003 | NEEDS_REVIEW | 2636 | 29 | có | `02-A1-BEGINNER/grammar/A1-G003-adverbs-of-frequency.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G004 | NEEDS_REVIEW | 2680 | 29 | có | `02-A1-BEGINNER/grammar/A1-G004-present-continuous.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G005 | NEEDS_REVIEW | 2496 | 28 | có | `02-A1-BEGINNER/grammar/A1-G005-present-simple-vs-continuous.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G006 | NEEDS_REVIEW | 2607 | 29 | có | `02-A1-BEGINNER/grammar/A1-G006-possessives.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G007 | NEEDS_REVIEW | 2517 | 29 | có | `02-A1-BEGINNER/grammar/A1-G007-object-pronouns.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G008 | NEEDS_REVIEW | 2421 | 28 | có | `02-A1-BEGINNER/grammar/A1-G008-have-got.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G009 | NEEDS_REVIEW | 2939 | 29 | có | `02-A1-BEGINNER/grammar/A1-G009-prepositions-of-place.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G010 | NEEDS_REVIEW | 2641 | 29 | có | `02-A1-BEGINNER/grammar/A1-G010-prepositions-of-time.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G011 | NEEDS_REVIEW | 2382 | 27 | có | `02-A1-BEGINNER/grammar/A1-G011-imperatives.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G012 | NEEDS_REVIEW | 2638 | 29 | có | `02-A1-BEGINNER/grammar/A1-G012-can-cant.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G013 | NEEDS_REVIEW | 2605 | 29 | có | `02-A1-BEGINNER/grammar/A1-G013-would-like.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G014 | NEEDS_REVIEW | 2430 | 29 | có | `02-A1-BEGINNER/grammar/A1-G014-some-any.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G015 | NEEDS_REVIEW | 2355 | 29 | có | `02-A1-BEGINNER/grammar/A1-G015-much-many-a-lot-of.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G016 | NEEDS_REVIEW | 2478 | 29 | có | `02-A1-BEGINNER/grammar/A1-G016-past-simple-be.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G017 | NEEDS_REVIEW | 3152 | 29 | có | `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G018 | NEEDS_REVIEW | 2483 | 29 | có | `02-A1-BEGINNER/grammar/A1-G018-past-simple-negatives-questions.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G019 | NEEDS_REVIEW | 2642 | 29 | có | `02-A1-BEGINNER/grammar/A1-G019-future-will.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G020 | NEEDS_REVIEW | 2828 | 29 | có | `02-A1-BEGINNER/grammar/A1-G020-be-going-to.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G021 | NEEDS_REVIEW | 2676 | 29 | có | `02-A1-BEGINNER/grammar/A1-G021-basic-conjunctions.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| A1-G022 | NEEDS_REVIEW | 2615 | 29 | có | `02-A1-BEGINNER/grammar/A1-G022-comparatives.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
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
| B1-G001 | NEEDS_REVIEW | 3237 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G001-present-perfect-continuous.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G002 | NEEDS_REVIEW | 3005 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G002-past-perfect.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G003 | NEEDS_REVIEW | 2536 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G003-past-perfect-continuous.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G004 | NEEDS_REVIEW | 2658 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G004-narrative-tenses.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G005 | NEEDS_REVIEW | 2378 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G005-future-continuous.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G006 | NEEDS_REVIEW | 2364 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G006-future-perfect.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G007 | NEEDS_REVIEW | 2840 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G007-second-conditional.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G008 | NEEDS_REVIEW | 2802 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G008-third-conditional.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G009 | NEEDS_REVIEW | 2458 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G009-wish-if-only.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G010 | NEEDS_REVIEW | 2751 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G010-reported-statements.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G011 | NEEDS_REVIEW | 2500 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G011-reported-questions-commands.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G012 | NEEDS_REVIEW | 2507 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G012-passive-all-tenses.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G013 | NEEDS_REVIEW | 2825 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G013-defining-non-defining-relatives.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G014 | NEEDS_REVIEW | 2500 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G014-modals-deduction-present.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G015 | NEEDS_REVIEW | 2589 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G015-modal-perfects.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G016 | NEEDS_REVIEW | 2694 | 30 | có | `04-B1-INTERMEDIATE/grammar/B1-G016-gerund-vs-infinitive.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G017 | NEEDS_REVIEW | 2441 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G017-causative-have-get.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G018 | NEEDS_REVIEW | 2873 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G019 | NEEDS_REVIEW | 2733 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G019-complex-sentences.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G020 | NEEDS_REVIEW | 2935 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G021 | NEEDS_REVIEW | 2785 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G021-verb-patterns.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G022 | NEEDS_REVIEW | 2708 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G022-comparison-structures.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G023 | NEEDS_REVIEW | 2898 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G023-adverbial-clauses.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G024 | NEEDS_REVIEW | 2531 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G024-so-such.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G025 | NEEDS_REVIEW | 2546 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G025-both-either-neither-each-every.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B1-G026 | NEEDS_REVIEW | 2878 | 29 | có | `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G001 | NEEDS_REVIEW | 2909 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G001-mixed-conditionals.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G002 | NEEDS_REVIEW | 2684 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G002-advanced-conditionals.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G003 | NEEDS_REVIEW | 2649 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G003-unless-provided-in-case.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G004 | NEEDS_REVIEW | 2660 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G005 | NEEDS_REVIEW | 2743 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G006 | NEEDS_REVIEW | 2720 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G006-advanced-reported-speech.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G007 | NEEDS_REVIEW | 2930 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G007-relative-clause-reduction.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G008 | NEEDS_REVIEW | 2568 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G008-participle-clauses.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G009 | NEEDS_REVIEW | 2920 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G009-inversion.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G010 | NEEDS_REVIEW | 2800 | 29 | có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G010-cleft-sentences-emphasis.md` — Có nội dung; chỉ kiểm tra cấu trúc, chưa đọc đối chiếu học thuật toàn bài trong lượt này. |
| B2-G011 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G011-advanced-modals.md` — Chưa có file bài học. |
| B2-G012 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G012-future-perfect-continuous.md` — Chưa có file bài học. |
| B2-G013 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G013-perfect-infinitives-gerunds.md` — Chưa có file bài học. |
| B2-G014 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G014-advanced-gerund-infinitive.md` — Chưa có file bài học. |
| B2-G015 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G015-subjunctive.md` — Chưa có file bài học. |
| B2-G016 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G016-unreal-past-would-rather.md` — Chưa có file bài học. |
| B2-G017 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G017-advanced-linking-devices.md` — Chưa có file bài học. |
| B2-G018 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G018-contrast-concession.md` — Chưa có file bài học. |
| B2-G019 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G019-purpose-result-reason.md` — Chưa có file bài học. |
| B2-G020 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G020-complex-noun-phrases.md` — Chưa có file bài học. |
| B2-G021 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G021-nominalisation.md` — Chưa có file bài học. |
| B2-G022 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G022-subject-verb-agreement.md` — Chưa có file bài học. |
| B2-G023 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G023-ellipsis-substitution.md` — Chưa có file bài học. |
| B2-G024 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G024-parallel-structures.md` — Chưa có file bài học. |
| B2-G025 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G025-hedging-academic-language.md` — Chưa có file bài học. |
| B2-G026 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G026-collocations.md` — Chưa có file bài học. |
| B2-G027 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G027-discourse-markers.md` — Chưa có file bài học. |
| B2-G028 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G028-formal-informal.md` — Chưa có file bài học. |
| B2-G029 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G029-sentence-transformation.md` — Chưa có file bài học. |
| B2-G030 | NOT_STARTED | 0 | 0 | chưa có | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G030-argumentation.md` — Chưa có file bài học. |

## Vấn đề cấu trúc và nội dung cần xử lý

- Không thấy lỗi nhãn/cặp file/H1/code fence/phần A–N trong phạm vi kiểm tra.
- A0-G003 và A1-G023 đã hoàn thiện các điểm cần sửa; xem quyết định và phạm vi trong Review Log.
- Các bài cũ còn nhiều cột đáp án hoặc phân tích ngắn; chưa thể chứng nhận toàn A0/A1.
- Thứ tự tiên quyết tương lai còn cần điều chỉnh: B2-G005 cần B2-G013 nhưng ID đứng trước. Khi triển khai B2 phải học G013 trước G005; chưa viết nội dung B2 trong batch này.
- Các liên kết dưới đây vẫn hỏng vì nội dung chưa được triển khai. Không tạo placeholder để che lỗi; không xóa mục kế hoạch. Bộ kiểm tra toàn dự án vẫn trả mã lỗi cho đến khi sửa xong.

## Toàn bộ đích liên kết còn hỏng

| Đích cần triển khai/sửa | Các vị trí tham chiếu |
|---|---|
| `05-B2-UPPER-INTERMEDIATE/B2-SKILLS-PRACTICE.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:265 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/README.md` | `README.md:16 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:230 (missing file)`; `11-EXAMS-AND-ASSESSMENTS/B1-EXIT-TEST.md:187 (missing file)`; `04-B1-INTERMEDIATE/README.md:68 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G011-advanced-modals.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G010-cleft-sentences-emphasis.md:330 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:244 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G015-modal-perfects.md:183 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G012-future-perfect-continuous.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:245 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G006-future-perfect.md:290 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G013-perfect-infinitives-gerunds.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G006-advanced-reported-speech.md:149 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md:113 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md:320 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md:30 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md:33 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:246 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G014-advanced-gerund-infinitive.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:247 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G021-verb-patterns.md:318 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G016-gerund-vs-infinitive.md:315 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G015-subjunctive.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:248 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G016-unreal-past-would-rather.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:249 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G009-wish-if-only.md:299 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G017-advanced-linking-devices.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:250 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md:316 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G018-contrast-concession.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:251 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G019-purpose-result-reason.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:252 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G023-adverbial-clauses.md:314 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G020-complex-noun-phrases.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G007-relative-clause-reduction.md:326 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G008-participle-clauses.md:302 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:253 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G005-nouns-verbs-adjectives-adverbs.md:118 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G021-nominalisation.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:254 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G022-subject-verb-agreement.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:255 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G025-both-either-neither-each-every.md:313 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G023-ellipsis-substitution.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:256 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G024-parallel-structures.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:257 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G025-hedging-academic-language.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md:79 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G005-passive-reporting.md:312 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:258 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md:331 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G026-collocations.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:259 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G027-discourse-markers.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:260 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G028-formal-informal.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:261 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G029-sentence-transformation.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G009-inversion.md:323 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:262 (missing file)` |
| `05-B2-UPPER-INTERMEDIATE/grammar/B2-G030-argumentation.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:263 (missing file)` |
| `06-GRAMMAR-REFERENCE/ALL-CONDITIONALS.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G002-advanced-conditionals.md:314 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G001-mixed-conditionals.md:315 (missing file)`; `05-B2-UPPER-INTERMEDIATE/grammar/B2-G003-unless-provided-in-case.md:308 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G008-third-conditional.md:305 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G009-wish-if-only.md:294 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G007-second-conditional.md:314 (missing file)` |
| `06-GRAMMAR-REFERENCE/ALL-TENSES-COMPARISON.md` | `03-A2-ELEMENTARY/grammar/A2-G008-present-continuous-future.md:315 (missing file)`; `03-A2-ELEMENTARY/grammar/A2-G003-present-perfect-form.md:369 (missing file)`; `03-A2-ELEMENTARY/grammar/A2-G001-past-continuous.md:317 (missing file)`; `03-A2-ELEMENTARY/grammar/A2-G007-present-perfect-vs-past-simple.md:319 (missing file)`; `02-A1-BEGINNER/grammar/A1-G005-present-simple-vs-continuous.md:296 (missing file)`; `02-A1-BEGINNER/grammar/A1-G001-present-simple-affirmative.md:375 (missing file)`; `02-A1-BEGINNER/grammar/A1-G004-present-continuous.md:341 (missing file)`; `02-A1-BEGINNER/grammar/A1-G016-past-simple-be.md:323 (missing file)`; `02-A1-BEGINNER/grammar/A1-G020-be-going-to.md:314 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G005-future-continuous.md:296 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G001-present-perfect-continuous.md:357 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G006-future-perfect.md:285 (missing file)` |
| `06-GRAMMAR-REFERENCE/ARTICLES-GUIDE.md` | `01-A0-FOUNDATION/grammar/A0-G012-articles-basic.md:331 (missing file)` |
| `06-GRAMMAR-REFERENCE/GRAMMAR-CHEAT-SHEET.md` | `03-A2-ELEMENTARY/grammar/A2-G003-present-perfect-form.md:162 (missing file)`; `03-A2-ELEMENTARY/grammar/A2-G003-present-perfect-form.md:369 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G016-sentence-types.md:359 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G009-verb-to-be.md:392 (missing file)`; `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md:144 (missing file)`; `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md:362 (missing file)` |
| `06-GRAMMAR-REFERENCE/MODAL-VERBS-COMPARISON.md` | `03-A2-ELEMENTARY/grammar/A2-G009-might-may-possibility.md:313 (missing file)`; `02-A1-BEGINNER/grammar/A1-G019-future-will.md:328 (missing file)`; `02-A1-BEGINNER/grammar/A1-G012-can-cant.md:335 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G014-modals-deduction-present.md:293 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G015-modal-perfects.md:316 (missing file)` |
| `06-GRAMMAR-REFERENCE/PASSIVE-VOICE-GUIDE.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G004-advanced-passive.md:316 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G012-passive-all-tenses.md:308 (missing file)` |
| `06-GRAMMAR-REFERENCE/PREPOSITIONS-GUIDE.md` | `02-A1-BEGINNER/grammar/A1-G009-prepositions-of-place.md:327 (missing file)`; `02-A1-BEGINNER/grammar/A1-G010-prepositions-of-time.md:347 (missing file)` |
| `06-GRAMMAR-REFERENCE/README.md` | `README.md:17 (missing file)`; `00-GETTING-STARTED/README.md:34 (missing file)` |
| `06-GRAMMAR-REFERENCE/SENTENCE-PATTERNS.md` | `01-A0-FOUNDATION/grammar/A0-G007-subject-verb-object.md:325 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G008-sentence-patterns.md:338 (missing file)` |
| `07-VOCABULARY/README.md` | `README.md:18 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:274 (missing file)`; `00-GETTING-STARTED/README.md:35 (missing file)`; `00-GETTING-STARTED/ROADMAP.md:30 (missing file)`; `00-GETTING-STARTED/HOW-TO-LEARN.md:100 (missing file)` |
| `07-VOCABULARY/VOC-01-daily-life.md` | `00-GETTING-STARTED/ROADMAP.md:111 (missing file)`; `01-A0-FOUNDATION/README.md:56 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G019-likes-and-hobbies.md:341 (missing file)`; `02-A1-BEGINNER/README.md:59 (missing file)`; `02-A1-BEGINNER/grammar/A1-G001-present-simple-affirmative.md:376 (missing file)` |
| `07-VOCABULARY/VOC-02-family-relationships.md` | `00-GETTING-STARTED/ROADMAP.md:112 (missing file)`; `01-A0-FOUNDATION/README.md:57 (missing file)`; `02-A1-BEGINNER/README.md:60 (missing file)`; `02-A1-BEGINNER/grammar/A1-G006-possessives.md:322 (missing file)` |
| `07-VOCABULARY/VOC-05-travel-transportation.md` | `02-A1-BEGINNER/README.md:62 (missing file)`; `02-A1-BEGINNER/grammar/A1-G009-prepositions-of-place.md:328 (missing file)` |
| `07-VOCABULARY/VOC-06-food-health.md` | `01-A0-FOUNDATION/README.md:58 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G014-countable-uncountable.md:336 (missing file)`; `02-A1-BEGINNER/README.md:61 (missing file)` |
| `07-VOCABULARY/VOC-07-shopping-money.md` | `02-A1-BEGINNER/README.md:61 (missing file)`; `02-A1-BEGINNER/grammar/A1-G015-much-many-a-lot-of.md:309 (missing file)` |
| `07-VOCABULARY/VOC-16-common-phrasal-verbs.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:176 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md:237 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md:345 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G020-phrasal-verbs.md:350 (missing file)` |
| `07-VOCABULARY/VOC-17-common-collocations.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:300 (missing file)`; `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:176 (missing file)` |
| `07-VOCABULARY/VOC-18-word-families.md` | `01-A0-FOUNDATION/grammar/A0-G004-parts-of-speech.md:347 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G005-nouns-verbs-adjectives-adverbs.md:357 (missing file)` |
| `07-VOCABULARY/VOC-19-commonly-confused-words.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:176 (missing file)` |
| `08-PRONUNCIATION/PRON-01-ipa-reference.md` | `00-GETTING-STARTED/ROADMAP.md:110 (missing file)`; `01-A0-FOUNDATION/README.md:55 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G001-alphabet.md:389 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G003-english-sounds-ipa.md:351 (missing file)` |
| `08-PRONUNCIATION/PRON-02-vowels-consonants.md` | `01-A0-FOUNDATION/README.md:55 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G002-phonics-basics.md:393 (missing file)`; `02-A1-BEGINNER/README.md:59 (missing file)`; `02-A1-BEGINNER/README.md:62 (missing file)`; `02-A1-BEGINNER/grammar/A1-G017-past-simple-affirmative.md:363 (missing file)` |
| `08-PRONUNCIATION/PRON-03-minimal-pairs.md` | `01-A0-FOUNDATION/README.md:56 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G011-this-that-these-those.md:327 (missing file)`; `02-A1-BEGINNER/README.md:60 (missing file)` |
| `08-PRONUNCIATION/PRON-04-word-stress.md` | `01-A0-FOUNDATION/README.md:58 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G018-numbers-dates-time-age.md:427 (missing file)`; `02-A1-BEGINNER/README.md:63 (missing file)` |
| `08-PRONUNCIATION/PRON-05-sentence-stress.md` | `01-A0-FOUNDATION/grammar/A0-G004-parts-of-speech.md:111 (missing file)` |
| `08-PRONUNCIATION/PRON-08-weak-forms.md` | `02-A1-BEGINNER/README.md:61 (missing file)`; `02-A1-BEGINNER/grammar/A1-G012-can-cant.md:336 (missing file)` |
| `08-PRONUNCIATION/PRON-10-shadowing-practice.md` | `00-GETTING-STARTED/ROADMAP.md:182 (missing file)`; `00-GETTING-STARTED/LEARNING-TECHNIQUES.md:100 (missing file)` |
| `08-PRONUNCIATION/PRON-11-vietnamese-learner-mistakes.md` | `01-A0-FOUNDATION/README.md:57 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G002-phonics-basics.md:263 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G013-singular-plural-nouns.md:345 (missing file)`; `01-A0-FOUNDATION/grammar/A0-G003-english-sounds-ipa.md:352 (missing file)`; `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A0-SKILLS-ANSWERS.md:98 (missing file)` |
| `08-PRONUNCIATION/README.md` | `README.md:19 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:275 (missing file)`; `00-GETTING-STARTED/README.md:36 (missing file)`; `00-GETTING-STARTED/ROADMAP.md:31 (missing file)` |
| `09-FOUR-SKILLS/Listening/L01-basic-listening.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:16 (missing file)` |
| `09-FOUR-SKILLS/Listening/L02-listening-for-keywords.md` | `12-ANSWERS-AND-EXPLANATIONS/SKILLS/A1-SKILLS-ANSWERS.md:29 (missing file)` |
| `09-FOUR-SKILLS/Listening/L03-listening-for-main-ideas.md` | `04-B1-INTERMEDIATE/README.md:59 (missing file)` |
| `09-FOUR-SKILLS/Listening/L04-listening-for-details.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:177 (missing file)`; `04-B1-INTERMEDIATE/README.md:59 (missing file)` |
| `09-FOUR-SKILLS/Listening/L05-understanding-paraphrases.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:177 (missing file)`; `04-B1-INTERMEDIATE/README.md:59 (missing file)` |
| `09-FOUR-SKILLS/README.md` | `README.md:20 (missing file)`; `00-GETTING-STARTED/README.md:37 (missing file)`; `00-GETTING-STARTED/ROADMAP.md:32 (missing file)`; `12-ANSWERS-AND-EXPLANATIONS/SKILLS/B1-SKILLS-ANSWERS.md:161 (missing file)` |
| `09-FOUR-SKILLS/Reading/R01-reading-fundamentals.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:56 (missing file)` |
| `09-FOUR-SKILLS/Reading/R04-finding-main-ideas.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:177 (missing file)`; `04-B1-INTERMEDIATE/README.md:61 (missing file)` |
| `09-FOUR-SKILLS/Reading/R05-inference.md` | `04-B1-INTERMEDIATE/README.md:61 (missing file)` |
| `09-FOUR-SKILLS/Reading/R06-paraphrase-recognition.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:177 (missing file)` |
| `09-FOUR-SKILLS/Reading/README.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:278 (missing file)` |
| `09-FOUR-SKILLS/Speaking/README.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:277 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S01-basic-sentence-building.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:111 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S02-everyday-conversations.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:111 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S04-expressing-opinions.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:178 (missing file)`; `04-B1-INTERMEDIATE/README.md:60 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md:326 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S05-storytelling.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:178 (missing file)`; `04-B1-INTERMEDIATE/README.md:60 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G004-narrative-tenses.md:290 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S07-vstep-speaking.md` | `05-B2-UPPER-INTERMEDIATE/grammar/B2-G010-cleft-sentences-emphasis.md:326 (missing file)` |
| `09-FOUR-SKILLS/Speaking/S08-speaking-evaluation-rubrics.md` | `02-A1-BEGINNER/A1-COMMUNICATION.md:291 (missing file)` |
| `09-FOUR-SKILLS/Writing/README.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:279 (missing file)` |
| `09-FOUR-SKILLS/Writing/W01-sentence-construction.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:148 (missing file)`; `02-A1-BEGINNER/grammar/A1-G021-basic-conjunctions.md:310 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G019-complex-sentences.md:323 (missing file)` |
| `09-FOUR-SKILLS/Writing/W02-paragraph-writing.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:148 (missing file)`; `04-B1-INTERMEDIATE/README.md:62 (missing file)` |
| `09-FOUR-SKILLS/Writing/W05-cohesion-coherence.md` | `04-B1-INTERMEDIATE/README.md:62 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md:223 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G018-linking-words.md:317 (missing file)` |
| `09-FOUR-SKILLS/Writing/W06-email-writing.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:178 (missing file)`; `04-B1-INTERMEDIATE/README.md:62 (missing file)` |
| `09-FOUR-SKILLS/Writing/W08-opinion-essays.md` | `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md:178 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G026-expressing-opinions.md:326 (missing file)` |
| `09-FOUR-SKILLS/Writing/W09-discussion-essays.md` | `04-B1-INTERMEDIATE/B1-SKILLS-PRACTICE.md:230 (missing file)` |
| `09-FOUR-SKILLS/Writing/W10-advantages-disadvantages.md` | `04-B1-INTERMEDIATE/grammar/B1-G022-comparison-structures.md:320 (missing file)` |
| `09-FOUR-SKILLS/Writing/W13-writing-evaluation-rubrics.md` | `02-A1-BEGINNER/A1-SKILLS-PRACTICE.md:173 (missing file)` |
| `10-PRACTICE-LAB/LAB-01-daily-grammar-drills.md` | `02-A1-BEGINNER/grammar/A1-G002-present-simple-negatives-questions.md:353 (missing file)` |
| `10-PRACTICE-LAB/LAB-02-mixed-grammar-exercises.md` | `00-GETTING-STARTED/LEARNING-TECHNIQUES.md:65 (missing file)`; `03-A2-ELEMENTARY/grammar/A2-G007-present-perfect-vs-past-simple.md:314 (missing file)`; `02-A1-BEGINNER/grammar/A1-G005-present-simple-vs-continuous.md:291 (missing file)`; `02-A1-BEGINNER/grammar/A1-G020-be-going-to.md:308 (missing file)` |
| `10-PRACTICE-LAB/LAB-04-sentence-transformation.md` | `04-B1-INTERMEDIATE/grammar/B1-G011-reported-questions-commands.md:300 (missing file)`; `04-B1-INTERMEDIATE/grammar/B1-G024-so-such.md:301 (missing file)` |
| `10-PRACTICE-LAB/LAB-09-weekly-review.md` | `00-GETTING-STARTED/LEARNING-TECHNIQUES.md:149 (missing file)`; `11-EXAMS-AND-ASSESSMENTS/A0-EXIT-TEST.md:188 (missing file)` |
| `10-PRACTICE-LAB/LAB-10-monthly-review.md` | `00-GETTING-STARTED/LEARNING-TECHNIQUES.md:66 (missing file)` |
| `10-PRACTICE-LAB/README.md` | `README.md:21 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:280 (missing file)`; `00-GETTING-STARTED/README.md:38 (missing file)`; `00-GETTING-STARTED/ROADMAP.md:33 (missing file)`; `00-GETTING-STARTED/LEARNING-TECHNIQUES.md:121 (missing file)` |
| `11-EXAMS-AND-ASSESSMENTS/B2-MOCK-TEST-1.md` | `00-GETTING-STARTED/CURRICULUM-MAP.md:230 (missing file)` |
| `11-EXAMS-AND-ASSESSMENTS/README.md` | `README.md:22 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:50 (missing file)`; `00-GETTING-STARTED/README.md:39 (missing file)`; `00-GETTING-STARTED/ROADMAP.md:97 (missing file)` |
| `11-EXAMS-AND-ASSESSMENTS/SKILL-EVALUATION-RUBRICS.md` | `00-GETTING-STARTED/ROADMAP.md:172 (missing file)` |
| `12-ANSWERS-AND-EXPLANATIONS/README.md` | `README.md:23 (missing file)`; `00-GETTING-STARTED/CURRICULUM-MAP.md:27 (missing file)` |
| `13-LEARNING-TRACKER/B2-READINESS-CHECKLIST.md` | `00-GETTING-STARTED/ROADMAP.md:98 (missing file)` |
| `13-LEARNING-TRACKER/GRAMMAR-CHECKLIST.md` | `04-B1-INTERMEDIATE/README.md:66 (missing file)` |
| `13-LEARNING-TRACKER/VOCABULARY-TRACKER.md` | `00-GETTING-STARTED/HOW-TO-LEARN.md:100 (missing file)` |

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
- `09-FOUR-SKILLS/Listening/README.md`
- `11-EXAMS-AND-ASSESSMENTS/A0-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/A1-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/A2-EXIT-TEST.md`
- `11-EXAMS-AND-ASSESSMENTS/B1-EXIT-TEST.md`
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
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A0-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A1-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/A2-EXIT-TEST-ANSWERS.md`
- `12-ANSWERS-AND-EXPLANATIONS/EXAMS/B1-EXIT-TEST-ANSWERS.md`
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
- `13-LEARNING-TRACKER/ERROR-LOG.md`
- `13-LEARNING-TRACKER/PROGRESS.md`
- `13-LEARNING-TRACKER/README.md`
- `13-LEARNING-TRACKER/SPACED-REPETITION.md`
- `13-LEARNING-TRACKER/WEEKLY-REVIEW.md`
- `99-PROJECT/AUTHORING-STANDARDS.md`
- `99-PROJECT/REVIEW-LOG.md`
- `AI-TUTOR-INSTRUCTIONS.md`
- `CONTENT-AUDIT.md`
- `IMPLEMENTATION-STATUS.md`
- `README.md`

## Việc tiếp theo

1. Tiếp tục từ bài NOT_STARTED đầu tiên của cấp đang triển khai; không viết lại bài COMPLETED chỉ để đổi văn phong.
2. A2 đã đủ 30 bài và hỗ trợ; giữ thứ tự tiên quyết đã sửa và các biến thể đúng trong đáp án.
3. Rà soát các bài nền NEEDS_REVIEW và nội dung đánh giá cũ trước khi triển khai B1/B2.
4. Bổ sung các module chuyên biệt và sửa các đích liên kết còn thiếu; chạy kiểm tra toàn cục.
5. Rà soát học thuật toàn bộ và đánh giá bốn kỹ năng trước báo cáo cuối; không công bố dự án hoặc người học đạt B2 từ số bài ngữ pháp.
