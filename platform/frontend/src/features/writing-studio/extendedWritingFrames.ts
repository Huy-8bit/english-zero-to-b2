import type { MemoryDeck, MemoryLine } from "./writingMemoryContent";

export interface FrameApplication { title: string; values: Record<string, string> }
export interface ExtendedDeck extends MemoryDeck { applications: FrameApplication[] }
export const fillFrame = (template: string, values: Record<string, string>) => template.replace(/\[([^\]]+)\]/g, (match, key: string) => values[key]?.trim() ? values[key] : match);
export const fixedFrameText = (text: string) => text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
/** Counts English words, not placeholder labels or punctuation left beside a blank. */
export const countFixedFrameWords = (text: string) => (text.replace(/\[[^\]]*\]/g, " ").match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
export const frameSlots = (text: string) => [...new Set([...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]))];
type Row = [part: string, vi: string, en: string];
const row = (part: string, vi: string, en: string): Row => [part, vi, en];
const application = (title: string, values: Record<string, string>): FrameApplication => ({ title, values: { "your name": "Minh", ...values } });
interface Expansion { rows: Row[]; applications: FrameApplication[] }

const LETTERS: Record<string, Expansion> = {
  reply: {
    rows: [
      row("Mở thư", "Chào người bạn nhận thư.", "Hi [name],"),
      row("Hỏi thăm", "Cảm ơn tin nhắn; mình rất vui khi nghe tin từ bạn.", "Thanks for your email. It was lovely to hear from you, and I hope you are doing well."),
      row("Mục đích", "Mình sẵn lòng kể thêm về điều bạn hỏi.", "You asked me about [topic], so I am happy to share some information that may be useful to you."),
      row("Ý thứ nhất", "Điều đầu tiên bạn cần biết là…", "First of all, [point one]. This is worth knowing before you make your plans."),
      row("Ý thứ hai", "Về điều tiếp theo, mình khuyên bạn… vì…", "As for [second point], I would suggest [suggestion] because [reason]."),
      row("Ý cuối", "Còn một điều cần nhớ…", "One more thing to keep in mind is that [final detail]. I hope this helps you decide what to do."),
      row("Kết thư", "Nếu còn hỏi gì, cứ nhắn; mình sẵn lòng giúp.", "If you have any other questions, just send me a message. I would be happy to help."),
      row("Ký tên", "Mong sớm nghe tin từ bạn; ký tên.", "I hope to hear from you soon.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Bạn đến thăm thành phố", { name: "Tom", topic: "visiting my city", "point one": "the old town is easy to explore on foot", "second point": "getting around", suggestion: "taking the bus", reason: "it is cheap and stops near most places", "final detail": "I am free to meet you on Saturday" }),
      application("Bạn hỏi về khóa học", { name: "Anna", topic: "my English course", "point one": "the classes are held on Monday and Friday evenings", "second point": "choosing a level", suggestion: "taking the free placement test", reason: "it will help you find the right class", "final detail": "you need to register before the end of this month" }),
    ],
  },
  advice: {
    rows: [
      row("Mở thư", "Chào và cảm ơn bạn đã kể về hoàn cảnh.", "Hi [name],\nThanks for your email. I am glad you told me about your situation."),
      row("Mục đích", "Đưa ra vài gợi ý dễ thử.", "You asked for advice on [topic]. I have a few suggestions that you might find helpful."),
      row("Gợi ý 1", "Nếu là bạn, mình sẽ bắt đầu bằng…", "If I were you, I would start by [first action]. You do not have to do everything at once."),
      row("Lợi ích", "Cách này giúp…; mỗi ngày dành một chút thời gian.", "This could help you [benefit]. Try to make a little time for it each day."),
      row("Gợi ý 2", "Một cách khác là… vì…", "Another good idea is to [second action], because [reason]."),
      row("Đề nghị", "Mình có thể giúp bằng cách… nếu bạn muốn.", "If you would like some support, I could [offer]. Let me know what works best for you."),
      row("Kết thư", "Mong gợi ý hữu ích; hỏi thăm tiến độ.", "I hope these ideas help. Write back when you have time and tell me how things are going.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Học tiếng Anh", { name: "Alex", topic: "learning English", "first action": "listening to short recordings", benefit: "get used to common words", "second action": "join a speaking club", reason: "you can practise with other learners", offer: "practise with you twice a week" }),
      application("Tập thể dục", { name: "Sam", topic: "getting more exercise", "first action": "walking for fifteen minutes after work", benefit: "build a simple daily habit", "second action": "choose an activity you enjoy", reason: "it will be easier to keep doing it", offer: "go for a walk with you this weekend" }),
    ],
  },
  invitation: {
    rows: [
      row("Mở thư", "Hỏi thăm bạn trước khi mời.", "Hi [name],\nI hope you are doing well. It has been a while since we last met."),
      row("Lời mời", "Mời bạn tham gia sự kiện và bày tỏ mong muốn gặp.", "I am writing to invite you to [event]. It would be lovely to spend some time together."),
      row("Thời gian", "Nói ngày, nơi và giờ bắt đầu.", "It will take place on [day] at [place], and we are planning to start at [time]."),
      row("Hoạt động", "Nêu hoạt động chính và lý do bạn sẽ thích.", "We are going to [activity]. I think you would enjoy it because [reason]."),
      row("Chuẩn bị", "Đề nghị chuẩn bị một việc cụ thể.", "It would be great if you could [preparation]. Please let me know if you need any help getting there."),
      row("Xác nhận", "Xin bạn xác nhận để mình sắp xếp.", "Please let me know if you can come so that I can make the arrangements."),
      row("Kết thư", "Mong gặp bạn; ký tên.", "I really hope you can join us, and I look forward to seeing you soon.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Tiệc sinh nhật", { name: "Anna", event: "my birthday party", day: "Saturday", place: "my house", time: "six in the evening", activity: "have dinner and play some games", reason: "some of our old friends will be there", preparation: "bring your guitar" }),
      application("Đi chơi cuối tuần", { name: "Tom", event: "a picnic with our friends", day: "Sunday", place: "the park near my house", time: "nine in the morning", activity: "have lunch and play football", reason: "you enjoy spending time outdoors", preparation: "bring some water and a hat" }),
    ],
  },
  accept: {
    rows: [
      row("Mở thư", "Cảm ơn bạn đã nghĩ đến mình và mời mình.", "Hi [name],\nThank you very much for your invitation. It was kind of you to think of me."),
      row("Nhận lời", "Mình rất muốn tham gia.", "I would love to come to [event], and I am really looking forward to it."),
      row("Sắp xếp", "Nói giờ đến và cách di chuyển.", "I can arrive at [time]. I am planning to [travel plan], so please let me know where we should meet."),
      row("Hỏi thêm", "Hỏi xem cần mang gì hoặc giúp chuẩn bị không.", "Could you let me know if I should bring anything or help with the preparations?"),
      row("Đề nghị", "Mình sẵn lòng giúp một việc cụ thể.", "I would be happy to [offer] if that would be useful. Just tell me what you need."),
      row("Giúp chuẩn bị", "Có thể đến sớm hơn để giúp nếu cần.", "If you need me to arrive a little earlier to help, please let me know and I will try to arrange it."),
      row("Kết thư", "Cảm ơn lần nữa; mong gặp bạn.", "Thanks again for inviting me. It will be lovely to see you and spend some time together.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Nhận lời dự tiệc", { name: "Anna", event: "your birthday party", time: "six o'clock", "travel plan": "take the bus", offer: "bring some drinks" }),
      application("Nhận lời đi dã ngoại", { name: "Tom", event: "the picnic", time: "nine in the morning", "travel plan": "ride my bike to the park", offer: "make some sandwiches" }),
    ],
  },
  decline: {
    rows: [
      row("Mở thư", "Cảm ơn lời mời và bày tỏ niềm vui.", "Hi [name],\nThank you very much for inviting me to [event]. It sounds lovely."),
      row("Từ chối", "Rất tiếc không thể đến dù rất muốn.", "I am really sorry, but I will not be able to come, even though I would love to join you."),
      row("Lý do", "Giải thích việc đã hẹn trước và không đổi được.", "Unfortunately, I have to [reason]. This was arranged some time ago, and I cannot change it."),
      row("Thông cảm", "Thừa nhận bạn đã lên kế hoạch và xin lỗi vì tin này.", "I realise you may have already made plans, and I am sorry for giving you this disappointing news."),
      row("Hẹn khác", "Đề nghị gặp vào dịp khác, kèm hoạt động.", "Could we meet on [another day] instead? We could [alternative activity] if you are free."),
      row("Thiện chí", "Hy vọng vẫn có dịp gặp nhau.", "I hope you understand, and I would still really like to spend some time with you."),
      row("Kết thư", "Chúc vui và mong nhận phản hồi.", "I hope you have a wonderful time. Let me know whether the new plan would work for you.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Không dự được sinh nhật", { name: "Anna", event: "your birthday party", reason: "visit my grandparents with my parents", "another day": "Sunday", "alternative activity": "have lunch together" }),
      application("Không tham gia chuyến đi", { name: "Alex", event: "the weekend trip", reason: "attend a training course for work", "another day": "the following Saturday", "alternative activity": "visit the local museum" }),
    ],
  },
  thanks: {
    rows: [
      row("Mở thư", "Viết để cảm ơn sự giúp đỡ.", "Hi [name],\nI am writing to thank you for [help]. It was very kind of you."),
      row("Chi tiết", "Nêu việc cụ thể bạn đã làm cho mình.", "I really appreciate the time and effort you put into [specific action]. It meant a lot to me."),
      row("Tác động", "Nhờ bạn, mình làm được điều gì.", "Thanks to your help, I was able to [result]. It would have been much more difficult on my own."),
      row("Cảm nhận", "Nói cảm giác được hỗ trợ.", "You made the whole experience much easier, and I felt that I had someone I could rely on."),
      row("Đáp lại", "Đề nghị cảm ơn bằng hành động.", "I would like to [return favour] as a small way of saying thank you. Please let me know when you are free."),
      row("Kết thư", "Cảm ơn lần nữa và mong sớm gặp lại.", "Thank you again for everything. I hope we can see each other again soon.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Cảm ơn giúp chuyển nhà", { name: "Tom", help: "helping me move last weekend", "specific action": "carrying the heavy boxes", result: "finish the move before Monday", "return favour": "take you out for dinner" }),
      application("Cảm ơn giúp học", { name: "Anna", help: "helping me prepare for my English test", "specific action": "checking my practice essays", result: "understand my mistakes and feel more confident", "return favour": "invite you to lunch this weekend" }),
    ],
  },
  apology: {
    rows: [
      row("Mở thư", "Xin lỗi về việc đã xảy ra.", "Hi [name],\nI am writing to apologise for [mistake]. I am very sorry about what happened."),
      row("Giải thích", "Giải thích ngắn, không né trách nhiệm.", "The reason was that [reason]. I should have let you know earlier, and I am sorry that I did not."),
      row("Ảnh hưởng", "Thừa nhận tác động đối với người nhận.", "I understand that this [effect], and I know that you were counting on me."),
      row("Khắc phục", "Đề xuất việc cụ thể để bù lại.", "To make up for this, I would like to [solution]. Please tell me if this would work for you."),
      row("Cam kết", "Nói cách tránh lặp lại lỗi.", "Next time, I will [prevention] so that the same problem does not happen again."),
      row("Kết thư", "Xin lỗi lần nữa và mong được bỏ qua.", "Once again, I am sorry for letting you down. I hope you can forgive me.\nBest wishes,\n[your name]"),
    ],
    applications: [
      application("Lỡ cuộc hẹn", { name: "Anna", mistake: "missing our meeting", reason: "my train was cancelled", effect: "wasted your time", solution: "meet you on Saturday and buy you lunch", prevention: "contact you as soon as my plans change" }),
      application("Trả sách muộn", { name: "Tom", mistake: "not returning your book on time", reason: "I left it at my parents' house", effect: "made it harder for you to study", solution: "bring it to you tomorrow morning", prevention: "keep a note of the return date" }),
    ],
  },
  request: {
    rows: [
      row("Mở thư", "Chào người nhận đã biết họ tên.", "Dear [title and surname],"),
      row("Mục đích", "Hỏi thêm thông tin trước khi quyết định.", "I am writing to ask for further information about [service]. I would like to know a few details before making a decision."),
      row("Bối cảnh", "Giải thích nhu cầu cụ thể.", "I am interested in this because [need]. I would therefore appreciate your advice on the options available."),
      row("Yêu cầu 1", "Hỏi điều đầu tiên và lý do cần biết.", "First, could you please tell me [question one]? This would help me plan my time and make the necessary arrangements."),
      row("Yêu cầu 2", "Hỏi điều tiếp theo.", "I would also like to know [question two]. Please let me know if there are any additional requirements."),
      row("Bước tiếp", "Xin thông tin về cách đăng ký hoặc đặt chỗ.", "Finally, I would be grateful if you could explain how to [next step] and what I need to prepare."),
      row("Kết thư", "Cảm ơn thời gian và sự giúp đỡ.", "Thank you for your time and help. I look forward to hearing from you.\nYours sincerely,\n[full name]"),
    ],
    applications: [
      application("Hỏi khóa tiếng Anh", { "title and surname": "Ms Brown", service: "your evening English course", need: "I work during the day and want to improve my speaking", "question one": "which evenings the classes take place", "question two": "whether the course fee includes learning materials", "next step": "register for the course", "full name": "Minh Nguyen" }),
      application("Hỏi dịch vụ khách sạn", { "title and surname": "Mr Green", service: "your hotel", need: "my family is planning a weekend visit to your city", "question one": "what time guests can check in", "question two": "whether breakfast is included in the room price", "next step": "book a family room", "full name": "Minh Nguyen" }),
    ],
  },
  complaint: {
    rows: [
      row("Mở thư", "Chào người phụ trách.", "Dear [title and surname],"),
      row("Mục đích", "Nêu dịch vụ và sự không hài lòng.", "I am writing to complain about [service]. Unfortunately, the service I received did not meet my expectations."),
      row("Vấn đề 1", "Nêu sự cố và ảnh hưởng trực tiếp.", "First of all, [problem one]. This was particularly inconvenient because [effect]."),
      row("Vấn đề 2", "Nêu vấn đề tiếp theo và điều đã được hứa.", "In addition, [problem two], although I had been told that [promise]."),
      row("Yêu cầu", "Đề nghị cách giải quyết hợp lý.", "I would therefore like you to [solution]. I believe this would be a fair way to resolve the matter."),
      row("Phản hồi", "Yêu cầu cho biết sẽ xử lý thế nào.", "Please let me know how you intend to deal with this issue. I hope it can be resolved as soon as possible."),
      row("Kết thư", "Cảm ơn đã xem xét và mong phản hồi.", "Thank you for your attention to this matter. I look forward to your reply.\nYours sincerely,\n[full name]"),
    ],
    applications: [
      application("Phàn nàn khách sạn", { "title and surname": "Mr Green", service: "my recent stay at your hotel", "problem one": "the air conditioner did not work", effect: "I could not sleep well", "problem two": "the room was not ready until six in the evening", promise: "I could check in at two", solution: "refund part of the room charge", "full name": "Minh Nguyen" }),
      application("Phàn nàn khóa học", { "title and surname": "Ms Brown", service: "the English course I recently joined", "problem one": "two classes were cancelled without notice", effect: "I had already travelled to the centre", "problem two": "there were twenty students in the class", promise: "there would be no more than ten", solution: "offer replacement classes and a smaller group", "full name": "Minh Nguyen" }),
    ],
  },
  application: {
    rows: [
      row("Mở thư", "Chào người phụ trách tuyển dụng.", "Dear [title and surname],"),
      row("Mục đích", "Nêu vị trí và mong muốn được xem xét.", "I am writing to apply for [position]. I would be grateful if you would consider my application."),
      row("Động lực", "Nêu lý do quan tâm và điều có thể đóng góp.", "I am particularly interested in this role because [motivation]. I believe I could make a useful contribution to your team."),
      row("Kinh nghiệm", "Nêu kinh nghiệm và kỹ năng học được.", "I have experience in [experience]. This has helped me learn how to [skill] and work well with other people."),
      row("Thái độ", "Nêu thái độ làm việc tích cực.", "I am willing to learn, and I always try to complete my work carefully and on time."),
      row("Bước tiếp", "Cho biết lịch phỏng vấn và sẵn sàng bổ sung thông tin.", "I am available for an interview [availability]. Please let me know if you need any further information."),
      row("Kết thư", "Cảm ơn đã xem xét đơn và mong phản hồi.", "Thank you for considering my application. I look forward to hearing from you.\nYours sincerely,\n[full name]"),
    ],
    applications: [
      application("Việc làm ở thư viện", { "title and surname": "Ms Lee", position: "the part-time library assistant position", motivation: "I enjoy reading and helping people find information", experience: "organising school events", skill: "answer questions clearly", availability: "on weekday afternoons", "full name": "Minh Nguyen" }),
      application("Tình nguyện viên", { "title and surname": "Mr Green", position: "the volunteer position at your community centre", motivation: "I would like to help children in my local area", experience: "helping younger students with their homework", skill: "explain simple ideas patiently", availability: "at any time this weekend", "full name": "Minh Nguyen" }),
    ],
  },
};

