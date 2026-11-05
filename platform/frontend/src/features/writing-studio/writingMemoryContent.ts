/** Practice scaffolds, not an official or exhaustive classification of VSTEP prompts. */
export interface MemoryLine { id: string; part: string; vi: string; en: string; slot: string; example: string }
export interface MemoryDeck {
  id: string; task: 1 | 2; title: string; signal: string; map: string; note: string;
  frameId: string; lines: MemoryLine[];
}
type Line = [part: string, vi: string, en: string, slot: string, example: string];
const lines = (rows: Line[]): MemoryLine[] => rows.map(([part, vi, en, slot, example], i) => ({ id: `line-${i + 1}`, part, vi, en, slot, example }));
const letter = (id: string, title: string, signal: string, formal: boolean, body: Line[]): MemoryDeck => ({
  id, task: 1, title, signal, frameId: formal ? "formal-email" : "informal-email",
  map: "Chào → Mục đích → Trả lời đủ các ý → Mong phản hồi → Ký tên",
  note: formal ? "Mẫu này biết tên người nhận: Dear Ms Brown → Yours sincerely. Nếu không biết tên: Dear Sir or Madam → Yours faithfully. Với người quen trong công việc, vẫn giữ lời văn lịch sự và điều chỉnh cách chào theo quan hệ."
    : "Dùng với bạn bè/người thân. Từng ý trong đề cần có câu trả lời và chi tiết riêng; không ghép máy móc các câu khi đề không yêu cầu.",
  lines: lines([
    ["Mở thư", formal ? "Chào trang trọng (sau đó thêm chức danh và họ)." : "Chào bạn (sau đó thêm tên).", formal ? "Dear" : "Hi", formal ? "[Ms Brown]," : "[Tom],", formal ? "Dear Ms Brown," : "Hi Tom,"],
    ...body,
    ["Kết thư", formal ? "Tôi mong nhận được phản hồi." : "Mong sớm nhận được tin từ bạn.", formal ? "I look forward to hearing from you." : "I hope to hear from you soon.", "", formal ? "I look forward to hearing from you." : "I hope to hear from you soon."],
    ["Ký tên", formal ? "Trân trọng — biết tên người nhận." : "Gửi lời chúc tốt đẹp.", formal ? "Yours sincerely," : "Best wishes,", formal ? "[họ và tên]" : "[tên]", formal ? "Yours sincerely, Minh Nguyen" : "Best wishes, Minh"],
  ]),
});
const explain: Line = ["Triển khai", "Giải thích: Điều này là vì…", "This is because", "[mệnh đề: chủ ngữ + động từ].", "This is because students can review lessons at home."];
const example: Line = ["Triển khai", "Đưa ví dụ cụ thể: Ví dụ,…", "For example,", "[một tình huống cụ thể].", "For example, a student can watch a recorded lesson after work."];
const result: Line = ["Triển khai", "Nêu kết quả: Do đó,…", "As a result,", "[kết quả: chủ ngữ + động từ].", "As a result, more people can continue their education."];
const essay = (id: string, title: string, signal: string, frameId: string, map: string, note: string, rows: Line[]): MemoryDeck => ({ id, task: 2, title, signal, frameId, map, note, lines: lines(rows) });
const intro: Line = ["Mở bài", "Giới thiệu một quan điểm được nêu trong đề.", "It is often argued that", "[diễn đạt lại quan điểm trong đề].", "It is often argued that schools should teach life skills."];
const conclusion: Line = ["Kết bài", "Tóm lại — nhắc câu trả lời, không thêm ý mới.", "In conclusion,", "[tóm tắt câu trả lời và các ý chính].", "In conclusion, practical skills should be taught alongside academic subjects."];

