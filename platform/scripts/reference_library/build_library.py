#!/usr/bin/env python3
"""Build the static model-answer library from authored scenarios and task-specific scaffolds.
No API, learner database, or runtime generation is involved. Run --check in CI/tests.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from scenarios import TOPICS, scenarios

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "model-library-data"
VERSION = "2026-11-05-v1"
GROUPS = [
    {"id": "writing-task1", "skill": "writing", "label": "Writing Task 1 · Thư / email", "description": "10 mục đích thư thường gặp để tự luyện; đây không phải danh mục dạng đề chính thức.", "minimum": 120},
    {"id": "writing-task2", "skill": "writing", "label": "Writing Task 2 · Bài luận", "description": "10 dạng và biến thể: quan điểm, hai phía, lợi–hại, nguyên nhân, giải pháp và câu hỏi kết hợp.", "minimum": 250},
    {"id": "speaking-part1", "skill": "speaking", "label": "Speaking Part 1 · Giao tiếp xã hội", "description": "Mỗi bài gồm 6 câu hỏi và câu trả lời mẫu, chia thành hai chủ đề nhỏ."},
    {"id": "speaking-part2", "skill": "speaking", "label": "Speaking Part 2 · Thảo luận giải pháp", "description": "Một tình huống, ba lựa chọn; chọn một và giải thích vì sao không chọn hai phương án còn lại."},
    {"id": "speaking-part3", "skill": "speaking", "label": "Speaking Part 3 · Phát triển chủ đề", "description": "Bài nói có ba ý gợi dẫn, ví dụ và ba câu hỏi mở rộng kèm trả lời."},
]
LETTER_TYPES = [
    ("reply", "Trả lời / cung cấp thông tin"), ("advice", "Đưa lời khuyên"),
    ("invitation", "Mời tham gia"), ("accept", "Nhận lời mời"), ("decline", "Từ chối lời mời"),
    ("thanks", "Cảm ơn"), ("apology", "Xin lỗi và khắc phục"),
    ("request", "Hỏi thông tin / yêu cầu"), ("complaint", "Phàn nàn"), ("application", "Ứng tuyển / đăng ký"),
]
ESSAY_TYPES = [
    ("opinion-agree", "Quan điểm — đồng ý"), ("opinion-disagree", "Quan điểm — phản đối"),
    ("opinion-partial", "Quan điểm — đồng ý một phần"), ("discussion", "Bàn hai quan điểm"),
    ("advantages", "Lợi ích và bất lợi"), ("outweigh", "So sánh lợi ích với bất lợi"),
    ("cause-solution", "Nguyên nhân và giải pháp"), ("problem-solution", "Vấn đề và giải pháp"),
    ("cause-effect", "Nguyên nhân và hệ quả"), ("two-questions", "Hai câu hỏi kết hợp"),
]
TIMES = ["Saturday at nine in the morning", "Sunday at two in the afternoon", "Friday at six in the evening", "Saturday at ten in the morning", "Sunday at three in the afternoon", "Wednesday at six in the evening", "Saturday at two in the afternoon", "Sunday at ten in the morning", "Thursday at six in the evening", "Saturday at three in the afternoon"]
PLACES = ["the community centre", "the local library meeting room", "the school activity room", "the neighbourhood hall", "the college workshop room", "the community centre", "the local library", "the school meeting room", "the neighbourhood hall", "the college activity room"]
EXCUSES = ["attend a family appointment that was arranged earlier", "cover an extra shift at work", "help my parents move some furniture", "take my younger brother to an important school event", "finish a group project with a deadline that evening", "attend a training session required by my employer", "collect a relative arriving from another town", "take an exam that cannot be moved", "help my family prepare for a gathering", "travel to my hometown for a family commitment"]
MISTAKES = ["missing our planning meeting", "replying to your message so late", "forgetting to bring the materials I promised", "arriving late and keeping you waiting", "sending you the wrong meeting time", "not returning your notes when I said I would", "forgetting to confirm my attendance", "changing my plans at the last minute", "missing your call about the arrangements", "not completing my part of the preparation on time"]
REASONS = ["my train was cancelled", "I had saved your message in the wrong folder", "I left the bag at home while rushing to catch a bus", "the bus broke down on the way", "I copied the time from an earlier version of the plan", "I left the notes at my parents' house", "I mistakenly thought my reply had been sent", "my work schedule changed unexpectedly", "my phone battery ran out", "I underestimated how long another task would take"]

def cap(s): return s[0].upper() + s[1:]
def words(s): return len(re.findall(r"\b[\w]+(?:['’-][\w]+)*\b", s))
def para(label, text, note): return {"label": label, "text": text, "noteVi": note}
def qa(q, a, note): return {"question": q, "answer": a, "noteVi": note}

def letter(s, kind):
    f, activity, event = s["focus"], s["activity"], s["event"]
    i = s["number"] - 1
    when, place, excuse = TIMES[i], PLACES[i], EXCUSES[i]
    if 'morning' in event: when = 'Saturday at nine in the morning'
    if 'evening' in event: when = 'Friday at six in the evening'
    place = {
        'environment-03': 'the community garden', 'environment-04': 'the park entrance',
        'environment-05': 'the community centre courtyard', 'environment-09': 'the beach entrance',
        'daily-life-01': 'the park entrance', 'daily-life-02': 'the community centre kitchen',
        'daily-life-03': 'the local sports centre', 'education-02': 'the school library',
        'education-08': 'the school hall'
    }.get(s['id'], place)
    detail = f"We will {activity}. The aim is to connect the topic with everyday life rather than only listen to a long talk."
    value = f"One useful point is that {s['benefit']}. For example, {s['example']}."
    closing = "Please let me know what you think when you have a moment. I would be happy to answer any other questions.\n\nBest wishes,\nMinh"
    request_close = "Thank you for taking the time to read my letter. Please let me know if you need any further information. I look forward to your reply.\n\nYours sincerely,\nMinh Nguyen"
    content = {
      "reply": (
        f"Your friend Alex wants to know about {event}. Write an email describing the activity, explaining the arrangements, and offering practical advice.",
        ["Giới thiệu hoạt động và lợi ích.", "Nêu giờ, nơi và thứ cần mang.", "Cho lời khuyên cụ thể và đề nghị hỗ trợ."],
        [para("Mở thư", f"Hi Alex,\n\nThanks for your email. You asked about {event}, so I am happy to share the details. I thought of you when I saw the programme because you enjoy learning useful things with other people.", "Cảm ơn, nhắc đúng câu hỏi của bạn."),
         para("Hoạt động", f"{detail} {value}", s["summary_vi"]),
         para("Sắp xếp và gợi ý", f"The session is at {place} on {when}. Please bring {s['item']} and arrive about ten minutes early. If you want to prepare, think of one question about {f}. We can compare our notes afterwards and decide which ideas would be useful in our own lives.", "Trả lời đủ thời gian, địa điểm, chuẩn bị."), para("Kết thư", closing, "Mời hỏi thêm và ký tên thân mật.")]),
      "advice": (
        f"Your friend is interested in {f} but does not know where to begin. Write an email giving practical advice, explaining a possible difficulty, and offering help.",
        ["Cho bước bắt đầu cụ thể.", "Giải thích một khó khăn và cách xử lý.", "Đề nghị hỗ trợ thực tế."],
        [para("Mở thư", f"Hi Alex,\n\nThanks for telling me about your interest in {f}. I understand why you are unsure where to start. You do not need a perfect plan immediately, but a few practical steps could make things easier.", "Đồng cảm, xác định mục đích khuyên."),
         para("Lời khuyên đầu", f"First, I suggest joining {event} at {place} on {when}. There, we can {activity}. {value}", "Gợi ý hoạt động có ngày, nơi và lý do."),
         para("Khó khăn và cách xử lý", f"One thing to remember is that {s['risk']}. This can happen because {s['cause']}. A useful response would be to {s['action']}. For instance, {s['implementation']}. Try the idea on a small scale before deciding whether to continue.", "Nêu giới hạn để lời khuyên không tuyệt đối."),
         para("Đề nghị và kết", "If you like, I can come with you and help you write down the most useful points. Afterwards, we could make a simple plan together.\n\n" + closing, "Hỗ trợ cụ thể, không chỉ nói good luck.")]),
      "invitation": (
        f"Invite your friend to {event}. Explain what will happen, why your friend might enjoy it, and what they should prepare.",
        ["Mời rõ sự kiện.", "Nêu hoạt động, lý do, giờ và nơi.", "Dặn chuẩn bị và xin xác nhận."],
        [para("Lời mời", f"Hi Alex,\n\nI hope you are well. I am writing to invite you to {event} at {place} on {when}. It has been a while since we did something together, and I think this would be a useful and enjoyable way to meet.", "Nêu lời mời cùng thông tin chính."),
         para("Lý do tham gia", f"{detail} {value} There will also be time to ask questions and exchange ideas with the other people taking part.", s["summary_vi"]),
         para("Chuẩn bị", f"Please bring {s['item']}. We could meet outside the entrance ten minutes before the session starts. You do not need to be an expert; the organiser has said that beginners are welcome. Please tell me at least two days before the session whether you can come so that I can reserve two places.", "Chuẩn bị, điểm hẹn và hạn phản hồi."),
         para("Kết thư", "I really hope you can join me. I am looking forward to hearing what you think.\n\nBest wishes,\nMinh", "Kết thân mật và mong gặp.")]),
      "accept": (
        f"Your friend has invited you to {event}. Accept the invitation, explain your travel plans, and ask about preparation while offering help.",
        ["Nhận lời rõ ràng.", "Nêu cách đến và giờ hẹn.", "Hỏi cần chuẩn bị gì, đề nghị giúp."],
        [para("Nhận lời", f"Hi Alex,\n\nThank you for inviting me to {event}. I would love to come. I have been interested in {f} for some time, so I am glad we will have a chance to explore it together.", "Cảm ơn và trả lời trực tiếp lời mời."),
         para("Đi lại", f"I can meet you at {place} on {when}. I am planning to take the bus and arrive ten minutes early. If the time or meeting point changes, please send me a message before I leave home.", "Lịch hẹn và phương án cập nhật."),
         para("Chuẩn bị và hỗ trợ", f"I understand that we will {activity}. I can bring {s['item']}, but could you let me know if anything else is needed? {value} I would also be happy to help arrange the seats or hand out materials before the session begins.", "Hỏi rõ chuẩn bị, nối với nội dung sự kiện."),
         para("Kết thư", "Thanks again for thinking of me. It will be lovely to spend time together and learn something practical. Let me know whether you would like me to arrive earlier to help.\n\nBest wishes,\nMinh", "Thể hiện thiện chí và chốt.")]),
      "decline": (
        f"Your friend invited you to {event}, but you cannot attend. Write to apologise, explain your reason, and suggest another way to meet or learn about the topic.",
        ["Cảm ơn và từ chối lịch sự.", "Nêu lý do cụ thể.", "Đề nghị dịp khác hoặc cách tìm hiểu thay thế."],
        [para("Từ chối", f"Hi Alex,\n\nThank you very much for inviting me to {event}. It sounds interesting, especially because {s['benefit']}. Unfortunately, I will not be able to join you on {when}.", "Lời cảm ơn rồi báo không tham gia được."),
         para("Lý do", f"I have to {excuse}. This was arranged earlier, and I cannot change it now. I realise that you may already have made plans, so I wanted to tell you as soon as possible rather than leave you waiting for an answer.", "Lý do cụ thể và tôn trọng sắp xếp của bạn."),
         para("Phương án khác", f"Could we meet at a cafe the following weekend instead? You could tell me what you learned when you tried to {activity}. I would be particularly interested in the idea that {s['benefit']}. If there are notes or a short recording from the session, I would be happy to read or watch them first.", "Đề nghị thời điểm khác và giữ kết nối với chủ đề."),
         para("Kết thư", "I am sorry to miss this opportunity, but I hope you have a great time. Please let me know whether the new plan suits you.\n\nBest wishes,\nMinh", "Xin lỗi, chúc vui và xin phản hồi.")]),
      "thanks": (
        f"A friend helped you prepare for {event}. Thank your friend, explain how the help made a difference, and suggest a way to show your appreciation.",
        ["Cảm ơn việc giúp cụ thể.", "Nêu tác dụng và điều học được.", "Đề nghị đáp lại."],
        [para("Cảm ơn", f"Hi Alex,\n\nI am writing to thank you for helping me prepare for {event}. It was kind of you to give up part of your weekend, and I really appreciate the time you spent checking the plan with me.", "Nêu hành động được giúp và sự trân trọng."),
         para("Tác dụng", f"Your suggestions helped us {activity} without rushing through the instructions. You also reminded me to prepare {s['item']}. That small detail made the session easier to organise, and I felt much more confident when the other participants arrived.", "Dùng chi tiết để lời cảm ơn cụ thể."),
         para("Điều học được", f"The discussion was useful because {s['benefit']}. One example that stayed with me was this: {s['example']}. I would not have had as much time to listen and learn if I had still been struggling with the preparations on my own.", s["summary_vi"]),
         para("Đáp lại", "I would like to take you out for lunch next weekend as a small way of saying thank you. Please tell me which day would suit you. Thanks again for being so supportive.\n\nBest wishes,\nMinh", "Lời đề nghị đáp lại có hành động cụ thể.")]),
      "apology": (
        f"You let a friend down while preparing for {event}. Apologise, explain what happened, and offer a specific way to put things right.",
        ["Xin lỗi trực tiếp về việc đã làm.", "Giải thích và nhận trách nhiệm.", "Đề xuất cách bù lại và tránh lặp lại."],
        [para("Xin lỗi", f"Hi Alex,\n\nI am very sorry for {MISTAKES[i]} while we were preparing for {event}. I know you were counting on me, and I understand that my mistake made your day more difficult.", "Nêu chính xác lỗi, không xin lỗi chung chung."),
         para("Giải thích", f"The reason was that {REASONS[i]}. However, I should still have contacted you earlier. I realise that you had to change the arrangements without much notice, and I do not want you to think that I took your help for granted.", "Giải thích không thay cho nhận trách nhiệm."),
         para("Khắc phục", f"To make up for this, I can come to {place} early before the next session and help prepare everything. I will bring {s['item']} and check the plan with you in advance. I would also like to help participants {activity}, so that you do not have to manage the activity alone.", "Việc sửa sai phù hợp cùng hoạt động."),
         para("Cam kết và kết", "Next time, I will confirm the details in writing and let you know immediately if there is a problem. Please tell me if my suggestion would help. Once again, I am sorry for letting you down.\n\nBest wishes,\nMinh", "Cam kết cụ thể và hỏi cách sửa có phù hợp không.")]),
      "request": (
        f"Write to Ms Brown at a local centre to ask about {event}. Explain your interest, ask about arrangements and costs, and ask how to register.",
        ["Nêu mục đích và nhu cầu.", "Hỏi giờ, điều kiện, chi phí.", "Hỏi cách đăng ký."],
        [para("Mục đích", f"Dear Ms Brown,\n\nI am writing to ask for further information about {event}. I saw the notice at {place} and would like to know whether the session would be suitable for someone with limited experience.", "Chào người biết tên và nêu mục đích."),
         para("Nhu cầu", f"I am interested in {f} because {s['benefit']}. For example, {s['example']}. I would like a practical introduction rather than a session that requires specialist knowledge.", "Giải thích hoàn cảnh để người nhận tư vấn đúng."),
         para("Câu hỏi", f"Could you please confirm whether the session is on {when} and how long it lasts? I would also like to know the fee and whether materials are included. The notice mentions that participants will {activity}; should I bring {s['item']} or any other equipment?", "Câu hỏi gián tiếp về sắp xếp và chuẩn bị."),
         para("Đăng ký và kết", "Finally, could you explain how to register and whether there is a deadline? If places are limited, please let me know when I should apply.\n\n" + request_close, "Hỏi bước tiếp, cảm ơn và kết thư trang trọng.")]),
      "complaint": (
        f"You paid to attend {event}, but the activity did not match the notice. Write to Mr Green, the centre manager, describing two problems, their effects, and the solution you want.",
        ["Nêu dịch vụ và hai vấn đề.", "Giải thích ảnh hưởng cụ thể.", "Yêu cầu cách giải quyết hợp lý."],
        [para("Mục đích", f"Dear Mr Green,\n\nI am writing to complain about {event}, which I attended at {place} last week. I had expected a practical session about {f}, but several parts of the advertised programme were not provided.", "Nêu dịch vụ, thời điểm và sự không hài lòng."),
         para("Vấn đề đầu", f"The notice stated that we would {activity}. However, most of the session was a general presentation, and there was almost no time for practice. This was disappointing because I had joined specifically to understand how {s['mechanism']}.", "So sánh điều quảng cáo và trải nghiệm thực tế."),
         para("Vấn đề tiếp", f"In addition, the session began forty minutes late without any explanation. I had brought {s['item']} and arranged my day around the advertised starting time, so the delay caused unnecessary inconvenience. Several questions also remained unanswered when the centre closed.", "Chi tiết có thể xử lý, không công kích người nhận."),
         para("Yêu cầu và kết", "I would like you to offer a replacement practical session at no additional cost, or a partial refund if this is not possible. Please explain how you intend to resolve the matter.\n\n" + request_close, "Yêu cầu tương xứng và chờ phản hồi.")]),
      "application": (
        f"A local centre needs volunteers to help with {event}. Write to Ms Brown to apply, explain your relevant skills and motivation, and state when you are available.",
        ["Nêu vị trí ứng tuyển.", "Giải thích động lực và kỹ năng liên quan.", "Cho biết thời gian và đề nghị trao đổi."],
        [para("Ứng tuyển", f"Dear Ms Brown,\n\nI am writing to apply for the volunteer helper role at {event}. I saw your notice at {place} and would welcome the opportunity to support a useful local activity.", "Nêu vị trí và nguồn thông tin."),
         para("Động lực", f"I am interested in {f} because {s['benefit']}. I would enjoy helping participants {activity}. I also understand that {s['risk']}, so clear instructions and patient support are important.", s["summary_vi"]),
         para("Kinh nghiệm", f"I have helped organise small activities at my college, including welcoming participants and preparing materials. This taught me to explain simple instructions, keep a list of tasks and ask for help when necessary. I can check that participants have {s['item']} and help them find the right place before the session begins.", "Kinh nghiệm mẫu phù hợp vai trò, không tự nhận chuyên gia."),
         para("Thời gian và kết", f"I am available on {when}, and I can arrive earlier to help with preparation. I would be happy to attend a short interview or training session if required.\n\n" + request_close, "Nêu lịch phù hợp và sẵn sàng trao đổi.")]),
    }
    return content[kind]


def essay(s, kind):
    f = s["focus"]
    view = s["view"]
    benefit = (
        f"One important point in favour of the proposal is that {s['benefit']}. "
        f"This is possible because {s['mechanism']}. For example, {s['example']}. "
        "The value of this example is that the benefit is connected with a real everyday need. "
        "It is easier for people to see the purpose of an approach when they can relate it to their own situation."
    )
    risk = (
        f"A difficulty that should not be ignored is that {s['risk']}. This matters because {s['risk_why']}. "
        f"For instance, {s['risk_example']}. The result may be frustration or a decision to stop taking part. "
        "This is not simply a question of people refusing to make an effort; practical conditions can prevent a reasonable idea from working as intended."
    )
    cause = (
        f"One reason for the difficulty is that {s['cause']}. This can help explain why {s['risk']}. "
        f"Consider the following situation: {s['risk_example']}. It shows that the problem is connected with the way the activity is organised, "
        "not only with an individual's attitude. Unless that underlying condition changes, asking people to try harder may have little effect."
    )
    action = (
        f"A practical response would be to {s['action']}. For example, {s['implementation']}. "
        "This approach is useful because it deals with a specific obstacle instead of simply repeating a general message. "
        "It could first be tried on a small scale, with feedback from the people involved, and then adjusted if some needs have been overlooked."
    )
    own = (
        f"My own view is that the potential benefit is worth pursuing, but the conditions matter. In particular, it would be sensible to {s['action']}. "
        "People should be able to understand what is expected and raise difficulties before those difficulties become a reason to give up. "
        "A flexible plan is therefore more convincing than a promise that the same method will work equally well for everyone."
    )
    positive_end = f"In conclusion, I support the view that {view}. The main benefit is that {s['benefit']}. However, careful planning and a response to practical difficulties are needed if that benefit is to be achieved."
    if kind == "opinion-agree":
        return (f"{cap(view)}. To what extent do you agree or disagree?",
          ["Nêu lập trường đồng ý.", "Giải thích lợi ích bằng cơ chế và ví dụ.", "Bàn tính khả thi, thừa nhận giới hạn và chốt lập trường."], [
          para("Mở bài", f"The proposal that {view} raises a useful question about {f}. I agree with this view because it can meet a practical need. My support does not mean that every version of the proposal will work; the way it is introduced is also important.", "Đồng ý rõ, không khẳng định mọi cách làm đều tốt."),
          para("Lý do 1 — lợi ích", benefit, s["summary_vi"]),
          para("Lý do 2 — cách làm khả thi", "A second reason for supporting this approach is that its difficulties can be addressed through practical changes. " + action, "Lý do thứ hai là có cách xử lý trở ngại cụ thể."),
          para("Giới hạn và kết", f"It is true that {s['risk']}, especially because {s['risk_why']}. This calls for better planning rather than the complete rejection of the idea.\n\n" + positive_end, "Thừa nhận giới hạn và giữ lập trường đồng ý.")])
    if kind == "opinion-disagree":
        return (f"A single standard approach to {f} should be required for everyone, regardless of their needs. Do you agree or disagree?",
          ["Phản đối việc áp dụng một cách cứng nhắc cho tất cả.", "Giải thích trở ngại và khác biệt hoàn cảnh.", "Thừa nhận lợi ích và đề xuất cách linh hoạt hơn."], [
          para("Mở bài", f"It is sometimes suggested that everyone should follow one standard approach to {f}, regardless of their needs. I disagree with this view. A shared goal can be useful, but an identical rule may ignore the practical conditions that determine whether people can benefit from it.", "Phản đối sự cứng nhắc, không phủ nhận toàn bộ chủ đề."),
          para("Lý do 1 — điều kiện khác nhau", risk, s["summary_vi"]),
          para("Lý do 2 — nguyên nhân cần xử lý", cause, "Giải thích vì sao yêu cầu cố gắng hơn chưa đủ."),
          para("Thừa nhận và hướng khác", f"This does not mean that the original idea has no value. For example, {s['example']}. The possibility that {s['benefit']} is worth taking seriously. However, a better approach would be to {s['action']}. {cap(s['implementation'])}.", "Thừa nhận điểm mạnh và đưa giải pháp có điều kiện."),
          para("Kết bài", "In conclusion, I do not support requiring one method for everyone. A workable policy should keep its main purpose while allowing practical adjustments. This is more likely to help people participate than a rigid rule that treats different circumstances as if they were the same.", "Chốt đúng đối tượng phản đối: một phương pháp cho mọi người.")])
    if kind == "opinion-partial":
        return (f"The following proposal has been made: {view}. Should this approach be used in every situation? Give your opinion.",
          ["Nêu phần đồng ý và giới hạn.", "Giải thích lợi ích lẫn trường hợp không phù hợp.", "Chốt điều kiện áp dụng."], [
          para("Mở bài", f"The suggestion that {view} has clear attractions. I agree with it to some extent, but I do not think it should be applied in exactly the same way in every situation. The potential benefits need to be considered alongside the needs of the people involved.", "Đồng ý một phần, nói rõ giới hạn ngay đầu."),
          para("Phần đồng ý", benefit, s["summary_vi"]),
          para("Giới hạn", risk, "Dùng ví dụ để giải thích trường hợp cần điều chỉnh."),
          para("Điều kiện", own, "Nêu điều kiện cụ thể để áp dụng."),
          para("Kết bài", f"In conclusion, I support the aim behind this proposal because {s['benefit']}. However, support should depend on whether practical barriers are addressed. A flexible approach that responds to actual needs is preferable to applying the idea everywhere without further thought.", "Kết luận nhất quán với đồng ý có điều kiện.")])
    if kind == "discussion":
        return (f"Some people support the proposal that {view}. Others believe practical difficulties should be addressed before it is introduced widely. Discuss both views and give your own opinion.",
          ["Giải thích vì sao một phía ủng hộ.", "Giải thích vì sao phía kia thận trọng.", "Nêu ý kiến riêng có lý do."], [
          para("Mở bài", f"There are different views about the proposal that {view}. Supporters emphasise its usefulness, while others believe that practical difficulties should be dealt with before it is introduced more widely. Both positions have reasonable concerns. In my opinion, the idea is worth supporting when those difficulties are addressed.", "Giới thiệu hai phía và ý kiến cá nhân."),
          para("Quan điểm thứ nhất", "On the one hand, supporters focus on the benefits. " + benefit, s["summary_vi"]),
          para("Quan điểm thứ hai", "On the other hand, a more cautious view deserves attention. " + risk, "Giải thích phía thận trọng thay vì chỉ nhắc tên."),
          para("Ý kiến của tôi", own, "Cân nhắc cả hai phía và đề xuất điều kiện."),
          para("Kết bài", "In conclusion, one side is right to recognise the potential value, while the other is right to ask how the idea will work in practice. I support a planned and flexible approach that pursues the benefit without overlooking the people who may face difficulties.", "Tóm tắt cả hai, chốt quan điểm.")])
    if kind == "advantages":
        return (f"Consider the proposal that {view}. What are its advantages and disadvantages?",
          ["Bàn cả lợi ích và bất lợi.", "Mỗi mặt cần giải thích và ví dụ.", "Tổng hợp, không tự đổi thành chỉ nêu ý kiến."], [
          para("Mở bài", f"The proposal that {view} could affect everyday life in several ways. It is useful to consider both the opportunities it creates and the difficulties it may bring. Neither side should be judged only from a slogan, because the practical details can make a substantial difference.", "Nêu nhiệm vụ so sánh hai mặt."),
          para("Lợi ích", benefit, s["summary_vi"]),
          para("Bất lợi", risk, "Phân tích bất lợi bằng tình huống cụ thể."),
          para("Điều gì làm thay đổi tác động?", f"The balance between these effects depends partly on organisation. For example, {s['cause']}. A way to reduce this difficulty would be to {s['action']}. {cap(s['implementation'])}. This would not remove every disadvantage, but it could make the approach more suitable for a wider range of people.", "Giải thích yếu tố làm lợi–hại thay đổi, không phủ nhận bất lợi."),
          para("Kết bài", f"In conclusion, an important advantage is that {s['benefit']}, whereas a notable disadvantage is that {s['risk']}. Both should be considered before a decision is made, with attention to the resources and circumstances of the people affected.", "Tóm tắt đúng hai mặt đã phân tích.")])
    if kind == "outweigh":
        return (f"The proposal is that {view}. Do the advantages of this proposal outweigh its disadvantages?",
          ["Chọn bên có sức nặng hơn.", "Thừa nhận và phân tích bất lợi.", "So sánh mức độ tác động, không chỉ đếm số ý."], [
          para("Mở bài", f"The proposal that {view} has both positive and negative aspects. In my view, the advantages can outweigh the disadvantages if basic practical support is included. The main benefit addresses a recurring everyday need, while at least some of the difficulties can be reduced through careful organisation.", "Nêu đánh giá và điều kiện rõ ràng."),
          para("Thừa nhận bất lợi", risk, "Không bỏ qua phía yếu hơn."),
          para("Lợi ích lớn hơn", benefit, s["summary_vi"]),
          para("So sánh sức nặng", f"I give greater weight to the benefit because it could help people repeatedly, not just on one special occasion. The disadvantage is still important, but it is not always unavoidable. One response would be to {s['action']}. {cap(s['implementation'])}. This gives a concrete reason to believe that the obstacle can be reduced rather than merely ignored.", "So sánh tính lặp lại của lợi ích và khả năng giảm bất lợi."),
          para("Kết bài", "In conclusion, I believe the advantages are greater when the approach is organised responsibly. If the practical support is absent, the balance could change. The strongest case is therefore for a workable version of the proposal, not for assuming that any version will automatically succeed.", "Chốt nhất quán, không khẳng định luôn đúng.")])
    if kind == "cause-solution":
        return (f"In situations related to {f}, {s['risk']}. What are the causes of this problem, and what could be done to address it?",
          ["Giải thích nguyên nhân.", "Đưa giải pháp xử lý đúng nguyên nhân.", "Nêu cách thực hiện và điều kiện."], [
          para("Mở bài", f"Although there may be value in the proposal that {view}, a practical difficulty is that {s['risk']}. Understanding why this happens is important before suggesting a solution. Otherwise, the same problem may return even after people have spent time and effort trying to improve the situation.", "Giới thiệu đúng vấn đề được hỏi."),
          para("Nguyên nhân", cause, "Nối điều kiện tổ chức với vấn đề."),
          para("Giải pháp", action, "Hành động cụ thể có ví dụ thực hiện."),
          para("Vì sao giải pháp đáng làm?", f"The aim is not to abandon the useful parts of the idea. It is to make them accessible in practice. For example, {s['example']}. This illustrates the potential value of the fact that {s['benefit']}. Asking participants what prevents them from benefiting would help organisers choose changes that actually matter.", s["summary_vi"]),
          para("Kết bài", f"In conclusion, the problem is linked to the fact that {s['cause']}. A practical response is to {s['action']}. Trying this carefully and listening to the people affected is more convincing than expecting a general instruction to solve the difficulty on its own.", "Tóm tắt nguyên nhân–giải pháp tương ứng.")])
    if kind == "problem-solution":
        return (f"In the context of {f}, {s['cause']}. What problems can this create, and how could they be reduced?",
          ["Phân tích tác hại, không thay bằng chỉ kể nguyên nhân.", "Đưa giải pháp tương ứng.", "Giải thích cách đánh giá giải pháp có ích."], [
          para("Mở bài", f"The fact that {s['cause']} can create difficulties in the context of {f}. A useful idea may fail to help the people it is intended for. It is therefore important to examine the practical problems and suggest changes that deal with them directly.", "Giới thiệu tình trạng và yêu cầu bàn tác hại."),
          para("Vấn đề và ảnh hưởng", risk, "Nêu tác hại với người cụ thể."),
          para("Giá trị bị bỏ lỡ", f"Another concern is that the potential benefit may not be realised. The original aim is useful because {s['benefit']}. For example, {s['example']}. When the arrangement does not work, people may lose this opportunity as well as the time they have already spent trying to participate. This can make them less willing to try again.", "Phát triển hệ quả: mất cơ hội và sự tin tưởng."),
          para("Giải pháp", action, "Cách làm trực tiếp giảm trở ngại."),
          para("Kết bài", f"In conclusion, the main problems include the possibility that {s['risk']} and that a useful opportunity is lost. A response based on practical needs, such as the decision to {s['action']}, is more likely to help than simply repeating that the original idea is worthwhile.", "Chốt vấn đề và giải pháp, không mở ý mới.")])
    if kind == "cause-effect":
        return (f"Some people experience difficulties related to {f}, including the problem that {s['risk']}. Discuss the causes and the effects on the people involved.",
          ["Giải thích nguyên nhân của khó khăn.", "Phân tích hệ quả trực tiếp và gián tiếp.", "Không thay phần hệ quả bằng bài giải pháp."], [
          para("Mở bài", f"Difficulties related to {f} can have effects beyond the activity itself. One important example is the possibility that {s['risk']}. Looking at the causes and consequences can explain why a proposal that appears useful may produce a disappointing experience for some people.", "Xác định vấn đề, báo trước nguyên nhân và hệ quả."),
          para("Nguyên nhân", cause, "Giải thích cơ chế gây khó khăn."),
          para("Hệ quả trực tiếp", f"The immediate effect can be frustration and difficulty taking part. This is understandable because {s['risk_why']}. A concrete example is that {s['risk_example']}. The person involved may then need to change plans, ask for additional help or look for a different way to meet the same need. The impact therefore extends beyond one unsuccessful attempt.", "Nối tình huống với việc phải thay đổi kế hoạch."),
          para("Hệ quả lâu dài", f"A further effect is that people may become less willing to take part in similar activities. This matters because {s['benefit']}. For example, {s['example']}. If a negative experience prevents someone from trying again, that potential benefit may be lost. Repeated difficulties can also reduce confidence in the organisation or advice behind the activity.", s["summary_vi"]),
          para("Kết bài", f"In conclusion, the difficulty is partly caused by the fact that {s['cause']}. Its effects can include immediate inconvenience, lost opportunities and reduced willingness to participate in the future. These consequences show why the practical conditions of an activity matter as much as its intended purpose.", "Tóm tắt nguyên nhân và hệ quả đã bàn.")])
    return (f"Why might people support the proposal that {view}? Is this a positive or negative development?",
       ["Trả lời vì sao có người ủng hộ.", "Đánh giá tích cực hay tiêu cực và giải thích.", "Thừa nhận điều kiện, kết cả hai câu trả lời."], [
       para("Mở bài", f"There are understandable reasons why people may support the proposal that {view}. I consider this a mainly positive development when it is organised with practical needs in mind. Its value comes from the help it can offer in daily life, rather than from the idea simply sounding modern or attractive.", "Trả lời ngắn cả hai câu hỏi."),
       para("Câu hỏi 1 — vì sao?", benefit, s["summary_vi"]),
       para("Câu hỏi 2 — đánh giá", f"I see the development as positive because it gives people a useful option, provided that the main obstacles are recognised. One concern is that {s['risk']}. This is connected with the fact that {s['cause']}. Ignoring that concern would weaken the case for the proposal, so support should include an effort to improve how it works.", "Đánh giá có lý do và giới hạn."),
       para("Ví dụ về điều kiện", action, "Minh họa cách giữ lợi ích và giảm trở ngại."),
       para("Kết bài", f"In conclusion, people have good reason to support this approach because {s['benefit']}. I regard it as mainly positive, but the result depends on practical planning. A flexible approach that listens to the people involved is more likely to deliver the intended value.", "Chốt cả lý do và đánh giá.")])


def speaking_one(s):
    f = s['focus']
    sections = [
        {"label": s['title'], "questions": [
            qa(f"Are you interested in {f}?", f"Yes, I am, mainly because {s['benefit']}. I would like to understand how this works in everyday life, rather than just read a definition.", "Trả lời trực tiếp → thêm một lý do."),
            qa(f"How could you learn more about {f}?", f"I could join {s['event']}. There, I would have a chance to {s['activity']}. Trying something with other people usually helps me remember it.", "Nêu một cách tìm hiểu và hoạt động cụ thể."),
            qa(f"Is there anything difficult about {f}?", f"One possible difficulty is that {s['risk']}. For example, {s['risk_example']}. I think it is better to recognise that problem early.", "Một khó khăn → một ví dụ, không liệt kê quá nhiều.")
        ]},
        {"label": "Kế hoạch cuối tuần & học cùng bạn bè", "questions": [
            qa("What would you like to do with a friend this weekend?", f"I would like to {s['activity']}. We could bring {s['item']} and compare what we learn. It would give us something useful to talk about afterwards.", "Nêu kế hoạch, đồ cần mang và lợi ích."),
            qa("Do you prefer learning something alone or with friends?", f"For a new topic, I prefer being with one or two friends. For instance, if we were learning about {f}, we could ask each other questions. However, I like reviewing my notes alone afterwards.", "Chọn một phía, thêm tình huống và một ngoại lệ."),
            qa("How do you decide whether an activity is worth your time?", f"I ask whether I can use what I learn. In this case, it would be helpful to know how to {s['action']}. I also check the time and cost before making a plan.", "Một tiêu chí → áp dụng vào tình huống → chi tiết thêm.")
        ]}
    ]
    return (f"Answer the questions about {f}, then talk about weekend plans and learning with friends.",
            ["Hai chủ đề nhỏ, mỗi chủ đề 3 câu hỏi.", "Mỗi câu: trả lời trực tiếp → lý do → một chi tiết hoặc ví dụ.", "Đọc rồi thay chi tiết cho đúng trải nghiệm của bạn."], [], sections, [], None)


def speaking_two(s):
    f = s['focus']
    options = [f"Attend {s['event']}", f"Read a beginner's guide to {f}", f"Watch short videos about {f}"]
    choice = (s['number'] - 1) % 3
    constraints = [
        "You and a friend are beginners. You are both free this weekend, and you want to ask questions and try an activity together.",
        "You want to learn during a quiet train journey. Your internet connection is unreliable, and you prefer to make written notes at your own pace.",
        "You have only short breaks at home. You have a reliable internet connection and find spoken explanations with pictures easy to follow."
    ]
    reasons = [
        (f"The main reason is that we could {s['activity']}. We could ask the organiser about anything unclear instead of having to guess. My friend and I could also compare our ideas during the activity, which would make it easier to stay involved.",
         "I would not choose the guide this time. It could be useful for later revision, but it would not give us immediate feedback when we have questions. Short videos would be convenient too, but watching them separately would not meet our wish to practise together with someone who can help."),
        (f"The main reason is that I can download or print the guide before leaving home and read it without a connection. I can stop whenever I need to make a note. In particular, I would look for a simple explanation of why {s['mechanism']}.",
         "I would not choose the event because its fixed time would not fit my journey. It might be useful another weekend, but it does not meet my present need. Videos would be less suitable too: streaming could stop when the connection fails, and sound would be inconvenient in a quiet carriage."),
        (f"The main reason is that I can pause a short video and continue during the next break. Pictures and spoken explanations could help me understand the topic. For example, a clear demonstration could show how to {s['action']}, with each step explained as it happens.",
         "I would not choose the event because I cannot set aside a long period at a fixed time. A written guide would be useful for checking details, but it does not match my preference for spoken explanations and pictures as well as a short video does.")
    ]
    reason, comparisons = reasons[choice]
    ps = [
        para("Chọn phương án", f"In this situation, I would choose to {options[choice][0].lower() + options[choice][1:]}. I think this option fits my needs best. The important thing is to choose a method I can actually use, rather than simply the one that sounds most impressive.", "Nêu lựa chọn ngay và bám điều kiện của đề."),
        para("Giải thích lựa chọn", reason + f" Learning about this topic is worthwhile because {s['benefit']}.", s['summary_vi']),
        para("So sánh hai phương án còn lại", comparisons, "Không nói hai cách kia vô ích; chỉ ra vì sao ít phù hợp trong tình huống này."),
        para("Giới hạn và kết luận", f"Of course, I would still check that the information is suitable for a beginner. One point I would want to understand is that {s['risk']}. After learning the basics, I could try one small idea and see whether it helps. For these reasons, my first choice would be the most practical starting point.", "Thừa nhận giới hạn, quay về lựa chọn đã nêu.")
    ]
    return (f"You want to learn more about {f}. {constraints[choice]} Which of the three options is best, and why?",
            ["Chọn một trong ba phương án.", "Dùng điều kiện về thời gian, cách học hoặc kết nối trong đề để giải thích.", "So sánh rõ cả hai phương án còn lại và chốt lựa chọn."], ps, [], options, choice)


def speaking_three(s):
    f = s['focus']
    ps = [
        para("Mở bài", f"I would like to talk about {f}. In my opinion, this topic is worth considering because it can affect ordinary decisions and experiences. I will look at a practical benefit, a possible difficulty and a way to make the approach work better.", "Giới thiệu chủ đề và ba nhánh sẽ triển khai."),
        para("Ý 1 — lợi ích thực tế", f"First, {s['benefit']}. This is possible because {s['mechanism']}. For example, {s['example']}. That example shows how an idea can be useful in a real situation. People are more likely to value an approach when they can see what it changes in their own lives.", s['summary_vi']),
        para("Ý 2 — khó khăn", f"However, {s['risk']}. One reason is that {s['risk_why']}. For instance, {s['risk_example']}. I do not think this means we should reject the whole idea. It means that we need to understand the needs of the people involved before expecting the same result for everyone.", "Một trở ngại → lý do → ví dụ; tránh khẳng định tuyệt đối."),
        para("Ý 3 — cách cải thiện", f"A useful step would be to {s['action']}. To be more specific, {s['implementation']}. I would start with a small trial and ask the people involved what helped and what remained difficult. Their feedback could then guide the next step, so that effort goes towards a real need.", "Giải pháp cụ thể → cách thực hiện → phản hồi."),
        para("Kết bài", "To sum up, I think the potential benefit is valuable, but practical planning matters. We should keep the useful parts, recognise the difficulties and make changes when necessary. That would be more helpful than assuming that one approach suits everybody.", "Chốt quan điểm, không thêm luận điểm mới.")
    ]
    follow = [qa(f"Should everyone follow the same approach to {f}?", f"No, I do not think so. People have different needs and resources. For example, {s['risk_example']}. A flexible approach would give that person a better chance to benefit.", "Quan điểm → khác biệt nhu cầu → ví dụ."),
              qa("Who should help address the difficulty you mentioned?", f"The people organising the activity should listen to those taking part. They could {s['action']}. Participants should also explain what is difficult instead of assuming that organisers already know.", "Nêu vai trò của cả người tổ chức và người tham gia."),
              qa("How could we tell whether a new approach is successful?", f"We could ask whether it solves the original problem and makes daily life easier. Here, we would want to see whether {s['benefit']}. I would compare people's experiences before and after a small trial rather than judge success by popularity alone.", "Tiêu chí đo → áp dụng chủ đề → cách so sánh.")]
    return (f"Develop a talk about {f}. Use these ideas: practical benefits, possible difficulties, and ways to improve the experience. Then answer the follow-up questions.",
            [f"Lợi ích: {s['benefit']}.", f"Khó khăn: {s['risk']}.", f"Cải thiện: {s['action']}."], ps,
            [{"label": "Câu hỏi mở rộng", "questions": follow}], [], None)


def full_answer(sample):
    return "\n\n".join([p['text'] for p in sample['paragraphs']] + [q['answer'] for section in sample['sections'] for q in section['questions']])


def build():
    types = [{"id": k, "label": v, "group": "writing-task1"} for k,v in LETTER_TYPES]
    types += [{"id": k, "label": v, "group": "writing-task2"} for k,v in ESSAY_TYPES]
    types += [{"id": "social", "label": "Hỏi đáp hai chủ đề", "group": "speaking-part1"},
              {"id": "choice", "label": "Chọn & so sánh giải pháp", "group": "speaking-part2"},
              {"id": "development", "label": "Phát triển chủ đề & mở rộng", "group": "speaking-part3"}]
    buckets, summaries, samples = {}, [], []
    for t in types:
        for s in scenarios():
            group, kind, topic = t['group'], t['id'], s['topic']
            sections, options, choice = [], [], None
            if group == 'writing-task1': prompt, requirements, paragraphs = letter(s,kind)
            elif group == 'writing-task2': prompt, requirements, paragraphs = essay(s,kind)
            else:
                fn = {'speaking-part1': speaking_one, 'speaking-part2': speaking_two, 'speaking-part3': speaking_three}[group]
                prompt, requirements, paragraphs, sections, options, choice = fn(s)
            sample = dict(id=f"{group}-{kind}-{s['id']}", group=group, type=kind, topic=topic,
                          number=s['number'], title=s['title'], focus=s['focus'], prompt=prompt,
                          requirementsVi=requirements, summaryVi=s['summary_vi'], paragraphs=paragraphs,
                          sections=sections, options=options, selectedOption=choice)
            answer = full_answer(sample)
            sample['wordCount'] = words(answer)
            sample['mainWordCount'] = words(' '.join(p['text'] for p in paragraphs))
            # Topic phrases are labelled separately when absent from this particular answer.
            sample['phrases'] = [{'en': en, 'vi': vi, 'inAnswer': en.lower() in answer.lower()} for en,vi in s['phrases']]
            sample['framePhrases'] = [{'en': en, 'vi': vi} for en,vi in [
                ('I am writing to', 'Tôi viết để…'), ('For example', 'Ví dụ…'),
                ('One possible difficulty is that', 'Một khó khăn có thể là…'),
                ('The main reason is that', 'Lý do chính là…'), ('In conclusion', 'Tóm lại…'),
                ('A useful step would be to', 'Một bước hữu ích là…'),
                ('Please let me know', 'Hãy cho tôi biết…'), ('I would like to', 'Tôi muốn…')
            ] if en.lower() in answer.lower()]
            bucket = f"{group}/{kind}/{topic}.json"
            buckets.setdefault(bucket, []).append(sample)
            summaries.append({k:sample[k] for k in ['id','group','type','topic','number','title','focus','wordCount'] } | {'bucket':bucket})
            samples.append(sample)
    counts = Counter(s['group'] for s in samples)
    index = dict(version=VERSION, total=len(samples), groups=[g | {'count':counts[g['id']]} for g in GROUPS],
                 topics=[{'id': k, 'label':v} for k,v in TOPICS], types=types, samples=summaries,
                 sourceUrl='https://vstep.vnu.edu.vn/test-format/')
    validate(samples,buckets)
    return {'index.json':index, **{key:{'version':VERSION,'samples':value} for key,value in buckets.items()}}


def validate(samples,buckets):
    assert len(samples)==1150 and len(buckets)==115
    assert all(len(items)==10 for items in buckets.values())
    assert len({s['id'] for s in samples})==len(samples)
    assert len({hashlib.sha256(full_answer(s).encode()).hexdigest() for s in samples})==len(samples), 'Duplicate answer'
    for s in samples:
        answer = full_answer(s)
        assert not re.search(r'\[[^\]]+\]|undefined|TODO|\{[^}]+\}',answer), s['id']
        assert s['prompt'] and s['requirementsVi'] and s['phrases'],s['id']
        minimum = {'writing-task1':120, 'writing-task2':250}.get(s['group'],0)
        assert s['wordCount']>=minimum, (s['id'],s['wordCount'],minimum)
        if s['group']=='speaking-part1':
            assert len(s['sections'])==2 and all(len(x['questions'])==3 for x in s['sections'])
        if s['group']=='speaking-part2':
            assert len(s['options'])==3 and s['selectedOption'] in range(3)
            assert s['mainWordCount']>=180
        if s['group']=='speaking-part3':
            assert len(s['requirementsVi'])==3 and len(s['sections'][0]['questions'])==3
            assert s['mainWordCount']>=200
    for group in GROUPS:
        matches=[s for s in samples if s['group']==group['id']]
        print(f"{group['id']}: {len(matches)} samples, {min(s['wordCount'] for s in matches)}–{max(s['wordCount'] for s in matches)} words (including answers to follow-ups)")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true',help='Validate content and verify generated files are up to date')
    args=parser.parse_args()
    outputs=build()
    for name, data in outputs.items():
        path=OUT/name
        rendered=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
        if args.check:
            assert path.exists() and path.read_text()==rendered, f'Out of date: {path}'
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(rendered)
    actual={str(p.relative_to(OUT)) for p in OUT.rglob('*.json')}
    assert actual==set(outputs), f'Unexpected or missing generated files: {actual ^ set(outputs)}'
    print(f"{'Verified' if args.check else 'Built'} 1,150 full samples in {len(outputs)} JSON files.")

if __name__=='__main__': main()