const intro = row("Mở bài", "Giới thiệu quan điểm mà đề đưa ra.", "Some people believe that [view]. It is worth considering how this would affect people's everyday lives.");
const reason1 = row("Thân bài 1", "Nêu lý do thứ nhất và giải thích vì sao quan trọng.", "The first reason for my view is that [reason one]. This is important because [explanation one].");
const example1 = row("Ví dụ 1", "Đưa tình huống và chỉ ra kết quả cụ thể.", "For example, [example one]. In this case, [result one], which helps explain why this point matters.");
const reason2 = row("Thân bài 2", "Nêu lý do khác và triển khai rõ hơn.", "Another reason to consider is that [reason two]. In other words, [explanation two].");
const example2 = row("Ví dụ 2", "Đưa ví dụ thứ hai rồi nối với lập luận.", "A good example of this is [example two]. This shows that [result two].");
const opinionEnd = row("Kết bài", "Chốt lại lập trường và hai lý do đã bàn.", "In conclusion, I believe that [position]. The main reasons are [summary one] and [summary two]. These points explain why I hold this view.");
const benefits = row("Thân bài 1", "Nêu lợi ích và giải thích tác dụng.", "One important advantage is that [benefit]. This can make it easier for people to [useful action], especially when [situation].");
const drawbacks = row("Thân bài 2", "Nêu bất lợi và nhóm bị ảnh hưởng.", "On the other hand, one clear disadvantage is that [drawback]. This can be a problem for [people], because [difficulty].");
const causes = row("Thân bài 1", "Nêu nguyên nhân và cơ chế gây ra vấn đề.", "One of the main causes is that [cause]. When this happens, people tend to [behaviour], which can make the problem worse.");
const solution = row("Thân bài 2", "Nêu người thực hiện, hành động và cơ chế tác dụng.", "To address this problem, [actor] should [action]. This would help by [mechanism], rather than only dealing with the results of the problem.");
const actionExample = row("Ví dụ giải pháp", "Cho ví dụ cách thực hiện và điều kiện cần.", "For instance, [practical example]. For this to work well, it is important to [condition].");

