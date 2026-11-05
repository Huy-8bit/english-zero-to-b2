"""Reusable letter scaffolds. Brackets are explicit topic/detail boundaries, never guessed in the UI."""
import re

REGISTER_LABELS = {'formal': 'Trang trọng', 'informal': 'Thân mật'}
PURPOSES = [('reply', 'Trả lời / cung cấp thông tin'), ('advice', 'Đưa lời khuyên'),
            ('invitation', 'Mời tham gia'), ('accept', 'Nhận lời mời'), ('decline', 'Từ chối lời mời'),
            ('thanks', 'Cảm ơn'), ('apology', 'Xin lỗi và khắc phục'), ('request', 'Hỏi thông tin / yêu cầu'),
            ('complaint', 'Phàn nàn'), ('application', 'Xin việc / ứng tuyển')]
# Existing IDs are retained so saved links and learning progress still point to the same purpose/register.
LETTER_TYPES = [dict(id=k, label=v, register='formal' if k in ('request','complaint','application') else 'informal', purpose=k) for k,v in PURPOSES]
LETTER_TYPES += [dict(id='formal-'+k, label=v, register='formal', purpose=k) for k,v in PURPOSES[:7]]
LETTER_TYPES += [dict(id='informal-request', label=dict(PURPOSES)['request'], register='informal', purpose='request')]

SLOT_LABELS = {
    'recipient': 'danh xưng và họ người nhận', 'friend': 'tên người bạn', 'sender': 'tên của bạn',
    'full_name': 'họ tên của bạn', 'event': 'sự kiện / hoạt động', 'focus': 'chủ đề',
    'when': 'ngày và giờ', 'place': 'địa điểm', 'activity': 'hoạt động — động từ nguyên mẫu',
    'item': 'đồ cần mang', 'benefit': 'lợi ích — chủ ngữ + động từ', 'example': 'ví dụ — chủ ngữ + động từ',
    'risk': 'khó khăn — chủ ngữ + động từ', 'cause': 'nguyên nhân — chủ ngữ + động từ',
    'action': 'giải pháp — động từ nguyên mẫu', 'implementation': 'cách làm — chủ ngữ + động từ',
    'excuse': 'việc bận — động từ nguyên mẫu', 'alternative': 'đề xuất khác — động từ nguyên mẫu',
    'mistake': 'lỗi cần xin lỗi — V-ing', 'reason': 'lý do — chủ ngữ + động từ',
    'repair': 'cách sửa — động từ nguyên mẫu', 'help': 'việc được giúp — V-ing',
    'result': 'kết quả — động từ nguyên mẫu', 'return_favour': 'việc đáp lại — động từ nguyên mẫu',
    'problem_one': 'vấn đề thứ nhất — chủ ngữ + động từ', 'problem_two': 'vấn đề thứ hai — chủ ngữ + động từ',
    'effect': 'ảnh hưởng — chủ ngữ + động từ', 'remedy': 'yêu cầu giải quyết — động từ nguyên mẫu',
    'position': 'vị trí ứng tuyển', 'experience': 'kinh nghiệm — V-ing', 'skill': 'kỹ năng — động từ nguyên mẫu',
    'availability': 'lịch có thể làm việc', 'question_one': 'whether / wh + chủ ngữ + động từ',
    'question_two': 'câu hỏi gián tiếp thứ hai', 'need': 'nhu cầu — chủ ngữ + động từ',
}


def render_parts(template, values):
    parts=[]
    for token in re.split(r'(\[[a-z_]+\])',template):
        if not token: continue
        if token.startswith('['):
            key=token[1:-1]
            parts.append({'text': values[key], 'kind': 'detail', 'labelVi': SLOT_LABELS[key]})
        else:
            parts.append({'text': token, 'kind': 'frame'})
    return parts


