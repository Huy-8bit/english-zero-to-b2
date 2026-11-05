import { extendWritingDecks, fillFrame, countFixedFrameWords, type ExtendedDeck } from "./extendedWritingFrames";
import { MEMORY_DECKS, type MemoryDeck } from "./writingMemoryContent";

export const FRAME_REVISION = "word-budget-v1";
export const FRAME_BUDGETS = { 1: [70, 80], 2: [150, 170] } as const;
type Row = [part: string, vi: string, en: string];
const legacy = extendWritingDecks(MEMORY_DECKS);
const r = (part: string, vi: string, en: string): Row => [part, vi, en];
const LETTER_BODY: Record<string, Row[]> = {
  reply: [
    r("Mục đích", "Cảm ơn và nêu điều người nhận hỏi.", "Thank you for your email about [topic]. I am happy to give you the information you need."),
    r("Trả lời", "Trả lời lần lượt; thêm câu nếu đề có nhiều ý.", "First of all, [point one]. As for [second point], I would suggest [suggestion] because [reason]. Finally, [final detail]. I hope these details will help you plan your next steps."),
  ],
  advice: [
    r("Mục đích", "Nêu vấn đề cần tư vấn.", "I am writing to offer some advice on [topic]. I hope these suggestions will be useful to you."),
    r("Lời khuyên", "Hai hành động và lý do; chủ động đề nghị giúp.", "You could start by [first action]. This would help you [benefit]. Another good idea is to [second action] because [reason]. If needed, I could [offer]."),
  ],
  invitation: [
    r("Mục đích", "Mời tham gia và bày tỏ mong muốn gặp.", "I would like to invite you to [event]. I would be very pleased if you could join us."),
    r("Chi tiết", "Ngày, nơi, giờ, hoạt động và chuẩn bị.", "It will take place on [day] at [place], starting at [time]. We plan to [activity]. Please [preparation]. Could you confirm whether you can attend?"),
  ],
  accept: [
    r("Nhận lời", "Cảm ơn và nhận lời rõ ràng.", "Thank you for inviting me to [event]. I would be happy to attend and look forward to seeing you."),
    r("Sắp xếp", "Giờ đến, cách đi và đề nghị giúp chuẩn bị.", "I can arrive at [time], and I plan to [travel plan]. Please let me know where to meet. I could also [offer] to help with the preparations."),
  ],
  decline: [
    r("Từ chối", "Cảm ơn, từ chối lịch sự và nêu lý do.", "Thank you for inviting me to [event]. Unfortunately, I will not be able to attend because I have to [reason]."),
    r("Hẹn khác", "Xin lỗi và đưa thời gian, hoạt động thay thế.", "I am sorry to miss it. Could we meet on [another day] instead? We could [alternative activity] if that suits you. I hope you have a wonderful time."),
  ],
  thanks: [
    r("Cảm ơn", "Cảm ơn về sự giúp đỡ cụ thể.", "I am writing to thank you for [help]. I really appreciate the time and effort you put into [specific action]."),
    r("Tác dụng và đáp lại", "Nêu kết quả, cảm xúc và cách cảm ơn.", "Thanks to your help, I was able to [result]. This meant a great deal to me. I would like to [return favour] as a small thank you."),
  ],
  apology: [
    r("Xin lỗi", "Xin lỗi, giải thích ngắn và nhận trách nhiệm.", "I am writing to apologise for [mistake]. The reason was that [reason]. I understand that this [effect], and I take responsibility for it."),
    r("Khắc phục", "Nêu cách sửa lỗi và tránh lặp lại.", "To make up for this, I would like to [solution]. Next time, I will [prevention]. I am very sorry for the inconvenience."),
  ],
  request: [
    r("Mục đích", "Hỏi thông tin, giải thích nhu cầu.", "I am writing to ask for information about [service]. I am interested in this because [need]."),
    r("Câu hỏi", "Dùng câu hỏi gián tiếp đúng trật tự chủ ngữ–động từ.", "Could you please tell me [question one]? I would also like to know [question two]. Finally, please explain how to [next step]. These details would help me make the necessary arrangements."),
  ],
  complaint: [
    r("Phàn nàn", "Nêu đối tượng, hai vấn đề và ảnh hưởng.", "I am writing to complain about [service]. First, [problem one]. In addition, [problem two], although I had been told that [promise]. As a result, [effect]."),
    r("Giải quyết", "Yêu cầu cách xử lý và phản hồi.", "I would like you to [solution]. Please confirm how you will resolve this matter. I hope we can reach a fair solution."),
  ],
  application: [
    r("Ứng tuyển", "Nêu vị trí và động lực.", "I am writing to apply for [position]. I am interested in this role because [motivation]."),
    r("Năng lực", "Kinh nghiệm có dẫn chứng, lịch làm và phỏng vấn.", "I have experience in [experience], which taught me to [skill]. I am willing to learn and work carefully. I can work [working hours] and attend an interview [availability]."),
  ],
};
const informalOpen = r("Mở thư", "Chào người bạn; hỏi thăm ngắn.", "Hi [name],\nI hope you are doing well. It is good to be in touch.");
const informalClose = r("Kết thư", "Nhờ phản hồi và ký tên thân mật.", "Please write back when you have time and let me know what you think. I hope to hear from you soon.\nBest wishes,\n[your name]");
const formalOpen = r("Mở thư", "Biết tên: Dear + danh xưng và họ.", "Dear [title and surname],\nI hope that this message finds you well.");
const formalClose = r("Kết thư", "Cảm ơn, đề nghị liên hệ thêm và mong hồi âm.", "Thank you very much for your time and attention. Please let me know if you need any further information. I look forward to hearing from you.\nYours sincerely,\n[full name]");