const EDUCATION = {
  view: "universities should provide online lessons as well as classroom teaching", "reason one": "online lessons give students more choice about when to study", "explanation one": "some students have jobs or live far from their university", "example one": "a student who works in the evening can watch a recorded lesson in the morning", "result one": "the student can continue learning without missing work", "reason two": "classroom lessons give students chances to talk directly with teachers", "explanation two": "students can ask questions and get help as soon as they need it", "example two": "a group discussion in which students explain their ideas to one another", "result two": "direct contact can help learners understand difficult topics", position: "universities should offer both online and classroom lessons", "summary one": "greater choice for students", "summary two": "the value of direct discussion",
};
const TRANSPORT = {
  view: "cities should improve bus services instead of only building more roads", "reason one": "reliable buses can carry many people using less road space", "explanation one": "a single bus can replace a large number of cars", "example one": "workers can leave their cars at home if a bus takes them directly to their offices", "result one": "fewer cars need to enter the city centre during busy hours", "reason two": "public transport helps people who cannot drive", "explanation two": "students and older people also need to travel safely and affordably", "example two": "a bus route that links homes with schools and hospitals", "result two": "better services can help different groups in the community", position: "better bus services should be a priority for cities", "summary one": "less pressure on roads", "summary two": "easier travel for more people",
};
const opinionApps = [application("Giáo dục: học kết hợp", EDUCATION), application("Giao thông: đầu tư xe buýt", TRANSPORT)];
const agreeRows: Row[] = [intro, row("Lập trường", "Đồng ý và báo trước cách triển khai.", "I agree with this view. There are two main reasons for my opinion, and both are closely related to the needs of the people involved."), reason1, example1, reason2, example2, opinionEnd];
const disagreeApps = [
  application("Không thay toàn bộ lớp học bằng học online", { ...EDUCATION, view: "universities should replace all classroom teaching with online lessons", position: "online learning should support rather than replace classroom teaching", "reason one": "some students need direct support from a teacher", "explanation one": "they may find it hard to study alone when a topic is difficult", "example one": "a student may stop working on a task if no one is available to answer a question", "result one": "the lack of immediate help can slow down learning", "summary one": "the need for direct support" }),
  application("Không cấm toàn bộ ô tô ở thành phố", { ...TRANSPORT, view: "all private cars should be banned from city centres", position: "cities should improve public transport before placing broad restrictions on cars", "reason one": "some people do not have a useful alternative to driving", "explanation one": "bus services may not reach the places where they live or work", "example one": "a worker may need to start work before the first bus runs", "result one": "a complete ban would make it harder for that person to earn a living", "reason two": "some journeys require a vehicle that can carry people or heavy items", "explanation two": "older people and small businesses may have practical transport needs", "example two": "a shop owner who needs to collect goods early in the morning", "result two": "a blanket ban may create problems for local businesses", "summary one": "limited travel alternatives", "summary two": "the needs of residents and businesses" }),
];

