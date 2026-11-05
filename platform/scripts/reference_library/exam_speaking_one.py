"""Personal answers: two familiar topics and six questions per set."""
from exam_common import case, q, section, coverage as c
# Answers describe an invented speaker. Learners must replace personal details.
SETS = [
('photos-food','Chụp ảnh và đồ ăn','Photographs / Food','dthu',17, [
 ('Photographs',[
 ('Do you enjoy photography?', "Yes, I do, mainly because photos help me remember small moments. I usually take pictures when my family gets together, rather than trying to create professional images."),
 ('What do you use for your pictures?', "I use my phone because I carry it everywhere. I normally take pictures in natural light and avoid using too many filters, so people still look like themselves."),
 ('Do landscapes or portraits interest you more?', "Personally, I prefer taking pictures of people. A photo of my grandmother laughing tells me more about a day than a picture of an empty street.")]),
 ('Food',[
 ('Which dish do you enjoy most?', "My favourite dish is chicken noodle soup. I like the warm broth and fresh herbs, and I often have a bowl at a small shop near my house."),
 ('How important are three daily meals to you?', "For me, regular meals are important because I find it harder to concentrate when I miss lunch. However, people's schedules differ, so I wouldn't expect everyone to eat at exactly the same times."),
 ('Would you taste unfamiliar dishes?', "Usually, yes. I like discovering new flavours when I travel. I would first ask what a dish contains, especially if I couldn't recognise the ingredients.")])], [('natural light','ánh sáng tự nhiên'),('fresh herbs','rau thơm tươi'),('ingredients','nguyên liệu')]),
('leisure-neighbourhood','Thời gian rảnh và khu phố','Leisure / Neighbourhood','ufls',16,[
 ('Leisure',[
 ('How do you spend spare time?', "I usually go for a walk or listen to music after work. For me, these activities are a simple way to relax without making complicated plans."),
 ('Do you watch television, and what do you choose?', "Yes, but only a few times a week. I often choose travel programmes on VTV because I enjoy seeing different places and learning how people live there."),
 ('What is your attitude to reading?', "I enjoy short stories, especially before bed. They are easier to fit into my routine than long novels, and I can finish one without staying up too late.")]),
 ('Neighbourhood',[
 ('Describe the area around your home.', "I live in a quiet street outside the city centre. There is a small market nearby, and most of the houses have little spaces for plants at the front."),
 ('What is its best feature for you?', "The people are the best part. My neighbours often collect parcels for one another, so I don't worry about missing a delivery while I'm at work."),
 ('Would you remain there in the future?', "I'd like to stay for the next few years because my parents live nearby. Later, I might move closer to work if my daily journey becomes too tiring.")])], [('spare time','thời gian rảnh'),('stay up too late','thức quá khuya'),('collect parcels','nhận hộ bưu kiện')]),
('work-mornings','Công việc và buổi sáng','Work / Morning routines','practice',None,[
 ('Work',[
 ('What do you do at the moment?', "I work as a shop assistant in a small bookshop. My main tasks are arranging books, helping customers find titles and checking payments at the counter."),
 ('What do you enjoy about your work?', "I enjoy recommending books to customers. For example, last week I helped a parent choose a story for her daughter, and she came back to tell me the child loved it."),
 ('Would you like a different job later?', "Yes, eventually I'd like to work in publishing. My current job helps me understand what readers enjoy, but I would also need to learn more about editing.")]),
 ('Morning routines',[
 ('What time does your day usually begin?', "I normally get up at half past six. That gives me enough time for breakfast and a short walk before I catch the bus to work."),
 ('Do you prefer busy or quiet mornings?', "Personally, I prefer quiet mornings. If I rush out of the house immediately, I tend to forget things, so I prepare my bag the night before."),
 ('Was your routine different as a child?', "Yes. My mother used to wake me up and make breakfast. Now I do those things myself, and I have to plan around my working hours.")])], [('shop assistant','nhân viên bán hàng'),('publishing','ngành xuất bản'),('the night before','tối hôm trước')]),
('study-music','Học tập và âm nhạc','Study / Music','practice',None,[
 ('Study',[
 ('What subject are you studying?', "I'm studying information technology at college. I particularly enjoy building simple websites because I can see the results of my work straight away."),
 ('Where do you study most effectively?', "I study best at the library because my room at home can be noisy. The large tables also give me space for both my laptop and my notes."),
 ('What would you like to learn next?', "I would like to learn how to design clearer interfaces. A website can work correctly but still be difficult to use, and I want to understand that problem better.")]),
 ('Music',[
 ('What music do you listen to?', "I usually listen to gentle pop music on my way home. I prefer songs with clear lyrics because I like singing along when nobody else is around."),
 ('Do you play a musical instrument?', "Not at the moment. I tried learning the guitar at school, but I stopped when exams got busy. I'd like to start again when I have more time."),
 ('Would you rather hear music live or at home?', "For me, listening at home is more convenient. I can choose the volume and stop whenever I need to, although a small live concert can be a special experience.")])], [('straight away','ngay lập tức'),('clear lyrics','lời bài hát rõ'),('choose the volume','chọn âm lượng')]),
('transport-weather','Đi lại và thời tiết','Transport / Weather','practice',None,[
 ('Transport',[
 ('How do you normally travel around town?', "I usually take the bus to work and walk for short trips. The bus stop is close to my house, so I don't need to find a parking space."),
 ('What is difficult about your daily journey?', "Traffic is the main problem. A journey that takes twenty minutes on Sunday can take nearly an hour on a busy weekday, so I leave home early."),
 ('Has the way you travel changed?', "Yes. I cycled everywhere as a student, but my workplace is now farther away. I still use my bicycle for shopping near home at weekends.")]),
 ('Weather',[
 ('What weather do you like best?', "Personally, I like cool, dry weather because I can spend time outdoors comfortably. It's also easier to walk to the bus stop without getting too hot."),
 ('Does rain affect your plans?', "Yes, especially when I plan to meet friends outside. If heavy rain is expected, we usually choose a café instead of going to the park."),
 ('Do you check the forecast regularly?', "I check it most mornings before leaving home. It helps me decide whether to carry a raincoat, although I know the weather can still change unexpectedly.")])], [('parking space','chỗ đỗ xe'),('weather forecast','dự báo thời tiết'),('carry a raincoat','mang áo mưa')]),
('family-festivals','Gia đình và ngày lễ','Family / Festivals','practice',None,[
 ('Family',[
 ('Who do you live with?', "I live with my parents and my younger sister. We have different schedules during the day, but we try to eat dinner together whenever everyone is at home."),
 ('What do you like doing with your family?', "We enjoy cooking on Sundays. My father prepares the vegetables while my sister and I help with the dishes. For me, the conversation is as enjoyable as the food."),
 ('Are you similar to anyone in your family?', "I'm quite similar to my mother because we both like planning ahead. For example, we usually make a shopping list before going to the market.")]),
 ('Festivals',[
 ('Which festival is important to you?', "Tet is the most important one for me. It's a chance to visit relatives I don't see often and spend a few days away from my normal routine."),
 ('How do you prepare for it?', "My family cleans the house and buys flowers a few days beforehand. I usually help my parents prepare food and send messages to relatives who live far away."),
 ('Have your celebrations changed since childhood?', "Yes. As a child, I mostly looked forward to receiving lucky money. Now I enjoy preparing meals and helping older relatives, so I feel more involved.")])], [('planning ahead','lên kế hoạch trước'),('normal routine','sinh hoạt thường lệ'),('lucky money','tiền lì xì')]),
('shopping-clothes','Mua sắm và quần áo','Shopping / Clothes','practice',None,[
 ('Shopping',[
 ('How often do you go shopping?', "I buy groceries twice a week, but I only shop for other things when I need them. Making a list helps me avoid buying too much."),
 ('Do you prefer shops or online shopping?', "For everyday products, I often shop online because I can compare prices quickly. However, I prefer visiting a shop for anything I need to try or inspect carefully."),
 ('Tell me about something you bought recently.', "I recently bought a small desk lamp. My old one was too bright, so I chose a lamp with different brightness settings and now reading at night is more comfortable.")]),
 ('Clothes',[
 ('What clothes do you feel comfortable in?', "Personally, I feel most comfortable in a plain T-shirt and loose trousers. They are easy to move in and suitable for most of my daily activities."),
 ('Do you choose clothes mainly for style or practicality?', "Practicality usually comes first for me. I look for clothes that are easy to wash and combine with things I already own, although I still care about the colour."),
 ('Have you ever worn something special for an event?', "Yes, I wore an ao dai to my cousin's wedding last year. I don't wear one very often, so getting ready for that occasion felt special.")])], [('compare prices','so sánh giá'),('brightness settings','các mức độ sáng'),('loose trousers','quần rộng, thoải mái')]),
('technology-friends','Công nghệ và bạn bè','Technology / Friends','practice',None,[
 ('Technology',[
 ('Which device do you use most?', "I use my phone most because I need it for messages, maps and work calls. For longer tasks, such as writing a report, I switch to my laptop."),
 ('Is there an app you find particularly useful?', "My calendar app is very useful. I put appointments and deadlines in it, and the reminders help me remember things when I have a busy week."),
 ('Would you like to spend less time online?', "Yes. I sometimes keep scrolling when I should be sleeping. I've started leaving my phone away from the bed so I don't reach for it automatically.")]),
 ('Friends',[
 ('How did you meet your closest friend?', "We met at secondary school when we were put in the same science group. We discovered that we liked the same music and began spending time together after class."),
 ('What do you usually do together?', "We often have coffee or go for a walk. For me, the activity matters less than having enough time to talk without being interrupted by work."),
 ('How do you maintain friendships over distance?', "I send short messages during the week and arrange a longer call when we're both free. Sharing ordinary news helps us stay close even when we cannot meet.")])], [('work calls','cuộc gọi công việc'),('calendar app','ứng dụng lịch'),('stay close','giữ sự gắn bó')]),
('home-sport','Nhà ở và thể thao','Home / Sport','practice',None,[
 ('Home',[
 ('What kind of home do you live in?', "I live in a small flat on the third floor. It has two bedrooms and a balcony where my mother grows herbs for cooking."),
 ('Which room do you like most?', "For me, the kitchen is the best room because that is where everyone gathers after work. It's small, but it feels warm and lively in the evening."),
 ('What would you change about your home?', "I would add more storage space. We have quite a few books and household items, and better shelves would make the flat feel less crowded.")]),
 ('Sport',[
 ('Do you enjoy playing any sports?', "Yes, I play badminton with a colleague twice a week. I'm not a strong player, but I enjoy moving around after sitting at a desk all day."),
 ('Do you prefer team sports or individual activities?', "I prefer playing with other people because they encourage me to keep going. If I exercise alone, I sometimes stop early when I feel tired."),
 ('Did you play the same sport as a child?', "No. I mostly played football with children in my street. I started badminton after joining my current workplace because there is a court nearby.")])], [('storage space','không gian cất đồ'),('keep going','tiếp tục cố gắng'),('a court','sân chơi môn như cầu lông, tennis')]),
('holidays-language','Kỳ nghỉ và học ngoại ngữ','Holidays / Language learning','practice',None,[
 ('Holidays',[
 ('What do you usually do on holiday?', "I usually visit a nearby town for two or three days. I like walking around slowly, trying local food and avoiding a schedule with too many activities."),
 ('Do you plan trips early?', "Yes, I normally book transport and accommodation first. However, I leave some time unplanned so I can change activities if the weather is bad."),
 ('Where would you like to go next?', "I would like to visit Hue because I'm interested in old buildings and local dishes. I've seen photos of the city, but I haven't been there myself.")]),
 ('Language learning',[
 ('Why are you learning English?', "I'm learning English to communicate more confidently at work and when travelling. At the moment, I can understand simple messages, but speaking quickly is still difficult."),
 ('Which part do you find hardest?', "Listening is the hardest part for me, especially when people speak fast. I practise with short recordings and listen again after checking the words I missed."),
 ('What helps you remember new expressions?', "For me, using an expression in my own sentence helps most. I also type the sentence several times, then try to write it again without looking.")])], [('accommodation','chỗ ở'),('short recordings','đoạn ghi âm ngắn'),('without looking','không nhìn gợi ý')]),
]

def samples():
    result=[]
    for slug,title,focus,source,page,topics,vocabulary in SETS:
        sections=[section(label,[q(question,answer) for question,answer in questions]) for label,questions in topics]
        result.append(case('speaking-part1',slug,title,focus,'social','Hỏi đáp hai chủ đề',
            'Answer the questions on the two topics below. Give personal answers with a reason or a short example.',
            ['Trả lời đủ hai chủ đề; không đọc thành một bài luận.', 'Mỗi câu trả lời đi thẳng vào câu hỏi, rồi thêm lý do hoặc chi tiết.', 'Thông tin cá nhân trong bài là giả định; thay bằng trải nghiệm thật của bạn.'],[],vocabulary,
            source=source,page=page,sections=sections,checks=[c(f'Chủ đề {i+1}: {s["label"]}',s['questions'][0]['answer']) for i,s in enumerate(sections)]))
    return result