// Every slot is part of a sentence that performs a task: explanation, example or comparison.
// The ten essay frames deliberately do not share one generic argument.
const ESSAY_ROWS: Record<string, Row[]> = {
  "opinion-agree": [
    r("Mở bài", "Diễn đạt lại nhận định và đồng ý rõ ràng.", "Some people believe that [view]. I agree with this opinion for two main reasons. In considering this issue, it is useful to look at how it affects people in everyday situations."),
    r("Lý do 1", "Lý do → giải thích → ví dụ → kết quả.", "The first reason is that [reason one]. This is important because [explanation one]. For example, [example one]. In this situation, [result one]. The example shows how this idea can make a practical difference to the people involved."),
    r("Lý do 2", "Nêu lý do khác, không lặp lại đoạn trên.", "Another reason is that [reason two]. In other words, [explanation two]. A good example of this is [example two]. This means that [result two]. This second point supports my view from a different angle and helps explain why the idea deserves support."),
    r("Kết bài", "Nhắc lại lập trường và hai lý do, không thêm ý mới.", "In conclusion, I believe that [position]. The main reasons are [summary one] and [summary two]. Taken together, these points explain why I agree with the statement. These are the practical considerations that matter most in forming my opinion."),
  ],
  "opinion-disagree": [
    r("Mở bài", "Diễn đạt lại nhận định và phản đối rõ ràng.", "Some people believe that [view]. I disagree with this opinion for two main reasons. To explain my position, I will consider the difficulties this approach could create for the people affected."),
    r("Lý do 1", "Nêu vấn đề của quan điểm bị phản đối.", "The first reason is that [reason one]. This is important because [explanation one]. For example, [example one]. In this situation, [result one]. This illustrates a practical difficulty that should be taken into account when judging whether the proposal is suitable."),
    r("Lý do 2", "Lý do phản đối thứ hai có giải thích và ví dụ.", "Another reason is that [reason two]. In other words, [explanation two]. A good example of this is [example two]. This means that [result two]. This is particularly important for [affected group], who [group situation]. Their circumstances should be considered before a decision is made about whether the proposal should be adopted."),
    r("Kết bài", "Chốt phản đối đúng nhận định trong đề.", "In conclusion, I believe that [position]. The main reasons are [summary one] and [summary two]. These points explain why I disagree with the statement. The approach should be judged against the needs and circumstances described above."),
  ],
  "opinion-partial": [
    r("Mở bài", "Đồng ý có giới hạn; nêu đúng phạm vi.", "Some people believe that [view]. I agree with this view to some extent, but I do not think it is suitable in every situation. Both the benefits and the limits need to be considered."),
    r("Phần đồng ý", "Giải thích mặt ủng hộ, có ví dụ.", "On the one hand, one important benefit is that [reason one]. This matters because [explanation one]. For example, [example one]. In this case, [result one]. This gives a clear reason to support the idea when the relevant conditions are in place."),
    r("Phần giới hạn", "Nêu khi nào cần cách khác và vì sao.", "On the other hand, we should not ignore the need to [limit]. This is especially important when [condition]. For example, [limit example]. In such a situation, applying the same approach without any changes may be less useful. This is why my support for the idea is not unconditional."),
    r("Kết bài", "Chốt mức độ đồng ý nhất quán.", "In conclusion, I believe that [position]. The main considerations are [summary one] and [summary two]. The idea has value, but its use should depend on the circumstances. A suitable decision needs to take both sides of this argument into account."),
  ],
  discussion: [
    r("Mở bài", "Hai quan điểm và ý kiến riêng.", "Some people believe that [view one], while others think that [view two]. There are reasons for both opinions, and each focuses on a different concern. In my opinion, [position]."),
    r("Quan điểm 1", "Giải thích vì sao người ta ủng hộ phía một.", "On the one hand, supporters of the first view argue that [reason one]. This is understandable because [explanation one]. For example, [example one]. In this case, [result one]. This helps explain why some people consider the first view more suitable for their needs."),
    r("Quan điểm 2", "Giải thích công bằng phía còn lại.", "On the other hand, supporters of the second view point out that [reason two]. This is a reasonable concern, especially when [condition]. A good example is [example two]. This shows that [result two]. In practical terms, the second view therefore deserves attention as well, even if it gives priority to a different need."),
    r("Kết bài", "Tổng hợp hai phía và chốt ý kiến có lý do.", "In conclusion, the first view emphasises [priority one], while the second focuses on [priority two]. Having considered both sides, I believe that [position], because [final reason]. This judgement takes account of the main concerns discussed in the two views."),
  ],
  advantages: [
    r("Mở bài", "Giới thiệu hai mặt, không ép thành đề đồng ý/phản đối.", "There are both advantages and disadvantages to [topic]. To understand this issue, we need to consider its effects on the people involved. Looking at both sides gives a clearer picture than focusing on only one."),
    r("Lợi ích", "Lợi ích → cơ chế → ví dụ → kết quả.", "One important advantage is that [benefit]. This can help people [useful action], especially when [situation]. For example, [example one]. In this case, [result one]. This illustrates how the advantage can be useful in practice, rather than simply being an attractive idea."),
    r("Bất lợi", "Bất lợi và nhóm bị tác động, có ví dụ.", "On the other hand, one disadvantage is that [drawback]. This can create difficulties for [people], because [difficulty]. A good example is [example two]. This shows that [result two]. The difficulty needs to be considered alongside the benefit, since both can affect the same decision."),
    r("Kết bài", "Tổng hợp đúng hai mặt, không thêm giải pháp bắt buộc.", "In conclusion, [topic] offers benefits such as [summary one], but it also brings difficulties such as [summary two]. Both sides are important. Whether it is suitable in a particular case depends on the needs of those involved and the circumstances in which it is used."),
  ],
  outweigh: [
    r("Mở bài", "Nêu lợi lớn hơn hại; phải đổi nếu bạn chọn chiều ngược lại.", "Although there are disadvantages to [topic], I believe that the advantages are more important overall. The main reason is that [stronger reason]. The two sides should be compared by their practical importance, not simply by counting them."),
    r("Thừa nhận hại", "Phân tích bất lợi thật sự, có ví dụ.", "It is true that [drawback]. This can create difficulties for [people], because [difficulty]. A good example is [example two]. This shows that [result two]. This concern should be taken seriously, even though I do not believe it is the strongest consideration."),
    r("Lợi và so sánh", "Lợi ích, ví dụ và lý do có sức nặng hơn.", "However, an important advantage is that [benefit]. This can help people [useful action], especially when [situation]. For example, [example one]. In this case, [result one]. I give more weight to this benefit because [stronger reason]. In comparison, [comparison]. This explains the difference in importance between the two sides."),
    r("Kết bài", "Nhắc rõ phán đoán bên nào lớn hơn.", "In conclusion, while [summary two] is a real concern, the benefit of [summary one] is more important in this case. For the reasons discussed above, I believe the advantages outweigh the disadvantages."),
  ],
  "cause-solution": [
    r("Mở bài", "Nêu vấn đề và hai việc phải làm: giải thích, giải quyết.", "The problem of [topic] has attracted attention because of its effects on everyday life. To deal with it effectively, we need to understand why it happens and consider actions that address the reasons behind it."),
    r("Nguyên nhân", "Nguyên nhân → cơ chế → tình huống → hệ quả.", "One important cause is that [cause]. When this happens, people tend to [behaviour]. For example, [example one]. As a result, [result one]. This helps explain how the problem develops and why it may continue if the underlying conditions remain unchanged."),
    r("Giải pháp", "Ai làm gì, tác dụng thế nào, điều kiện thực hiện.", "A practical response would be for [actor] to [action]. This would help by [mechanism]. For instance, [practical example]. For this approach to work well, it is important to [condition]. The action is useful because it addresses the cause described above, rather than only responding after the problem has occurred."),
    r("Kết bài", "Nối nguyên nhân với giải pháp tương ứng.", "In conclusion, [summary cause]. By [summary action], it may be possible to [summary result]. A useful solution should therefore respond directly to the reason for the problem. This connection between cause and action is the main point of the approach discussed above."),
  ],
  "problem-solution": [
    r("Mở bài", "Đề hỏi tác hại và giải pháp, không chỉ nguyên nhân.", "The issue of [topic] can create difficulties in everyday life. It is important to examine the problems it causes and consider what can be done to reduce them. Both the effects and the response deserve attention."),
    r("Tác hại", "Nêu ảnh hưởng, nhóm người, ví dụ.", "One serious problem is that [problem]. This can be particularly difficult for [people], because [effect]. For example, [example one]. As a result, [result one]. The example shows why the issue matters to those affected, rather than being only a general concern."),
    r("Giải pháp", "Hành động và cơ chế xử lý tác hại đã nêu.", "One practical way to deal with this is for [actor] to [action]. This would help by [mechanism]. For instance, [practical example]. For this to work well, it is important to [condition]. The purpose is to reduce the difficulty already described, so the action should be assessed by whether it helps the people affected."),
    r("Kết bài", "Tóm tắt tác hại và hướng khắc phục.", "In conclusion, [topic] can have a negative effect on [people]. However, by [summary action], it may be possible to [summary result]. The response should focus on the specific difficulty discussed above and on making the situation more manageable in practice."),
  ],
  "cause-effect": [
    r("Mở bài", "Giới thiệu nguyên nhân và hệ quả, không tự đổi thành giải pháp.", "The issue of [topic] has a number of causes and effects. Understanding both helps us see why it happens and how it influences everyday life. The following discussion considers a main cause and an important consequence."),
    r("Nguyên nhân", "Giải thích chuỗi nguyên nhân, có ví dụ.", "One of the main causes is that [cause]. When this happens, people tend to [behaviour]. For example, [example one]. In this situation, [result one]. This explains how the conditions described can lead to the issue, rather than merely occurring at the same time."),
    r("Hệ quả", "Chỉ rõ ai bị ảnh hưởng và ảnh hưởng ra sao.", "One important consequence is that [problem]. This affects [people], because [effect]. For instance, [effect example]. The example shows how the consequence can reach into ordinary daily activities. Its importance depends on how strongly and how often the people concerned experience this effect."),
    r("Kết bài", "Nhắc mối nối nguyên nhân–hệ quả đã lập luận.", "In conclusion, [summary cause]. As a result, [problem]. These effects are especially important for [people]. Looking at the cause and the consequence together gives us a clearer understanding of the issue and of why it matters to those involved."),
  ],
  "two-questions": [
    r("Mở bài", "Trả lời đúng hai câu hỏi bất kỳ; không mặc định câu hai hỏi tốt/xấu.", "The issue of [topic] raises two questions that need to be considered separately. In response to the first question, [answer one]. As for the second question, [answer two]. The reasons for these answers are explained below."),
    r("Trả lời câu 1", "Câu trả lời → lý do → ví dụ → kết quả.", "Regarding the first question, the main point is that [answer one]. This is because [explanation one]. For example, [example one]. In this situation, [result one]. This example supports the first answer by showing how the reason applies to an everyday situation."),
    r("Trả lời câu 2", "Dành đoạn riêng cho yêu cầu thứ hai.", "Turning to the second question, I would argue that [answer two]. One reason is that [explanation two]. For instance, [example two sentence]. As a result, [result two]. This provides a separate answer to the second question, rather than simply repeating the point made in the previous paragraph."),
    r("Kết bài", "Tóm tắt đủ hai câu trả lời.", "In conclusion, [summary answer one]. In addition, [summary answer two]. Taken together, these answers address the two parts of the question. Each is supported by the reasons and examples discussed above, and both should be considered when thinking about the issue."),
  ],
};