def paragraph(label, template, note, values):
    parts=render_parts(template,values)
    return dict(label=label, text=''.join(p['text'] for p in parts), noteVi=note, parts=parts,
                template=re.sub(r'\[([a-z_]+)\]',lambda m:'['+SLOT_LABELS[m[1]]+']',template))


FORMAL = {
 'reply': [
  ('Mở thư và mục đích', 'Dear [recipient],\n\nThank you for your enquiry about [event]. I am writing to provide the information you requested. I hope the following details will help you make the necessary arrangements.', 'Cảm ơn yêu cầu, nói rõ mình đang trả lời thông tin.'),
  ('Thông tin thứ nhất', 'First of all, the event will take place at [place] on [when]. Participants will have the opportunity to [activity]. The programme is intended to provide a practical introduction to [focus].', 'Trả lời câu hỏi đầu bằng thông tin cụ thể.'),
  ('Thông tin tiếp theo', 'In addition, please bring [item]. One potential benefit is that [benefit]. For example, [example]. If you have any particular requirements, please let us know in advance so that we can consider suitable arrangements.', 'Nêu chuẩn bị, lợi ích và cách hỏi thêm.'),
 ],
 'advice': [
  ('Mở thư và mục đích', 'Dear [recipient],\n\nThank you for contacting me about [focus]. I am writing to offer some suggestions in response to your request. I understand that you would like a practical starting point, and I hope the following advice will be useful.', 'Lời khuyên lịch sự, không dùng giọng trò chuyện với bạn thân.'),
  ('Đề xuất đầu', 'I would recommend attending [event]. This would give you an opportunity to [activity]. One potential benefit is that [benefit]. For example, [example].', 'Gợi ý một việc và giải thích giá trị.'),
  ('Khó khăn và giải pháp', 'It is also worth considering that [risk]. A practical response would be to [action]. For instance, [implementation]. I would suggest trying this on a small scale before making a longer-term commitment.', 'Một giới hạn và cách xử lý tương ứng.'),
 ],
 'invitation': [
  ('Mở thư và mục đích', 'Dear [recipient],\n\nI am writing to invite you to [event]. We would be pleased to welcome you and believe that your participation would be valuable. The event will focus on [focus].', 'Mời với giọng lịch sự, nêu sự kiện.'),
  ('Sắp xếp', 'The event will take place at [place] on [when]. During the session, participants will [activity]. There will also be time for questions and discussion, so everyone can share ideas and seek clarification.', 'Thời gian, nơi và chương trình là phần thay theo đề.'),
  ('Lợi ích và xác nhận', 'One potential benefit is that [benefit]. For example, [example]. Please bring [item]. I would be grateful if you could confirm whether you are able to attend. Please also let us know if you require any further details.', 'Lý do nên đến, chuẩn bị và xin xác nhận.'),
 ],
 'accept': [
  ('Mở thư và nhận lời', 'Dear [recipient],\n\nThank you for your invitation to [event]. I am pleased to accept and would welcome the opportunity to take part. I appreciate the time you have spent making the arrangements.', 'Nhận lời rõ ràng, không chỉ cảm ơn lời mời.'),
  ('Xác nhận sắp xếp', 'I understand that the event will take place at [place] on [when]. I will plan my journey accordingly. Please let me know if there are any changes to the time or location.', 'Xác nhận thông tin người mời đã đưa.'),
  ('Chuẩn bị và hỗ trợ', 'I am particularly interested in the opportunity to [activity]. One reason is that [benefit]. I can bring [item], but I would be grateful if you could confirm whether anything else is required. I would also be happy to assist with the preparations if needed.', 'Nêu sự quan tâm và hỏi chuẩn bị bằng câu gián tiếp.'),
 ],
 'decline': [
  ('Mở thư và từ chối', 'Dear [recipient],\n\nThank you for your invitation to [event]. I appreciate being considered. Unfortunately, I am unable to attend on [when], and I apologise for any inconvenience this may cause.', 'Cảm ơn rồi từ chối lịch sự.'),
  ('Lý do', 'The reason is that I have to [excuse]. This commitment was arranged earlier, and I am unable to change it. I wanted to inform you as soon as possible so that you have time to adjust the arrangements if necessary.', 'Giải thích ngắn, tránh viện nhiều lý do.'),
  ('Đề xuất khác', 'If possible, I would welcome the opportunity to [alternative]. I remain interested in [focus], particularly because [benefit]. Please let me know whether this alternative would be suitable or whether you would prefer another arrangement.', 'Đề xuất vẫn phù hợp quan hệ công việc.'),
 ],
 'thanks': [
  ('Mở thư và cảm ơn', 'Dear [recipient],\n\nI am writing to express my sincere thanks for [help]. I greatly appreciate the time and effort you devoted to this. Your assistance made a real difference to the preparations for [event].', 'Cảm ơn hành động cụ thể.'),
  ('Tác dụng', 'Thanks to your support, I was able to [result]. Your advice also helped us prepare [item]. This made the arrangements easier to manage and allowed me to concentrate on the needs of the people taking part.', 'Kết quả nhờ sự hỗ trợ là phần điền theo đề.'),
  ('Điều học được và đáp lại', 'The activity was valuable because [benefit]. For example, [example]. I would be pleased to [return_favour] as a way of showing my appreciation. Please let me know whether this would be helpful.', 'Nối tác dụng với việc cảm ơn hoặc hỗ trợ lại.'),
 ],
 'apology': [
  ('Mở thư và xin lỗi', 'Dear [recipient],\n\nI am writing to apologise for [mistake] in connection with [event]. I understand that this caused inconvenience, and I take responsibility for not informing you sooner.', 'Nhận lỗi trực tiếp và đúng sự việc.'),
  ('Giải thích', 'The reason was that [reason]. However, I recognise that I should have checked the arrangements and contacted you earlier. Please be assured that I do not take your time or assistance for granted.', 'Giải thích nhưng không đổ lỗi.'),
  ('Khắc phục', 'To put matters right, I would like to [repair]. I will also make sure that I have [item] ready before the next session. In future, I will confirm the details in writing and inform you immediately if a problem arises. Please let me know whether this proposal is acceptable.', 'Cách sửa cụ thể, biện pháp tránh lặp lại và xin phản hồi.'),
 ],
 'request': [
  ('Mở thư và mục đích', 'Dear [recipient],\n\nI am writing to request further information about [event]. I am interested in [focus] and would appreciate your advice before making a decision. I would like to explain my situation and ask a few questions.', 'Giải thích mình cần thông tin gì.'),
  ('Nhu cầu', 'My main concern is that [need]. I understand that participants will [activity]. This interests me because [benefit]. For example, [example].', 'Nêu hoàn cảnh để người nhận trả lời đúng nhu cầu.'),
  ('Câu hỏi gián tiếp', 'Could you please confirm [question_one]? I would also like to know [question_two]. In addition, please let me know how to register and whether there is a deadline. This information would help me make suitable arrangements.', 'Sau confirm / know dùng trật tự chủ ngữ + động từ.'),
 ],
 'complaint': [
  ('Mở thư và mục đích', 'Dear [recipient],\n\nI am writing to complain about [event], which I attended at [place]. Unfortunately, the service did not meet the expectations set out in the information provided before I booked.', 'Dịch vụ, nơi và mục đích phàn nàn.'),
  ('Hai vấn đề', 'The first problem was that [problem_one]. In addition, [problem_two]. I had expected a practical opportunity to [activity], so these problems were particularly disappointing.', 'Phải thay bằng các vấn đề thực sự trong đề.'),
  ('Ảnh hưởng và yêu cầu', 'As a result, [effect]. I would be grateful if you could [remedy]. Please explain how you intend to resolve the matter and when I can expect a response. I believe this is a reasonable request in view of the difficulties described above.', 'Tác động cụ thể, yêu cầu tương xứng và hỏi bước xử lý.'),
 ],
 'application': [
  ('Mở thư và ứng tuyển', 'Dear [recipient],\n\nI am writing to apply for the position of [position]. I am interested in this opportunity because it would allow me to contribute to [event] while developing my skills in a practical working environment.', 'Nêu tên công việc được tuyển, không chỉ xin tham gia sự kiện.'),
  ('Kinh nghiệm và kỹ năng', 'I have experience in [experience]. This has helped me learn to [skill]. I believe these skills would be useful when helping participants [activity]. I am willing to learn and would take care to follow the instructions given by my supervisor.', 'Kinh nghiệm, kỹ năng phải là điều đúng với ứng viên.'),
  ('Động lực và lịch làm việc', 'I am particularly interested in [focus] because [benefit]. I am available [availability]. I would welcome the opportunity to discuss my application at an interview and provide any further information you may need.', 'Động lực, lịch làm việc và đề nghị phỏng vấn.'),
 ],
}
INFORMAL = {
 'reply': [
  ('Mở thư và mục đích', 'Hi [friend],\n\nThanks for your email. It was lovely to hear from you. You asked me about [event], so I am happy to share some information. I hope it helps you decide what to do.', 'Mở lời thân mật và nhắc đúng câu hỏi của bạn.'),
  ('Thông tin chính', 'First of all, it will take place at [place] on [when]. We will [activity]. One useful point is that [benefit]. For example, [example].', 'Trả lời các ý theo đề, dùng ví dụ cụ thể.'),
  ('Thông tin thêm', 'One more thing to remember is to bring [item]. If you want to prepare, think of a question about [focus]. We can compare our ideas afterwards. Let me know if there is anything else you would like to know.', 'Chuẩn bị và mời hỏi thêm.'),
 ],
 'advice': [
  ('Mở thư và lời khuyên', 'Hi [friend],\n\nThanks for your email. I am glad you told me about your interest in [focus]. You asked for advice, so I have a few suggestions that you might find helpful. You do not need to do everything at once.', 'Đồng cảm trước khi đưa lời khuyên.'),
  ('Gợi ý đầu', 'If I were you, I would start by joining [event]. There, you could [activity]. This could be useful because [benefit]. For example, [example].', 'If I were you + would; start by + V-ing.'),
  ('Giới hạn và giúp đỡ', 'One thing to remember is that [risk]. A good idea would be to [action]. For instance, [implementation]. If you would like some help, we could make a simple plan together and see how it goes.', 'Khó khăn, giải pháp và cách bạn hỗ trợ.'),
 ],
 'invitation': [
  ('Mở thư và lời mời', 'Hi [friend],\n\nI hope you are well. I am writing to invite you to [event]. It has been a while since we last met, and it would be lovely to spend some time together.', 'Lời mời thân mật, hướng đến việc gặp bạn.'),
  ('Thông tin chính', 'It will take place at [place] on [when]. We will [activity]. I think you would enjoy it because [benefit]. For example, [example].', 'Sự kiện, lịch hẹn và lý do bạn thích.'),
  ('Chuẩn bị và xác nhận', 'Please bring [item]. We can meet at the entrance before it starts. You do not need to be an expert, so there is no need to worry. Let me know whether you can come so that I can make the arrangements.', 'Chuẩn bị và hỏi bạn có đến không.'),
 ],
 'accept': [
  ('Mở thư và nhận lời', 'Hi [friend],\n\nThanks for inviting me to [event]. I would love to come. I have been interested in [focus] for a while, so I am glad we will have a chance to explore it together.', 'Nhận lời bằng câu thân mật dễ nhớ.'),
  ('Lịch hẹn', 'I can meet you at [place] on [when]. I will plan my journey so that I arrive a little early. If the time or meeting point changes, please send me a message before I leave home.', 'Xác nhận lịch và cách báo thay đổi.'),
  ('Chuẩn bị', 'I understand that we will [activity]. I can bring [item], but could you let me know if anything else is needed? I think it will be useful because [benefit]. I would also be happy to help with the preparations.', 'Hỏi cần chuẩn bị gì và đề nghị giúp.'),
 ],
 'decline': [
  ('Mở thư và từ chối', 'Hi [friend],\n\nThanks for inviting me to [event]. It sounds interesting, and I would have liked to join you. Unfortunately, I cannot come on [when]. I am really sorry to miss it.', 'Cảm ơn và nói rõ không đến được.'),
  ('Lý do', 'The reason is that I have to [excuse]. This was arranged earlier, and I cannot change it now. I wanted to let you know as soon as possible so that you would not be left waiting for an answer.', 'Nêu việc bận cụ thể, không cần xin lỗi quá dài.'),
  ('Hẹn dịp khác', 'Could we [alternative] instead? I would still like to hear what you learn about [focus]. I am especially interested because [benefit]. Please tell me whether the new plan suits you, or suggest another time that works better.', 'Giữ kết nối với bạn bằng phương án khác.'),
 ],
 'thanks': [
  ('Mở thư và cảm ơn', 'Hi [friend],\n\nI am writing to thank you for [help]. It was very kind of you, and I really appreciate the time you spent with me. Your help made preparing for [event] much easier.', 'Cảm ơn đúng hành động bạn đã giúp.'),
  ('Kết quả', 'Thanks to your help, I was able to [result]. You also reminded me to bring [item]. It would have been much more difficult on my own, and I felt more confident knowing that I could count on you.', 'Kết quả và cảm nhận sau khi được giúp.'),
  ('Đáp lại', 'One thing I learned was that [benefit]. For example, [example]. I would like to [return_favour] as a small way of saying thank you. Please tell me when you are free so that we can make a plan.', 'Điều học được và lời đề nghị đáp lại.'),
 ],
 'apology': [
  ('Mở thư và xin lỗi', 'Hi [friend],\n\nI am really sorry for [mistake] while we were preparing for [event]. I know you were counting on me, and I understand that my mistake made things more difficult for you.', 'Sorry for + danh từ / V-ing; nhận trách nhiệm.'),
  ('Giải thích', 'The reason was that [reason]. However, I should have contacted you earlier. I do not want you to think that I took your help for granted. I understand why you were disappointed, and I will try to be more careful.', 'Giải thích không thay cho việc nhận lỗi.'),
  ('Bù lại', 'To make up for this, I can [repair]. I will bring [item] and check the arrangements with you in advance. Next time, I will let you know straight away if there is a problem. Please tell me if this would help.', 'Bù lại bằng hành động cụ thể và tránh lặp lại.'),
 ],
 'request': [
  ('Mở thư và nhờ giúp', 'Hi [friend],\n\nI hope you are well. I am writing to ask for your help with [event]. I know you have some experience with [focus], so I thought you might be able to give me a few useful details.', 'Nhờ người bạn, không dùng giọng công văn.'),
  ('Nhu cầu', 'The main thing is that [need]. I would like to [activity], and I think this could help because [benefit]. Before I make a plan, there are a couple of things I would like to check.', 'Nói vì sao cần thông tin.'),
  ('Câu hỏi', 'Could you let me know [question_one]? I would also like to know [question_two]. If you have any other tips, I would love to hear them. There is no rush, so just reply when you have a moment.', 'Câu hỏi lịch sự nhưng gần gũi, không gây áp lực.'),
 ],
}


