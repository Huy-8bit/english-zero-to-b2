"""Curated reusable language for essays and speaking; scenario claims remain unmarked."""
import re

# Longer forms take precedence so nested fragments never split a useful sentence starter.
PHRASES = [
 ('I would like to talk about', 'Giới thiệu chủ đề + cụm danh từ'),
 ('In my opinion,', 'Nêu quan điểm cá nhân'), ('In my view,', 'Nêu quan điểm cá nhân'),
 ('I agree with this view', 'Nêu lập trường đồng ý'), ('I disagree with this view.', 'Nêu lập trường phản đối'),
 ('I agree with it to some extent,', 'Đồng ý một phần'), ('I consider this a mainly positive development', 'Đánh giá tích cực; chỉ dùng khi đúng lập trường'),
 ('I see the development as positive because', 'Đánh giá và đưa lý do; đổi positive nếu đánh giá tiêu cực'),
 ('I support the view that', 'Nêu điều mình ủng hộ + mệnh đề'),
 ('The proposal that', 'Giới thiệu đề xuất + mệnh đề'), ('The suggestion that', 'Giới thiệu ý kiến + mệnh đề'),
 ('It is sometimes suggested that', 'Dẫn một ý kiến + mệnh đề'),
 ('There are different views about', 'Giới thiệu vấn đề có hai quan điểm'),
 ('On the one hand,', 'Mở phía thứ nhất'), ('On the other hand,', 'Mở phía đối lập'),
 ('One important point in favour of the proposal is that', 'Lợi ích / lý do ủng hộ + mệnh đề'),
 ('A second reason for supporting this approach is that', 'Lý do ủng hộ tiếp theo + mệnh đề'),
 ('This is possible because', 'Giải thích cơ chế + mệnh đề'),
 ('A difficulty that should not be ignored is that', 'Nêu một khó khăn + mệnh đề'),
 ('This matters because', 'Giải thích vì sao điều đó quan trọng'),
 ('For example,', 'Đưa ví dụ + mệnh đề'), ('For instance,', 'Đưa ví dụ + mệnh đề'),
 ('Consider the following situation:', 'Dẫn một tình huống minh họa'),
 ('One reason for the difficulty is that', 'Nêu nguyên nhân + mệnh đề'),
 ('This can help explain why', 'Nối nguyên nhân với hiện tượng'),
 ('A practical response would be to', 'Đưa giải pháp + động từ nguyên mẫu'),
 ('A useful step would be to', 'Đề xuất một bước + động từ nguyên mẫu'),
 ('To be more specific,', 'Giải thích cụ thể hơn'),
 ('My own view is that', 'Nêu ý kiến riêng + mệnh đề'),
 ('In particular,', 'Làm rõ một điểm cụ thể'), ('it would be sensible to', 'Đề xuất hợp lý + động từ nguyên mẫu'),
 ('It is true that', 'Thừa nhận một ý đối lập + mệnh đề'),
 ('In conclusion,', 'Mở kết luận'), ('To sum up,', 'Tóm tắt bài nói'),
 ('an important advantage is that', 'Tóm tắt lợi ích + mệnh đề'),
 ('a notable disadvantage is that', 'Tóm tắt bất lợi + mệnh đề'),
 ('I give greater weight to the benefit because', 'So sánh sức nặng của lợi ích; cần lý do thực sự'),
 ('A way to reduce this difficulty would be to', 'Giải pháp giảm khó khăn + động từ nguyên mẫu'),
 ('Another concern is that', 'Thêm một mối lo + mệnh đề'), ('A further effect is that', 'Thêm một hệ quả + mệnh đề'),
 ('One important example is', 'Giới thiệu ví dụ quan trọng'), ('A concrete example is that', 'Ví dụ cụ thể + mệnh đề'),
 ('One concern is that', 'Nêu mối lo + mệnh đề'), ('This is connected with the fact that', 'Nối với nguyên nhân / thực tế'),
 ('First,', 'Mở ý thứ nhất'), ('However,', 'Nêu ý đối lập hoặc giới hạn'),
 ('Yes, I am, mainly because', 'Trả lời trực tiếp và giải thích'),
 ('I could join', 'Nêu hoạt động có thể tham gia'), ('I would like to', 'Nêu mong muốn + động từ nguyên mẫu'),
 ('One possible difficulty is that', 'Nêu khó khăn + mệnh đề'),
 ('For a new topic, I prefer', 'Nêu cách học ưa thích + danh từ / V-ing'),
 ('In this situation, I would choose to', 'Chọn phương án + động từ nguyên mẫu'),
 ('I think this option fits my needs best.', 'Chốt lựa chọn phù hợp nhất với điều kiện đề'),
 ('The main reason is that', 'Nêu lý do chính + mệnh đề'),
 ('I would not choose', 'Nêu phương án không chọn + cụm danh từ'),
 ('For these reasons,', 'Kết luận từ các lý do đã nêu'),
 ('No, I do not think so.', 'Trả lời câu hỏi Yes/No rồi giải thích'),
 ('A flexible approach would', 'Đề xuất cách linh hoạt + động từ nguyên mẫu'),
 ('They could', 'Nêu hành động của đối tượng vừa nhắc'), ('We could ask whether', 'Đưa cách kiểm tra / đánh giá'),
 ('I would compare', 'Đề xuất so sánh + cụm danh từ'),
]
PATTERN = re.compile(r'(?<!\w)(?:'+'|'.join(re.escape(en) for en,_ in sorted(PHRASES,key=lambda p:-len(p[0])))+r')(?!\w)',re.I)
MEANINGS={en.lower():vi for en,vi in PHRASES}


def annotate(text, scenario):
    # A phrase inside a supplied claim/example is topic content, even if its words look like a frame.
    protected=[]
    for key in ('focus','view','benefit','mechanism','example','risk','risk_why','risk_example','cause','action','implementation','event','activity','item'):
        protected.extend((m.start(),m.end()) for m in re.finditer(re.escape(scenario[key]),text,re.I))
    parts=[]
    last=0
    for m in PATTERN.finditer(text):
        if any(m.start()<end and m.end()>start for start,end in protected): continue
        if m.start()>last: parts.append({'text':text[last:m.start()], 'kind':'detail'})
        parts.append({'text':m[0], 'kind':'frame', 'labelVi':MEANINGS[m[0].lower()]})
        last=m.end()
    if last<len(text): parts.append({'text':text[last:], 'kind':'detail'})
    return parts


def add_annotations(sample,scenario):
    for p in sample['paragraphs']:
        if 'parts' not in p: p['parts']=annotate(p['text'],scenario)
    for section in sample['sections']:
        for q in section['questions']: q['parts']=annotate(q['answer'],scenario)