export const MEMORY_DECKS: MemoryDeck[] = [
  letter("reply", "Trả lời / cung cấp thông tin", "A friend asks about… / Give information about…", false, [
    ["Mục đích", "Cảm ơn email của bạn.", "Thanks for your email.", "", "Thanks for your email."],
    ["Mục đích", "Mình viết để kể cho bạn về…", "I'm writing to tell you about", "[danh từ / chủ đề].", "I'm writing to tell you about my new school."],
    ["Ý thứ nhất", "Về câu hỏi của bạn về…", "As for your question about", "[chủ đề], [câu trả lời].", "As for your question about transport, you can take bus number five."],
    ["Ý tiếp theo", "Bạn cũng có thể…", "You could also", "[động từ nguyên mẫu].", "You could also visit the museum near my house."],
    ["Ý cuối", "Cho mình biết nếu bạn cần…", "Let me know if you need", "[danh từ / sự giúp đỡ].", "Let me know if you need more information."],
  ]),
  letter("advice", "Đưa lời khuyên / gợi ý", "Give advice / Recommend / Suggest…", false, [
    ["Mục đích", "Rất vui khi nhận được tin từ bạn.", "It's great to hear from you.", "", "It's great to hear from you."],
    ["Mục đích", "Mình viết để cho bạn vài lời khuyên về…", "I'm writing to give you some advice on", "[danh từ / V-ing].", "I'm writing to give you some advice on learning English."],
    ["Gợi ý 1", "Nếu là bạn, mình sẽ…", "If I were you, I would", "[động từ nguyên mẫu].", "If I were you, I would practise a little every day."],
    ["Giải thích", "Điều này sẽ giúp bạn…", "This would help you", "[động từ nguyên mẫu].", "This would help you remember new words."],
    ["Gợi ý 2", "Một ý hay khác là…", "Another good idea is to", "[động từ nguyên mẫu].", "Another good idea is to join a speaking club."],
  ]),
  letter("invitation", "Mời tham gia", "Invite your friend to…", false, [
    ["Mục đích", "Mình muốn mời bạn đến…", "I'd like to invite you to", "[sự kiện].", "I'd like to invite you to my birthday party."],
    ["Chi tiết", "Sự kiện sẽ diễn ra vào…", "It will take place on", "[ngày] at [giờ / nơi].", "It will take place on Saturday at my house."],
    ["Hoạt động", "Chúng ta sẽ…", "We are going to", "[động từ nguyên mẫu].", "We are going to have dinner and play some games."],
    ["Chuẩn bị", "Sẽ rất tuyệt nếu bạn có thể…", "It would be great if you could", "[động từ nguyên mẫu].", "It would be great if you could bring your guitar."],
    ["Xác nhận", "Cho mình biết bạn có đến được không.", "Please let me know if you can come.", "", "Please let me know if you can come."],
  ]),
  letter("accept", "Nhận lời mời / sắp xếp cuộc hẹn", "Accept the invitation / Arrange to meet…", false, [
    ["Mục đích", "Cảm ơn đã mời mình.", "Thank you for inviting me.", "", "Thank you for inviting me."],
    ["Nhận lời", "Mình rất muốn đến.", "I'd love to come.", "", "I'd love to come."],
    ["Sắp xếp", "Mình có thể đến vào…", "I can arrive at", "[giờ / địa điểm].", "I can arrive at six o'clock."],
    ["Hỏi thêm", "Bạn có thể cho mình biết…?", "Could you let me know", "[what / where / whether + chủ ngữ + động từ]?", "Could you let me know what I should bring?"],
    ["Đề nghị", "Mình rất sẵn lòng giúp…", "I'd be happy to help with", "[danh từ / V-ing].", "I'd be happy to help with preparing the food."],
  ]),
  letter("decline", "Từ chối lời mời", "You cannot attend / Decline and suggest…", false, [
    ["Mục đích", "Cảm ơn đã mời mình.", "Thank you for inviting me.", "", "Thank you for inviting me."],
    ["Từ chối", "Mình rất tiếc là không thể đến.", "I'm sorry, but I won't be able to come.", "", "I'm sorry, but I won't be able to come."],
    ["Lý do", "Tiếc là mình phải…", "Unfortunately, I have to", "[động từ nguyên mẫu + lý do cụ thể].", "Unfortunately, I have to visit my grandparents that day."],
    ["Hẹn khác", "Thay vào đó, mình gặp vào… được không?", "Could we meet on", "[ngày] instead?", "Could we meet on Sunday instead?"],
    ["Thiện chí", "Mình hy vọng bạn sẽ có khoảng thời gian thật vui.", "I hope you have a wonderful time.", "", "I hope you have a wonderful time."],
  ]),
  letter("thanks", "Cảm ơn", "Thank someone for their help / hospitality…", false, [
    ["Mục đích", "Mình viết để cảm ơn bạn vì…", "I'm writing to thank you for", "[danh từ / V-ing].", "I'm writing to thank you for helping me move."],
    ["Chi tiết", "Mình thực sự trân trọng…", "I really appreciate", "[danh từ / sự giúp đỡ].", "I really appreciate your time and effort."],
    ["Tác động", "Nhờ sự giúp đỡ của bạn, mình đã có thể…", "Thanks to your help, I was able to", "[động từ nguyên mẫu].", "Thanks to your help, I was able to finish everything on time."],
    ["Đáp lại", "Mình muốn mời bạn…", "I'd like to invite you to", "[bữa ăn / sự kiện].", "I'd like to invite you to dinner this weekend."],
    ["Kết ý", "Một lần nữa, cảm ơn vì mọi điều.", "Thank you again for everything.", "", "Thank you again for everything."],
  ]),
  letter("apology", "Xin lỗi và khắc phục", "Apologise / Explain what happened / Offer a solution…", false, [
    ["Mục đích", "Mình viết để xin lỗi vì…", "I'm writing to apologise for", "[danh từ / V-ing].", "I'm writing to apologise for missing our meeting."],
    ["Giải thích", "Lý do là…", "The reason was that", "[chủ ngữ + động từ].", "The reason was that my train was cancelled."],
    ["Nhận trách nhiệm", "Mình hiểu điều này đã gây bất tiện cho bạn.", "I understand that this caused you inconvenience.", "", "I understand that this caused you inconvenience."],
    ["Khắc phục", "Để bù lại, mình muốn…", "To make up for this, I'd like to", "[động từ nguyên mẫu].", "To make up for this, I'd like to help you this weekend."],
    ["Kết ý", "Mình hy vọng bạn có thể thông cảm.", "I hope you can understand.", "", "I hope you can understand."],
  ]),
  letter("request", "Hỏi thông tin / yêu cầu lịch sự", "Enquire about / Request information or assistance…", true, [
    ["Mục đích", "Tôi viết để hỏi thông tin về…", "I am writing to enquire about", "[khóa học / dịch vụ].", "I am writing to enquire about your evening English course."],
    ["Bối cảnh", "Tôi quan tâm đến…", "I am interested in", "[danh từ / V-ing].", "I am interested in improving my speaking skills."],
    ["Câu hỏi 1", "Tôi muốn biết…", "I would like to know", "[when / whether / how + chủ ngữ + động từ].", "I would like to know when the course starts."],
    ["Câu hỏi 2", "Ông/bà cũng có thể cho tôi biết…?", "Could you also tell me", "[what / whether + chủ ngữ + động từ]?", "Could you also tell me whether materials are included?"],
    ["Yêu cầu", "Tôi rất cảm kích nếu ông/bà có thể…", "I would be grateful if you could", "[động từ nguyên mẫu].", "I would be grateful if you could send me the registration form."],
  ]),
  letter("complaint", "Phàn nàn / yêu cầu giải quyết", "Complain about / Describe problems / Request action…", true, [
    ["Mục đích", "Tôi viết để phàn nàn về…", "I am writing to complain about", "[sản phẩm / dịch vụ].", "I am writing to complain about the service at your hotel."],
    ["Vấn đề 1", "Trước hết,…", "First of all,", "[mô tả vấn đề cụ thể].", "First of all, the air conditioner in my room did not work."],
    ["Vấn đề 2", "Ngoài ra,…", "In addition,", "[vấn đề tiếp theo].", "In addition, the room had not been cleaned properly."],
    ["Ảnh hưởng", "Do đó,…", "As a result,", "[ảnh hưởng đối với bạn].", "As a result, I could not sleep well."],
    ["Giải quyết", "Tôi mong ông/bà…", "I would like you to", "[động từ nguyên mẫu: hành động hợp lý].", "I would like you to refund part of the cost."],
  ]),
  letter("application", "Ứng tuyển / đăng ký", "Apply for a job / course / volunteer position…", true, [
    ["Mục đích", "Tôi viết để ứng tuyển vào…", "I am writing to apply for", "[vị trí / chương trình].", "I am writing to apply for the part-time library assistant position."],
    ["Động lực", "Tôi đặc biệt quan tâm đến…", "I am particularly interested in", "[danh từ / V-ing + lý do].", "I am particularly interested in helping people find useful information."],
    ["Kinh nghiệm", "Tôi có kinh nghiệm trong việc…", "I have experience in", "[danh từ / V-ing].", "I have experience in organising school events."],
    ["Sự phù hợp", "Tôi tin rằng các kỹ năng của mình sẽ giúp tôi…", "I believe my skills would enable me to", "[động từ nguyên mẫu].", "I believe my skills would enable me to support visitors effectively."],
    ["Bước tiếp", "Tôi sẵn sàng tham gia phỏng vấn vào…", "I am available for an interview", "[thời gian phù hợp].", "I am available for an interview on weekday afternoons."],
  ]),
  ...(["agree", "disagree", "partial"] as const).map((stance) => essay(`opinion-${stance}`,
    stance === "agree" ? "Quan điểm — đồng ý" : stance === "disagree" ? "Quan điểm — phản đối" : "Quan điểm — đồng ý một phần",
    "Do you agree or disagree? / To what extent do you agree?", "opinion", "Vấn đề + lập trường → Lý do 1 → Lý do 2 / giới hạn → Chốt lập trường",
    stance === "partial" ? "Nêu rõ bạn đồng ý phần nào, không đồng ý phần nào; cả hai thân bài phải giải thích đúng giới hạn đó." : "Giữ lập trường nhất quán. Diễn đạt lại đề; mỗi lý do cần giải thích và ví dụ phù hợp.", [
      intro,
      ["Lập trường", stance === "agree" ? "Tôi đồng ý với quan điểm này vì hai lý do chính." : stance === "disagree" ? "Tôi không đồng ý với quan điểm này vì hai lý do chính." : "Mặc dù đồng ý rằng…, tôi cho rằng…", stance === "agree" ? "I agree with this view for two main reasons." : stance === "disagree" ? "I disagree with this view for two main reasons." : "Although I agree that", stance === "partial" ? "[phần đồng ý], I believe that [giới hạn / phần không đồng ý]." : "", stance === "partial" ? "Although I agree that online lessons are useful, I believe that they should not replace all classroom teaching." : stance === "agree" ? "I agree with this view for two main reasons." : "I disagree with this view for two main reasons."],
      ["Thân bài 1", "Một lý do quan trọng là…", "One important reason is that", "[lý do thứ nhất].", "One important reason is that practical skills help students become independent."], explain, example,
      ["Thân bài 2", stance === "partial" ? "Tuy nhiên, điều quan trọng là…" : "Một lý do khác là…", stance === "partial" ? "However, it is important to" : "Another reason is that", stance === "partial" ? "[động từ nguyên mẫu]." : "[lý do thứ hai].", stance === "partial" ? "However, it is important to keep classroom discussions." : "Another reason is that these skills prepare students for work."], result, conclusion,
      ["Chốt ý", "Tôi tin rằng…", "I believe that", "[nhắc lại chính xác lập trường của bạn].", "I believe that schools should teach both practical and academic subjects."],
    ])),
  essay("discussion", "Bàn hai quan điểm", "Discuss both views and give your opinion.", "discussion", "Hai phía + ý kiến → Phía 1 → Phía 2 → Cân nhắc và chốt", "Phải bàn cả hai phía. Nếu đề hỏi ý kiến, thể hiện ý kiến ở mở bài và kết bài; không chỉ liệt kê hai phía.", [
    ["Mở bài", "Một số người cho rằng…", "Some people believe that", "[quan điểm 1], while others argue that [quan điểm 2].", "Some people believe that city life is better, while others argue that the countryside is more suitable."],
    ["Mở bài", "Trong khi những người khác cho rằng…", "while others argue that", "[quan điểm thứ hai; nối với câu vừa học].", "Some people believe that city life is better, while others argue that the countryside is more suitable."],
    ["Lập trường", "Theo quan điểm của tôi,…", "In my opinion,", "[lựa chọn + lý do ngắn].", "In my opinion, the best choice depends on a person's needs."],
    ["Thân bài 1", "Một mặt,…", "On the one hand,", "[giải thích phía thứ nhất].", "On the one hand, cities offer more job opportunities."], explain, example,
    ["Thân bài 2", "Mặt khác,…", "On the other hand,", "[giải thích phía còn lại].", "On the other hand, the countryside provides more open space."], result, conclusion,
  ]),
  essay("advantages", "Lợi ích và bất lợi", "What are the advantages and disadvantages?", "advantages", "Giới thiệu → Lợi ích + giải thích → Bất lợi + giải thích → Tổng hợp", "Bàn cả hai phía. Chỉ thêm lập trường đánh giá khi câu hỏi yêu cầu hoặc khi nó giúp trả lời đề.", [
    ["Mở bài", "… có cả lợi ích lẫn bất lợi.", "There are both advantages and disadvantages to", "[danh từ / V-ing].", "There are both advantages and disadvantages to working from home."],
    ["Thân bài 1", "Một lợi ích chính là…", "One major advantage is that", "[lợi ích].", "One major advantage is that workers save commuting time."], explain, example,
    ["Thân bài 2", "Một bất lợi đáng kể là…", "One significant disadvantage is that", "[bất lợi].", "One significant disadvantage is that workers may feel isolated."], result, conclusion,
  ]),
  essay("outweigh", "Lợi ích có lớn hơn bất lợi?", "Do the advantages outweigh the disadvantages?", "advantages", "Phán đoán → Phía nhẹ hơn → Phía nặng hơn + so sánh → Chốt", "Phải so sánh mức độ quan trọng hoặc tác động, không chỉ đếm số ý. Mẫu luyện chọn lợi ích lớn hơn; có thể đảo hai phía theo lập trường của bạn.", [
    ["Mở bài", "Mặc dù có một số bất lợi,…", "Although there are some drawbacks,", "[nêu phán đoán của bạn].", "Although there are some drawbacks, I believe that the benefits are more significant."],
    ["Lập trường", "Tôi tin lợi ích lớn hơn bất lợi.", "I believe the advantages outweigh the disadvantages.", "", "I believe the advantages outweigh the disadvantages."],
    ["Thân bài 1", "Một bất lợi đáng kể là…", "One significant disadvantage is that", "[bất lợi cần thừa nhận].", "One significant disadvantage is that online study can reduce social contact."], example,
    ["Thân bài 2", "Tuy nhiên, một lợi ích quan trọng hơn là…", "However, a more important benefit is that", "[lợi ích + giải thích].", "However, a more important benefit is that online courses make education accessible to remote communities."],
    ["So sánh", "Lợi ích này có tác động lớn hơn vì…", "This benefit has a greater impact because", "[lý do so sánh].", "This benefit has a greater impact because it gives people opportunities they would otherwise lack."], conclusion,
  ]),
  essay("cause-solution", "Nguyên nhân và giải pháp", "What are the causes? What measures / solutions…?", "cause-solution", "Vấn đề → Vì sao xảy ra → Ai làm gì để xử lý → Tổng hợp", "Phân biệt nguyên nhân với tác hại. Mỗi giải pháp phải xử lý được nguyên nhân đã giải thích.", [
    ["Mở bài", "Bài luận này sẽ xem xét nguyên nhân và đề xuất giải pháp.", "This essay will examine the causes and suggest solutions.", "", "This essay will examine the causes and suggest solutions."],
    ["Thân bài 1", "Một nguyên nhân chính là…", "One major cause is that", "[nguyên nhân].", "One major cause is that public transport is unreliable."], explain, example,
    ["Thân bài 2", "Để giải quyết vấn đề này,…", "To address this problem,", "[ai] should [làm gì].", "To address this problem, local authorities should improve bus services."],
    ["Cơ chế", "Điều này sẽ…", "This would", "[động từ nguyên mẫu + tác dụng].", "This would give commuters a practical alternative to driving."],
    ["Giải pháp khác", "Ngoài ra,…", "In addition,", "[ai + hành động liên quan].", "In addition, employers could offer flexible starting times."], conclusion,
  ]),
  essay("problem-solution", "Vấn đề / tác hại và giải pháp", "What problems does this cause? How can they be solved?", "cause-solution", "Hiện tượng → Vấn đề nó gây ra → Giải pháp tương ứng → Chốt", "Đề hỏi problems: phân tích tác hại, không thay bằng nguyên nhân. Giải pháp phải gắn với tác hại vừa nêu.", [
    ["Mở bài", "Hiện tượng này có thể gây ra một số vấn đề.", "This trend can create several problems.", "", "This trend can create several problems."],
    ["Thân bài 1", "Một vấn đề nghiêm trọng là…", "One serious problem is that", "[tác hại].", "One serious problem is that excessive screen time can disrupt sleep."], explain, result,
    ["Thân bài 2", "Một giải pháp khả thi là…", "One possible solution is to", "[động từ nguyên mẫu + hành động].", "One possible solution is to set limits on phone use before bedtime."],
    ["Cơ chế", "Điều này sẽ giúp…", "This would help to", "[động từ nguyên mẫu].", "This would help to protect time for rest."], example, conclusion,
  ]),
  essay("cause-effect", "Nguyên nhân và hệ quả", "Why does this happen? What are the effects?", "cause-solution", "Hiện tượng → Nguyên nhân → Hệ quả → Tổng hợp", "Thân bài 2 nói về hệ quả, không tự chuyển sang giải pháp. Nếu đề yêu cầu cả ba, thêm phần giải pháp tương ứng.", [
    ["Mở bài", "Hiện tượng này có nhiều nguyên nhân và hệ quả.", "This trend has several causes and consequences.", "", "This trend has several causes and consequences."],
    ["Thân bài 1", "Một nguyên nhân chính là…", "One major cause is that", "[nguyên nhân].", "One major cause is that housing costs are rising."], explain, example,
    ["Thân bài 2", "Một hệ quả quan trọng là…", "One important consequence is that", "[hệ quả].", "One important consequence is that young adults may delay living independently."], result, conclusion,
  ]),
  essay("two-questions", "Hai câu hỏi / đề kết hợp", "Why…? Is this positive or negative? / Two direct questions", "opinion", "Giới thiệu + trả lời ngắn → Câu hỏi 1 → Câu hỏi 2 → Chốt cả hai", "Đọc nguyên văn hai câu hỏi và trả lời đúng từng câu. Với positive/negative, phải đánh giá và giải thích. Đây là khung linh hoạt cho đề kết hợp.", [
    ["Mở bài", "Tôi cho rằng xu hướng này…", "I believe this trend", "[has… / is… + câu trả lời ngắn cho đề].", "I believe this trend is mainly positive because it creates more learning opportunities."],
    ["Thân bài 1", "Một lý do chính là…", "One main reason is that", "[trả lời câu hỏi vì sao].", "One main reason is that digital tools are more affordable."], explain, example,
    ["Thân bài 2", "Về câu hỏi thứ hai,…", "Regarding the second question,", "[trả lời trực tiếp câu hỏi 2].", "Regarding the second question, this development is mostly beneficial for learners."],
    ["Đánh giá", "Điều này có lợi vì…", "This is beneficial because", "[lý do; đổi beneficial thành harmful nếu đánh giá tiêu cực].", "This is beneficial because people can study wherever they live."], result, conclusion,
  ]),
];