const SHARED_BALANCE = [
  application("Làm việc tại nhà", { topic: "working from home", benefit: "workers can save time on daily travel", "useful action": "manage their work and family life", situation: "they live far from the office", "example one": "a parent can use the time saved on travel to take a child to school", "result one": "the family has a less stressful morning", drawback: "workers may have fewer chances to speak to colleagues in person", people: "new employees", difficulty: "they may find it harder to ask for help or learn from others", "example two": "a new worker who has to wait for a reply before completing a task", "result two": "working alone can sometimes make simple jobs more difficult", "summary one": "less time spent travelling", "summary two": "less direct contact with colleagues", "stronger reason": "the time saved can improve daily life for many workers", "comparison": "the main communication problems can often be reduced through regular team meetings" }),
  application("Mua sắm trực tuyến", { topic: "shopping online", benefit: "people can compare products without visiting several shops", "useful action": "save time and find a suitable price", situation: "they have a busy schedule", "example one": "a parent can order household items after the children have gone to bed", "result one": "the shopping can be done without an extra trip", drawback: "buyers cannot always check the quality before paying", people: "customers buying clothes or expensive items", difficulty: "a product may look different from its photograph", "example two": "a customer who receives a jacket that does not fit", "result two": "returning an item can take extra time", "summary one": "greater convenience", "summary two": "the risk of receiving an unsuitable product", "stronger reason": "online shops give busy people more choice about when and where to shop", "comparison": "clear return policies can reduce many of the risks" }),
];
const PROBLEMS = [
  application("Ùn tắc giao thông", { topic: "traffic congestion", cause: "bus services are too slow or do not cover enough areas", behaviour: "use cars for journeys that could be made by bus", "example one": "a worker may drive because the nearest bus stop is a long way from home", "result one": "more vehicles use the same roads during busy hours", actor: "local authorities", action: "improve bus routes and make services more frequent", mechanism: "giving people a practical alternative to driving", "practical example": "a new bus route could connect a large housing area with the city centre", condition: "keep the service reliable and affordable", problem: "people spend too much time travelling", people: "workers and their families", effect: "they have less time to rest or spend together", "summary cause": "poor public transport encourages people to drive", "summary action": "improving bus services", "summary result": "reduce the number of unnecessary car journeys" }),
  application("Lãng phí thức ăn", { topic: "food waste at home", cause: "people buy more food than they need", behaviour: "leave food unused until it is no longer safe to eat", "example one": "a family may buy a large bag of vegetables without planning how to use them", "result one": "some of the food may have to be thrown away", actor: "families", action: "plan their meals and check what they already have before shopping", mechanism: "matching the amount they buy to their actual needs", "practical example": "a short shopping list can stop people from buying the same items twice", condition: "choose meals that use the food already in the fridge", problem: "households spend money on food that they never eat", people: "families with a limited budget", effect: "less money is left for other needs", "summary cause": "buying without a plan can lead to waste", "summary action": "planning meals more carefully", "summary result": "save money and reduce the amount of food thrown away" }),
];