def letter_model(s, kind, when, place, excuse, mistake, reason):
    meta=next(t for t in LETTER_TYPES if t['id']==kind)
    formal=meta['register']=='formal'
    purpose=meta['purpose']
    values={**s, 'recipient': 'Ms Brown', 'friend': 'Alex', 'sender': 'Minh', 'full_name': 'Minh Nguyen',
            'when':when, 'place':place, 'excuse':excuse, 'mistake':mistake, 'reason':reason,
            'alternative':'attend a later session or receive the materials' if formal else 'meet for lunch the following weekend',
            'repair':'arrive early at the next session and help prepare the materials',
            'help':'helping me organise the materials and check the programme',
            'result':s['activity']+' without rushing through the instructions',
            'return_favour':'help with the preparations for your next event' if formal else 'take you out for lunch next weekend',
            'problem_one':'there was almost no time for the advertised practical activity',
            'problem_two':'the session started forty minutes late without an explanation',
            'effect':'I could not complete the practical task or ask all my questions',
            'remedy':'offer a replacement practical session or a partial refund',
            'position':'part-time Community Activities Assistant',
            'experience':'welcoming participants and preparing materials for activities at my college',
            'skill':'explain simple instructions, organise tasks and respond politely to questions',
            'availability':'on weekday afternoons and at weekends',
            'question_one':f'whether the session is on {when}',
            'question_two':'how much it costs and whether beginners are welcome',
            'need':'I have limited experience and would prefer a practical introduction',
            }
    rows=list((FORMAL if formal else INFORMAL)[purpose])
    if formal:
        closing='Thank you for your time and consideration. Please let me know if you require any further information. I look forward to hearing from you.\n\nYours sincerely,\n[full_name]'
    else:
        closing='Thanks again for taking the time to read my email. Write back when you have a moment and let me know what you think. I hope to hear from you soon.\n\nBest wishes,\n[sender]'
    rows.append(('Kết thư',closing,'Biết tên người nhận: Dear Ms/Mr + họ → Yours sincerely. Chưa biết tên: Dear Sir or Madam → Yours faithfully.' if formal else 'Kết thân mật bằng Best wishes / All the best và tên riêng.'))
    contexts={
      'reply':f"{'You work at a local centre. Ms Brown has asked' if formal else 'Your friend Alex has asked'} for information about {s['event']}. Reply with details about the programme, the time and place, and what to bring.",
      'advice':f"{'Ms Brown has contacted you for professional advice' if formal else 'Your friend Alex has asked for advice'} about {s['focus']}. Suggest a practical first step, explain a possible difficulty and recommend a way to address it.",
      'invitation':f"{'As an event organiser, invite Ms Brown' if formal else 'Invite your friend Alex'} to {s['event']}. Explain the arrangements and benefits, give preparation advice and ask for confirmation.",
      'accept':f"{'Ms Brown, an event organiser, has invited you' if formal else 'Your friend Alex has invited you'} to {s['event']}. Accept the invitation, confirm the arrangements and ask about preparation while offering help.",
      'decline':f"{'Ms Brown has invited you in a professional capacity' if formal else 'Your friend Alex has invited you'} to {s['event']}, but you cannot attend. Apologise, give a reason and suggest a suitable alternative.",
      'thanks':f"{'Ms Brown, a colleague you do not know well,' if formal else 'Your friend Alex'} helped you prepare for {s['event']}. Thank the person, explain the effect of the help and offer to return the favour.",
      'apology':f"You let {'Ms Brown, the event coordinator,' if formal else 'your friend Alex'} down while preparing for {s['event']}. Apologise, explain what happened, and propose a specific way to put things right.",
      'request':f"Ask {'Ms Brown at a local centre' if formal else 'your friend Alex'} for information about {s['event']}. Explain your needs, ask about the time and cost, and find out whether it suits beginners.",
      'complaint':f"You paid to attend {s['event']}, but the activity did not match the notice. Write to Ms Brown, the centre manager, describing two problems, their effects, and the solution you want.",
      'application':f"A local centre is recruiting a paid part-time Community Activities Assistant to help deliver {s['event']}. Write to Ms Brown to apply. Explain your relevant experience and skills, your motivation and availability, and request an interview.",
    }
    requirements=[r[2] for r in rows[:3]]
    return contexts[purpose], requirements, [paragraph(*row,values) for row in rows]