export interface VocabularyPack { id: string; title: string; task: 1 | 2; items: MemoryLine[] }
const vocab = (id: string, title: string, task: 1 | 2, rows: [string, string, string][]): VocabularyPack => ({
  id, title, task, items: rows.map(([vi, en, example], i) => ({ id: `${id}-${i}`, part: title, vi, en, slot: "", example })),
});
export const WRITING_VOCAB: VocabularyPack[] = [
  vocab("letters", "Thư: hẹn gặp, giúp đỡ, cảm ơn", 1, [
    ["sắp xếp một cuộc gặp", "arrange a meeting", "Could we arrange a meeting next week?"], ["tham gia một sự kiện", "attend an event", "I'm sorry that I cannot attend the event."],
    ["đưa ra lời khuyên hữu ích", "give useful advice", "Thank you for giving me useful advice."], ["giúp một tay", "lend a hand", "I'd be happy to lend a hand with the preparations."],
    ["thay đổi kế hoạch", "change the arrangements", "Could we change the arrangements for Saturday?"], ["bù đắp cho điều gì", "make up for", "I'd like to make up for missing your birthday."],
  ]),
  vocab("services", "Thư: khóa học, dịch vụ, khiếu nại", 1, [
    ["học phí khóa học", "course fees", "Could you tell me whether course fees include materials?"], ["điền mẫu đăng ký", "complete the registration form", "I would like to complete the registration form."],
    ["yêu cầu hoàn tiền", "request a refund", "I am writing to request a refund."], ["giải quyết vấn đề", "resolve the issue", "I would be grateful if you could resolve the issue."],
    ["gây bất tiện", "cause inconvenience", "The cancelled classes caused inconvenience to several students."], ["đáp ứng kỳ vọng", "meet expectations", "Unfortunately, the service did not meet my expectations."],
  ]),
  vocab("application", "Thư: ứng tuyển và kinh nghiệm", 1, [
    ["ứng tuyển vào một vị trí", "apply for a position", "I am writing to apply for the advertised position."], ["kinh nghiệm liên quan", "relevant experience", "I have relevant experience in customer service."],
    ["kỹ năng giao tiếp", "communication skills", "This role helped me develop my communication skills."], ["làm việc trong nhóm", "work as part of a team", "I can work as part of a team."],
    ["sẵn sàng tham gia phỏng vấn", "available for an interview", "I am available for an interview next week."], ["nhận trách nhiệm", "take responsibility", "I am willing to take responsibility for daily tasks."],
  ]),
  vocab("education", "Luận: giáo dục", 2, [
    ["tiếp cận giáo dục", "access to education", "Online courses can improve access to education."], ["phát triển kỹ năng thực tế", "develop practical skills", "Students should develop practical skills at school."],
    ["cải thiện kết quả học tập", "improve academic performance", "Regular feedback can improve academic performance."], ["học theo tốc độ riêng", "learn at their own pace", "Recorded lessons allow students to learn at their own pace."],
    ["tư duy phản biện", "critical thinking", "Classroom discussions can encourage critical thinking."], ["cơ hội học tập bình đẳng", "equal learning opportunities", "Public libraries can provide equal learning opportunities."],
  ]),
  vocab("technology", "Luận: công nghệ và truyền thông", 2, [
    ["giữ liên lạc", "stay in touch", "Social media helps families stay in touch."], ["bảo vệ dữ liệu cá nhân", "protect personal data", "Users should learn how to protect personal data."],
    ["giảm tương tác trực tiếp", "reduce face-to-face interaction", "Excessive phone use may reduce face-to-face interaction."], ["tiếp cận thông tin đáng tin cậy", "access reliable information", "Digital skills help people access reliable information."],
    ["dành quá nhiều thời gian trên mạng", "spend too much time online", "Some teenagers spend too much time online."], ["sử dụng công nghệ có trách nhiệm", "use technology responsibly", "Schools should teach children to use technology responsibly."],
  ]),
  vocab("environment", "Luận: môi trường", 2, [
    ["giảm ô nhiễm không khí", "reduce air pollution", "Cleaner buses can reduce air pollution."], ["bảo vệ tài nguyên thiên nhiên", "protect natural resources", "Recycling helps protect natural resources."],
    ["nâng cao nhận thức cộng đồng", "raise public awareness", "Local campaigns can raise public awareness of food waste."], ["nguồn năng lượng tái tạo", "renewable energy sources", "Governments should invest in renewable energy sources."],
    ["giảm rác thải sinh hoạt", "reduce household waste", "Planning meals can reduce household waste."], ["gây hại cho môi trường", "damage the environment", "Single-use products can damage the environment."],
  ]),
  vocab("work", "Luận: công việc và tiền bạc", 2, [
    ["cơ hội việc làm", "job opportunities", "Cities often provide a wide range of job opportunities."], ["cân bằng công việc và cuộc sống", "work-life balance", "Flexible hours can improve work-life balance."],
    ["đáp ứng nhu cầu cơ bản", "meet basic needs", "A stable income helps families meet basic needs."], ["áp lực tài chính", "financial pressure", "High housing costs can create financial pressure."],
    ["sự hài lòng trong công việc", "job satisfaction", "Supportive colleagues can increase job satisfaction."], ["tiết kiệm thời gian đi làm", "save commuting time", "Working from home can save commuting time."],
  ]),
  vocab("health", "Luận: sức khỏe và lối sống", 2, [
    ["duy trì lối sống lành mạnh", "maintain a healthy lifestyle", "Regular exercise helps people maintain a healthy lifestyle."], ["giảm căng thẳng", "reduce stress", "Walking outdoors can reduce stress."],
    ["chế độ ăn cân bằng", "a balanced diet", "Children need a balanced diet to grow well."], ["hoạt động thể chất thường xuyên", "regular physical activity", "Regular physical activity can improve sleep."],
    ["sức khỏe tinh thần", "mental well-being", "Strong social connections support mental well-being."], ["ngăn ngừa vấn đề sức khỏe", "prevent health problems", "Early advice may help prevent health problems."],
  ]),
  vocab("transport", "Luận: giao thông và đô thị", 2, [
    ["giảm ùn tắc giao thông", "reduce traffic congestion", "Reliable buses can help reduce traffic congestion."], ["cải thiện giao thông công cộng", "improve public transport", "Cities should improve public transport before restricting cars."],
    ["phụ thuộc vào phương tiện cá nhân", "depend on private vehicles", "People may depend on private vehicles when buses are infrequent."], ["nhà ở giá phải chăng", "affordable housing", "Young workers need access to affordable housing."],
    ["cải thiện chất lượng cuộc sống", "improve quality of life", "Safe public spaces can improve quality of life."], ["không gian xanh công cộng", "public green spaces", "Public green spaces give residents places to exercise."],
  ]),
  vocab("community", "Luận: gia đình, du lịch, cộng đồng", 2, [
    ["tăng cường quan hệ gia đình", "strengthen family relationships", "Shared activities can strengthen family relationships."], ["hỗ trợ doanh nghiệp địa phương", "support local businesses", "Visitors can support local businesses by buying local products."],
    ["bảo tồn văn hóa địa phương", "preserve local culture", "Community events can help preserve local culture."], ["ý thức trách nhiệm", "a sense of responsibility", "Volunteering can develop a sense of responsibility."],
    ["tôn trọng khác biệt văn hóa", "respect cultural differences", "Travel can teach people to respect cultural differences."], ["đóng góp cho cộng đồng", "contribute to the community", "Young people can contribute to the community through voluntary work."],
  ]),
];