const ESSAYS: Record<string, Expansion> = {
  "opinion-agree": { rows: agreeRows, applications: opinionApps },
  "opinion-disagree": { rows: agreeRows.map((r, i) => i === 1 ? row("Lập trường", "Phản đối và báo trước hai lý do.", "I disagree with this view. There are two main reasons for my opinion, and both concern the problems this approach could create.") : r), applications: disagreeApps },
  "opinion-partial": { rows: [intro,
    row("Lập trường", "Đồng ý một phần nhưng nêu rõ giới hạn.", "I agree with this view to some extent. However, I do not think it is the best choice in every situation."),
    row("Thân bài 1", "Giải thích phần đồng ý.", "On the one hand, there are good reasons to support this idea. One clear benefit is that [reason one]. This matters because [explanation one]."), example1,
    row("Thân bài 2", "Giải thích giới hạn, không tự mâu thuẫn.", "On the other hand, we should not ignore the need to [limit]. This is especially important when [condition]."),
    row("Ví dụ giới hạn", "Ví dụ cho trường hợp cần cách khác.", "For example, [limit example]. In such cases, a more flexible approach would be more useful."), opinionEnd],
    applications: [
      application("Học trực tuyến có giới hạn", { ...EDUCATION, view: "students should do more of their learning online", limit: "keep some lessons in the classroom", condition: "students need practical training or direct discussion", "limit example": "science students may need to use equipment with a teacher present", position: "online learning is useful but should not replace all classroom activities", "summary two": "the need for practical support" }),
      application("Hạn chế ô tô có điều kiện", { ...TRANSPORT, view: "cities should limit the use of private cars", limit: "provide other ways to travel first", condition: "people live in areas with few bus services", "limit example": "a worker cannot easily stop driving if no bus reaches the workplace", position: "limits on car use can help when good alternatives are available", "summary two": "the need for reliable alternatives" }),
    ] },
  discussion: { rows: [
    row("Mở bài", "Nêu hai quan điểm trong cùng một câu.", "Some people believe that [view one], while others think that [view two]. Both views have reasons that are worth considering."),
    row("Lập trường", "Nêu lựa chọn của mình rõ ràng.", "In my opinion, [position]. The following points explain why people may prefer different choices."),
    row("Thân bài 1", "Giải thích người ủng hộ phía một và lý do.", "On the one hand, those who support the first view argue that [reason one]. This is understandable because [explanation one]."), example1,
    row("Thân bài 2", "Giải thích phía còn lại với sự cân nhắc công bằng.", "On the other hand, supporters of the second view point out that [reason two]. This is also a reasonable concern, especially when [condition]."), example2,
    row("Kết bài", "Tổng hợp hai phía và chốt ý kiến của mình.", "In conclusion, the first view places more importance on [priority one], while the second focuses on [priority two]. I believe that [position], because [final reason]."),
  ], applications: [
    application("Thành phố hay nông thôn", { "view one": "living in a city is better", "view two": "the countryside offers a better life", position: "the best choice depends on a person's needs", "reason one": "cities provide more jobs and services", "explanation one": "people can live close to workplaces, schools and hospitals", "example one": "a young worker may find more suitable jobs in a large city", "result one": "city life gives that person more choice", "reason two": "the countryside offers more space and a quieter way of life", condition: "people want to raise children away from busy roads", "example two": "a family that enjoys outdoor activities and has work close to home", "result two": "a rural area may suit some families very well", "priority one": "access to opportunities", "priority two": "space and a quieter environment", "final reason": "people have different jobs and family situations" }),
    application("Lương hay sự hài lòng", { "view one": "salary should be the main factor when choosing a job", "view two": "job satisfaction is more important", position: "people need a reasonable income as well as work they can enjoy", "reason one": "a good salary helps people meet their basic needs", "explanation one": "families must pay for housing, food and education", "example one": "a parent may accept a better-paid job to support a child's education", "result one": "income directly affects the family's options", "reason two": "enjoyable work can support long-term well-being", condition: "people spend many hours at work each week", "example two": "a teacher who enjoys helping students and feels supported by colleagues", "result two": "the daily experience of work also matters", "priority one": "financial security", "priority two": "well-being at work", "final reason": "both money and daily happiness affect quality of life" }),
  ] },
  advantages: { rows: [
    row("Mở bài", "Giới thiệu chủ đề và báo trước hai mặt.", "There are both advantages and disadvantages to [topic]. To understand this issue, it is useful to consider the effects on people's daily lives."),
    benefits, example1, drawbacks, example2,
    row("Kết bài", "Tóm tắt đúng hai mặt, không tự áp đặt bên thắng.", "In conclusion, [topic] can offer benefits such as [summary one], but it can also lead to problems such as [summary two]. Both sides need to be considered when deciding whether it suits a particular situation."),
  ], applications: SHARED_BALANCE },
  outweigh: { rows: [
    row("Mở bài", "Thừa nhận hai mặt rồi nêu bên có sức nặng hơn.", "Although there are some disadvantages to [topic], I believe that the advantages are more important overall. The main reason is that [stronger reason]."),
    row("Thân bài 1", "Thừa nhận bất lợi trước khi đánh giá.", "It is true that [drawback]. This can create difficulties for [people], especially because [difficulty]."), example2,
    row("Thân bài 2", "Nêu lợi ích quan trọng hơn và đối tượng được lợi.", "However, a more important advantage is that [benefit]. This can help people [useful action], particularly when [situation]."), example1,
    row("So sánh", "Giải thích vì sao lợi ích lớn hơn, không chỉ đếm số ý.", "I give more weight to this benefit because [stronger reason]. In comparison, [comparison]."),
    row("Kết bài", "Kết luận so sánh, nhắc lại hai mặt.", "In conclusion, while [summary two] is a real concern, the benefit of [summary one] is more important in this case. For this reason, I believe the advantages outweigh the disadvantages."),
  ], applications: SHARED_BALANCE },
  "cause-solution": { rows: [
    row("Mở bài", "Giới thiệu vấn đề và hướng trả lời nguyên nhân–giải pháp.", "There are several reasons for [topic]. Understanding these reasons is important if we want to find practical ways to deal with the problem."),
    causes, example1, solution, actionExample,
    row("Kết bài", "Nối lại nguyên nhân với giải pháp và tác dụng.", "In conclusion, [summary cause]. By [summary action], it may be possible to [summary result]. The key is to choose actions that deal with the cause directly."),
  ], applications: PROBLEMS },
  "problem-solution": { rows: [
    row("Mở bài", "Đề này hỏi tác hại và cách giải quyết.", "The issue of [topic] can create problems in everyday life. It is important to look at these effects and consider what can be done to reduce them."),
    row("Thân bài 1", "Nêu tác hại và ảnh hưởng tới một nhóm người.", "One serious problem is that [problem]. This can be particularly difficult for [people], because [effect]."), example1,
    row("Thân bài 2", "Đề nghị hành động xử lý đúng vấn đề vừa nêu.", "One practical way to deal with this is for [actor] to [action]. This would help by [mechanism]."), actionExample,
    row("Kết bài", "Nhắc tác hại và chốt giải pháp.", "In conclusion, [topic] can have a negative effect on [people]. However, by [summary action], it is possible to [summary result] and reduce some of these difficulties."),
  ], applications: PROBLEMS },
  "cause-effect": { rows: [
    row("Mở bài", "Báo trước nguyên nhân và hệ quả, không chuyển sang giải pháp.", "The issue of [topic] has a number of causes and effects. Looking at both helps us understand why it happens and why it matters."), causes, example1,
    row("Thân bài 2", "Nêu hệ quả và giải thích tác động.", "One important consequence is that [problem]. This affects [people], because [effect]."),
    row("Ví dụ hệ quả", "Cho tình huống cho thấy ảnh hưởng lan sang đời sống.", "For instance, [effect example]. This shows how the issue can influence more than one part of a person's life."),
    row("Kết bài", "Tổng hợp nguyên nhân và hệ quả đã phân tích.", "In conclusion, [summary cause]. As a result, [problem]. These effects are especially important for [people], so the issue deserves careful attention."),
  ], applications: PROBLEMS.map((a, i) => ({ ...a, values: { ...a.values, "effect example": i === 0 ? "a parent who gets home late may have less time to help a child with homework" : "a family that throws food away may have less money available for school materials" } })) },
  "two-questions": { rows: [
    row("Mở bài", "Giới thiệu xu hướng, trả lời ngắn câu vì sao và tốt/xấu.", "There are several reasons why [trend]. I believe this is a mainly [positive or negative] development, although its effects depend on how people respond to it."),
    row("Thân bài 1", "Trả lời trực tiếp câu hỏi thứ nhất.", "One main reason for this trend is that [reason]. This makes it easier for people to [action]."),
    row("Ví dụ 1", "Minh họa nguyên nhân bằng một tình huống.", "For example, [example one]. This helps explain why the trend has become an attractive choice for some people."),
    row("Thân bài 2", "Trả lời câu hỏi thứ hai bằng đánh giá có lý do.", "Regarding the second question, I consider this trend mainly [positive or negative] because [evaluation reason]. This matters in everyday life because [explanation]."),
    row("Ví dụ 2", "Minh họa đánh giá và thừa nhận giới hạn.", "For instance, [example two]. However, it is still important to [limit] so that [purpose]."),
    row("Kết bài", "Tóm tắt cả hai câu trả lời.", "In conclusion, [summary reason] is an important reason for this trend. Overall, I consider it mainly [positive or negative], because [summary evaluation]."),
  ], applications: [
    application("Học trực tuyến: vì sao và tốt hay xấu?", { trend: "more people choose to study online", "positive or negative": "positive", reason: "lessons are available at different times and places", action: "fit study around work and family life", "example one": "a worker can take an evening course without travelling to a college", "evaluation reason": "it opens up learning opportunities", explanation: "people who cannot attend a regular class can still learn useful skills", "example two": "a parent at home can study while a child is asleep", limit: "choose reliable courses and make time for practice", purpose: "the learning is useful", "summary reason": "greater flexibility", "summary evaluation": "more people have a chance to learn" }),
    application("Mua sắm trực tuyến: vì sao và tốt hay xấu?", { trend: "more people buy products online", "positive or negative": "positive", reason: "online shops are easy to use at any time", action: "compare products and prices without leaving home", "example one": "a busy parent can order household items in the evening", "evaluation reason": "it saves time and offers more choice", explanation: "people do not always have time to visit several shops", "example two": "someone in a small town can buy an item that is not available locally", limit: "check the seller and the return policy", purpose: "buyers can avoid unnecessary risks", "summary reason": "convenience", "summary evaluation": "people can shop in ways that suit their needs" }),
  ] },
};