// Complete examples add concrete details rather than lengthening the memorised wording.
const LETTER_DETAILS: Record<string, [string, string]> = {
  reply: ["A double room at the hotel near the station costs about 700,000 dong per night, including breakfast. Its restaurant serves vegetarian food, and the reception team can help arrange a day trip to the old town.", "Each lesson lasts ninety minutes, with speaking practice in small groups. The fee includes a textbook, and you can attend one trial lesson before paying. The centre is near the bus station, so getting there after work is quite easy."],
  advice: ["Choose recordings about familiar topics first, such as food or family. Listen once for the main idea, then repeat useful sentences aloud. This will give you something manageable to practise even on a busy day.", "You could begin with a short route near your home, so you do not need special equipment or transport. Choose a time that fits your schedule and increase the length gradually when you feel comfortable."],
  invitation: ["There will be about ten guests, including several people you already know. I will prepare dinner and a cake, so there is no need to bring food. If you have any dietary requirements, please tell me before Friday so I can plan the menu.", "We will meet beside the main entrance, where there are several benches and a public toilet. Everyone can bring a small dish to share. If heavy rain is expected, we will move the meal to my house and I will send you the address."],
  accept: ["I have kept the evening free, so I will not need to leave early. I can bring enough drinks for ten people and help set the table before the other guests arrive. If the number of guests changes, please tell me before Friday so I can buy the right amount.", "I have checked the route and should reach the main entrance on time. I can prepare sandwiches for everyone, including a vegetarian option. Please tell me how many people are coming and whether anyone has a food allergy, so I can choose the ingredients carefully and bring enough for the group."],
  decline: ["My grandparents live outside the city, and we will probably return late in the evening. I do not want to promise that I can attend and then keep you waiting. If Sunday is convenient, I would be happy to book a table near your home.", "The training lasts all day and is required for my new role, so I cannot leave early. I have checked my schedule for the following weekend and will be free. The museum has a new exhibition that I think we would both enjoy seeing."],
  thanks: ["The largest boxes contained books, and I could not have carried them upstairs safely without another person. Your help also gave me time to unpack the kitchen before work started again. I really enjoyed our conversation while we were putting everything in place.", "Your comments showed me where my ideas were unclear and which grammar mistakes I kept making. I have started checking those points before submitting a new essay. The test felt much less stressful because I knew how to organise my answers."],
  apology: ["I should have contacted you as soon as I realised I would be late. I know you changed your plans to meet me, and I did not mean to waste your afternoon. Please choose a time that is convenient for you.", "I know you need the book to prepare for your next class. I can collect it tonight and bring it to your house before you leave tomorrow. If you need a particular chapter sooner, I can ask my parents to send a photograph."],
  request: ["My main goal is to speak more confidently with customers at work. I can attend classes after six in the evening, but not at weekends. Please advise whether there is a group suitable for a learner at an intermediate level.", "There will be two adults and one child, and we plan to stay for two nights. We would prefer a quiet room away from the street. Please confirm whether a room with an extra bed would be available during our visit."],
  complaint: ["I reported the problem to reception during my stay, but it was not resolved before I left. I have kept my booking confirmation and payment receipt and can provide copies if needed.", "I chose the course because the advertised class size promised plenty of speaking practice. The cancellations and larger group have reduced that opportunity. I can send my registration confirmation and the original advertisement."],
  application: ["In my previous role, I helped visitors locate materials and kept a simple record of borrowed items. I am comfortable using a computer and can explain information clearly. I have attached my CV and would be pleased to discuss how my experience could support your work.", "I have helped a small group of children practise reading every week for six months. I prepare simple activities and check that everyone has a chance to speak. I can provide a reference from the group organiser and would be happy to attend an introductory meeting."],
};
const ESSAY_DETAILS: Record<string, [Record<string, string>, Record<string, string>]> = {
  "opinion-disagree": [{ "alternative action": "combine online learning with regular classroom support" }, { "alternative action": "improve buses before introducing broad restrictions on private cars" }],
  "opinion-partial": [
    { "limit example": "science students may need to use equipment with a teacher present, since a video cannot show whether they are handling the equipment correctly" },
    { "limit example": "a worker cannot easily stop driving if no bus reaches the workplace, particularly when the job starts before the first service of the day" },
  ],
  advantages: [
    { "example two": "a new worker who has to wait for a reply before completing a task, even though a short conversation in an office could resolve the question immediately" },
    { "example two": "a customer who receives a jacket that does not fit and then has to arrange collection, print a return label and wait for the shop to send the correct size" },
  ],
  "cause-solution": [{ "practical example": "a new bus route could connect a large housing area with the city centre during the busiest periods of the working day" }, { }],
  "problem-solution": [{ "practical example": "a new bus route could connect a large housing area with the city centre during the busiest periods of the working day" }, { }],
  "cause-effect": [
    { "effect example": "a parent who gets home late may have less time to help a child with homework or to prepare a meal for the family before bedtime" },
    { "effect example": "a family that throws food away may have less money available for school materials, even though the same money could have covered those necessary costs" },
  ],
};

