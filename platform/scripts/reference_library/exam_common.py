"""Schema helpers for individually authored VSTEP practice. No answer templates."""
import re
from frame_annotations import PHRASES

SOURCES = {
    'dthu': {'kind': 'published-sample', 'label': 'Đề minh họa · Đại học Đồng Tháp', 'url': 'https://vstep.dthu.edu.vn/mainpage/page/27.pdf', 'checkedOn': '2026-11-05'},
    'ufls': {'kind': 'published-sample', 'label': 'Đề minh họa · Đại học Ngoại ngữ, Đại học Đà Nẵng', 'url': 'https://vstep.ufl.udn.vn/files/2025/2025_9_3_41_23_569_de_thi_mau_vstep_3.5.pdf', 'checkedOn': '2026-11-05'},
    'practice': {'kind': 'original-practice', 'label': 'Đề luyện tự biên soạn theo định dạng VSTEP', 'url': 'https://vstep.vnu.edu.vn/test-format/', 'checkedOn': '2026-11-05'},
}
EXTRA_FRAMES = [
    ('Thank you for your email.', 'Cảm ơn thư đã nhận; chỉ dùng khi đang trả lời thư'),
    ('Thanks for your message.', 'Cảm ơn tin nhắn của người quen'),
    ('I am writing to', 'Nêu mục đích + động từ nguyên mẫu'),
    ('I would recommend', 'Đưa đề xuất + danh từ / V-ing'),
    ('Could you please', 'Nhờ hoặc hỏi lịch sự + động từ nguyên mẫu'),
    ('Please let me know', 'Nhờ người nhận phản hồi'),
    ('I look forward to hearing from you.', 'Mong nhận được hồi âm'),
    ('I am sorry that', 'Xin lỗi + mệnh đề về việc đã xảy ra'),
    ('As for', 'Chuyển sang nội dung được hỏi + danh từ'),
    ('In addition,', 'Bổ sung một ý'), ('Finally,', 'Chuyển sang ý cuối'),
    ('For this situation, I would choose', 'Chọn một phương án + cụm danh từ'),
    ('To begin with,', 'Mở lý do thứ nhất'), ('Another reason is that', 'Thêm lý do + mệnh đề'),
    ('Compared with', 'So sánh với + danh từ'),
    ('Personally,', 'Nêu sở thích hoặc ý kiến cá nhân'),
    ('For me,', 'Nêu trải nghiệm hoặc lựa chọn cá nhân'),
]
FRAME_MAP = dict(PHRASES + EXTRA_FRAMES)
PATTERN = re.compile(r'(?<!\w)(?:' + '|'.join(re.escape(p) for p in sorted(FRAME_MAP, key=len, reverse=True)) + r')(?!\w)', re.I)
MEANINGS = {k.lower():v for k,v in FRAME_MAP.items()}

def parts(text):
    result, end = [], 0
    for match in PATTERN.finditer(text):
        if match.start() > end: result.append({'kind':'detail', 'text':text[end:match.start()]})
        result.append({'kind':'frame', 'text':match[0], 'labelVi':MEANINGS[match[0].lower()]})
        end = match.end()
    if end < len(text): result.append({'kind':'detail', 'text':text[end:]})
    return result

def p(label, text, note):
    return {'label':label, 'text':text, 'noteVi':note, 'parts':parts(text)}

def q(question, answer, note='Trả lời trực tiếp → lý do → một chi tiết cụ thể. Thay trải nghiệm cho đúng với bạn.'):
    return {'question':question, 'answer':answer, 'noteVi':note, 'parts':parts(answer)}

def section(label, questions): return {'label':label, 'questions':questions}
def coverage(requirement, evidence): return {'requirementVi':requirement, 'evidence':evidence}
def words(text): return len(re.findall(r"\b[\w]+(?:['’-][\w]+)*\b", text))

def case(group, slug, title, focus, kind, type_label, prompt, requirements, paragraphs, vocabulary, *, source='practice', page=None, register=None, sections=None, options=None, choice=None, ideas=None, checks=None):
    provenance = SOURCES[source] | {'page':page, 'noteVi': 'Đề được diễn đạt lại ngắn gọn từ đề minh họa công bố; mở PDF để xem nguyên bản. Bài trả lời do ứng dụng tự biên soạn, không phải đáp án của trường.' if source != 'practice' else 'Tình huống và bài trả lời do ứng dụng tự biên soạn; liên kết dẫn tới thể thức thi, không phải nguồn của đề này.'}
    sections = sections or []
    answer = '\n\n'.join([x['text'] for x in paragraphs] + [x['answer'] for s in sections for x in s['questions']])
    found = {part['text']:part['labelVi'] for unit in paragraphs + [x for s in sections for x in s['questions']] for part in unit['parts'] if part['kind']=='frame'}
    return dict(id=f'exam-{group}-{slug}', group=group, type=kind, typeLabel=type_label, topic='situations', number=0, title=title, focus=focus, register=register, prompt=prompt, requirementsVi=requirements, summaryVi=' → '.join(requirements), paragraphs=paragraphs, sections=sections, options=options or [], selectedOption=choice, suggestedIdeas=ideas or [], coverage=checks or [], provenance=provenance, wordCount=words(answer), mainWordCount=words(' '.join(x['text'] for x in paragraphs)), phrases=[{'en':en,'vi':vi,'inAnswer':en.lower() in answer.lower()} for en,vi in vocabulary], framePhrases=[{'en':en,'vi':vi} for en,vi in found.items()])