// Reusable analysis sentences add a concrete affected group and longer-term consequence.
// The supplied ideas are matched to each example; they are not universal claims.
const affected = row("Đào sâu ý", "Nói rõ nhóm bị tác động và vì sao điều đó quan trọng với họ.", "The effect is especially important for [affected group], who [group situation]. For them, even a small change can make a noticeable difference to the way they manage their daily lives.");
const longerTerm = row("Phát triển ý", "Nêu một tác động lâu dài, nối với ý ngay trước đó.", "Over time, this can [long-term effect]. The effect is not limited to one day or one decision; it can also influence the choices people make in the future.");
const extraIdeas = (deckId: string, index: number): Record<string, string> => {
  if (deckId.startsWith("opinion-")) return index === 0
    ? { "affected group": "students with part-time jobs", "group situation": "need to balance study with paid work", "long-term effect": "help students build knowledge and confidence for further study" }
    : { "affected group": "workers on a limited income", "group situation": "need affordable ways to reach their workplaces every day", "long-term effect": deckId === "opinion-disagree" ? "help cities protect access to work while gradually reducing unnecessary car use" : "give more residents access to jobs and services" };
  if (deckId === "discussion") return index === 0
    ? { "affected group": "young adults looking for work", "group situation": "need to choose a place where they can support themselves", "long-term effect": "help families build a lifestyle that suits their needs" }
    : { "affected group": "parents supporting young children", "group situation": "need to cover regular costs as well as plan for the future", "long-term effect": "help people stay interested in their work and develop their skills" };
  if (["advantages", "outweigh"].includes(deckId)) return index === 0
    ? { "affected group": "parents with young children", "group situation": "often have to organise their working hours around family needs", "long-term effect": deckId === "advantages" ? "make some workers feel less connected to their team" : "give workers more control over how they organise their day" }
    : { "affected group": "people with busy working schedules", "group situation": "may have little time to visit shops during normal opening hours", "long-term effect": deckId === "advantages" ? "make buyers more careful about where they shop and what they order" : "help people find products that suit their needs and budget" };
  if (["cause-solution", "problem-solution", "cause-effect"].includes(deckId)) return index === 0
    ? { "affected group": "people who travel to work every day", "group situation": "have little control over the amount of traffic on their route", "long-term effect": deckId === "cause-effect" ? "make it harder for families to balance work and time together" : "encourage more people to use buses for their regular journeys" }
    : { "affected group": "families with a limited income", "group situation": "need to make their food budget last throughout the week", "long-term effect": deckId === "cause-effect" ? "put additional pressure on the household budget" : "help families build better shopping habits and use their money more carefully" };
  return index === 0
    ? { "affected group": "adults who work full-time", "group situation": "may not be able to attend regular classes during the day", "long-term effect": "help more adults continue learning and prepare for new opportunities" }
    : { "affected group": "people living far from large shops", "group situation": "may otherwise have to travel a long way to find what they need", "long-term effect": "give buyers more options and help them make better use of their time" };
};