function makeDeck(base: MemoryDeck, id: string, title: string, rows: Row[], applications: ExtendedDeck["applications"], note = base.note): ExtendedDeck {
  return { ...base, id, title, note, applications, lines: rows.map(([part, vi, en], i) => ({ id: `budget-${i + 1}`, part, vi, en, slot: "", example: fillFrame(en, applications[0].values) })) };
}

export const BUDGET_DECKS: ExtendedDeck[] = [];
for (const base of legacy.filter((d) => d.task === 1)) {
  const registers = ["complaint", "application"].includes(base.id) ? ["formal"] : ["informal", "formal"];
  for (const register of registers) {
    const formal = register === "formal";
    const id = formal ? ["request", "complaint", "application"].includes(base.id) ? base.id : `formal-${base.id}` : base.id === "request" ? "informal-request" : base.id;
    const rows = [formal ? formalOpen : informalOpen, ...LETTER_BODY[base.id].map(([part, vi, en], i): Row => [part, vi, en + (i === LETTER_BODY[base.id].length - 1 ? "\n[supporting detail]" : "")]), formal ? formalClose : informalClose];
    const applications = base.applications.map((app, index) => ({ ...app, values: { ...app.values, "supporting detail": LETTER_DETAILS[base.id][index], name: app.values.name ?? "Alex", "title and surname": app.values["title and surname"] ?? "Ms Brown", "full name": "Minh Nguyen", "working hours": "on Saturdays and Sundays" } }));
    BUDGET_DECKS.push({ ...makeDeck(base, id, `${base.title} · ${formal ? "Trang trọng" : "Thân mật"}`, rows, applications,
      `${formal ? "Biết tên: Dear + danh xưng và họ → Yours sincerely. Không biết tên: Dear Sir or Madam → Yours faithfully." : "Dùng với bạn bè/người thân: Hi + tên → Best wishes."} Khung có 70–80 từ cố định; thêm chi tiết để trả lời tất cả ý của đề, không mặc định đề chỉ có ba ý.`), frameId: formal ? "formal-email" : "informal-email" });
  }
}
for (const base of legacy.filter((d) => d.task === 2)) {
  let applications = base.applications.map((app, index) => ({ ...app, values: { ...app.values, ...(ESSAY_DETAILS[base.id]?.[index] ?? {}) } }));
  if (base.id === "two-questions") applications = [
    { title: "Tập thể dục: khó khăn và cách thay đổi", values: { topic: "regular exercise for working adults", "answer one": "busy schedules make exercise difficult", "answer two": "short activities can fit into an ordinary day", "explanation one": "many adults have work and family responsibilities", "example one": "a parent may need to cook and care for children after work", "result one": "travelling to a gym is difficult", "explanation two": "a simple routine requires less preparation", "example two sentence": "a worker could walk for ten minutes after lunch", "result two": "being active becomes easier to maintain", "supporting detail": "a worker can begin with a short walk near the office instead of paying for a gym membership or travelling somewhere else", "summary answer one": "lack of time is an important barrier", "summary answer two": "small regular changes can make activity more practical" } },
    { title: "Học online: vì sao và đánh giá", values: { topic: "the growth of online learning", "answer one": "flexible schedules attract many learners", "answer two": "this is generally a positive development", "explanation one": "people can study around work and family commitments", "example one": "a worker can watch a recorded lesson after finishing a shift", "result one": "learning does not require missing work", "explanation two": "more people can access useful courses", "example two sentence": "someone in a small town can take a course that is unavailable locally", "result two": "their choice of learning opportunities increases", "supporting detail": "learners still need clear explanations and feedback from a teacher, so the quality of a course matters as much as its flexible schedule", "summary answer one": "flexibility explains much of the appeal", "summary answer two": "wider access makes the change positive overall" } },
  ];
  const rows = [...ESSAY_ROWS[base.id]];
  const contexts = base.id.startsWith("opinion-") ? ["the way universities organise teaching", "the way people travel around cities"]
    : base.id === "discussion" ? ["where people choose to live", "how people choose a suitable job"]
    : ["advantages", "outweigh"].includes(base.id) ? ["how people organise their working lives", "how people buy the things they need"]
    : base.id === "two-questions" ? ["how working adults fit exercise into daily life", "how people access learning opportunities"]
    : ["the journeys people make in busy cities", "how families buy and use food at home"];
  applications = applications.map((app, i) => ({ ...app, values: { ...app.values, context: contexts[i] } }));
  rows.splice(1, 0, r("Phạm vi", "Nêu lĩnh vực cụ thể để người đọc hiểu vấn đề đang bàn.", "In particular, this issue concerns [context]. Its importance becomes clearer when we consider the choices people face in daily life."));
  if (base.id === "opinion-agree") rows.splice(3, 0, r("Đào sâu", "Ai được lợi và tác dụng lâu dài là gì?", "For [affected group], this is particularly useful because they [group situation]. Over time, it can [long-term effect]."));
  if (base.id === "opinion-disagree") rows.splice(rows.length - 1, 0, r("Hướng khác", "Đưa phương án phù hợp hơn với lập luận phản đối.", "A better alternative would be to [alternative action]."));
  if (base.id === "outweigh") rows.splice(rows.length - 1, 0, r("Người được lợi", "Nối lợi ích với nhóm và hoàn cảnh cụ thể.", "The result can be particularly useful for [affected group], who [group situation]."));
  if (base.id === "two-questions") rows.splice(rows.length - 1, 0, r("Làm rõ", "Bổ sung một chi tiết để làm rõ câu trả lời thứ hai.", "One important detail to consider is that [supporting detail]."));
  BUDGET_DECKS.push(makeDeck(base, base.id, base.title, rows, applications,
    `${base.id === "two-questions" ? "Đọc riêng từng câu hỏi; mỗi đoạn thân bài trả lời một câu, không mặc định phải bàn tốt/xấu. " : base.note + " "}Khung có 150–170 từ cố định. Điền lý do, giải thích và ví dụ phù hợp để hoàn thành bài; chỉ giữ câu thực sự phù hợp lập luận.`));
}
export const fixedWordCount = (deck: MemoryDeck) => countFixedFrameWords(deck.lines.map((line) => line.en).join("\n"));
export const sampleFrameId = (group: string, type: string) => group === "writing-task2" && type === "effects" ? "advantages" : type;