/** Separate IDs/state from the original short-cue course: no old run is silently regraded. */
export function extendWritingDecks(short: MemoryDeck[]): ExtendedDeck[] {
  return short.map((deck) => {
    const data = (deck.task === 1 ? LETTERS : ESSAYS)[deck.id];
    if (!data) throw new Error(`Missing extended frame: ${deck.id}`);
    const applications = data.applications.map((a, index) => ({ ...a, values: { ...a.values, ...(deck.task === 2 ? extraIdeas(deck.id, index) : {}) } }));
    const rows = [...data.rows];
    if (deck.task === 2) {
      const firstExample = rows.findIndex(([part]) => part === "Ví dụ 1");
      rows.splice(firstExample + 1, 0, affected);
      rows.splice(rows.length - 1, 0, longerTerm);
    }
    const memoryLines: MemoryLine[] = rows.map(([part, vi, en], i) => ({ id: `extended-${i + 1}`, part, vi, en, slot: "", example: fillFrame(en, applications[0].values) }));
    return { ...deck, note: deck.id === "two-questions" ? "Bản dài này dành cho đề hỏi vì sao một xu hướng xảy ra và đánh giá tốt/xấu. Với hai câu hỏi khác, cần đổi câu dẫn thân bài để trả lời đúng từng câu hỏi." : deck.note, lines: memoryLines, applications };
  });
}
