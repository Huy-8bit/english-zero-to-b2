"""Vocabulary topics. Order = learning order (basic, concrete topics before abstract/academic ones).

`band` is the CEFR band where the topic usually starts; it guides plans, it does not restrict anyone.
"""
from __future__ import annotations

TOPICS: list[dict] = [
    {"id": "daily-routine", "name": "Daily Routine", "name_vi": "Sinh hoạt hằng ngày", "band": "A1"},
    {"id": "family-relationships", "name": "Family and Relationships", "name_vi": "Gia đình và các mối quan hệ", "band": "A1"},
    {"id": "food-drinks", "name": "Food and Drinks", "name_vi": "Đồ ăn và thức uống", "band": "A1"},
    {"id": "home-accommodation", "name": "Home and Accommodation", "name_vi": "Nhà cửa và chỗ ở", "band": "A1"},
    {"id": "shopping", "name": "Shopping", "name_vi": "Mua sắm", "band": "A1"},
    {"id": "health", "name": "Health", "name_vi": "Sức khỏe", "band": "A2"},
    {"id": "education", "name": "Education", "name_vi": "Giáo dục", "band": "A2"},
    {"id": "hobbies-entertainment", "name": "Hobbies and Entertainment", "name_vi": "Sở thích và giải trí", "band": "A2"},
    {"id": "transportation", "name": "Transportation", "name_vi": "Giao thông", "band": "A2"},
    {"id": "travel-tourism", "name": "Travel and Tourism", "name_vi": "Du lịch", "band": "A2"},
    {"id": "work-careers", "name": "Work and Careers", "name_vi": "Công việc và nghề nghiệp", "band": "A2"},
    {"id": "communication", "name": "Communication", "name_vi": "Giao tiếp", "band": "B1"},
    {"id": "technology", "name": "Technology", "name_vi": "Công nghệ", "band": "B1"},
    {"id": "internet-social-media", "name": "Internet and Social Media", "name_vi": "Internet và mạng xã hội", "band": "B1"},
    {"id": "finance-money", "name": "Finance and Money", "name_vi": "Tài chính và tiền bạc", "band": "B1"},
    {"id": "psychology-emotions", "name": "Psychology and Emotions", "name_vi": "Tâm lý và cảm xúc", "band": "B1"},
    {"id": "public-services", "name": "Public Services", "name_vi": "Dịch vụ công", "band": "B1"},
    {"id": "media-news", "name": "Media and News", "name_vi": "Truyền thông và tin tức", "band": "B1"},
    {"id": "culture-society", "name": "Culture and Society", "name_vi": "Văn hóa và xã hội", "band": "B1"},
    {"id": "environment", "name": "Environment", "name_vi": "Môi trường", "band": "B1"},
    {"id": "science", "name": "Science", "name_vi": "Khoa học", "band": "B1"},
    {"id": "business", "name": "Business", "name_vi": "Kinh doanh", "band": "B2"},
    {"id": "climate-change", "name": "Climate Change", "name_vi": "Biến đổi khí hậu", "band": "B2"},
    {"id": "social-problems", "name": "Social Problems", "name_vi": "Vấn đề xã hội", "band": "B2"},
    {"id": "global-issues", "name": "Global Issues", "name_vi": "Vấn đề toàn cầu", "band": "B2"},
    {"id": "academic", "name": "Academic Discussions", "name_vi": "Thảo luận học thuật", "band": "B2"},
    # Words that are frequent everywhere and belong to no single topic.
    {"id": "core", "name": "Core Vocabulary", "name_vi": "Từ vựng thông dụng", "band": "A1"},
]
TOPIC_IDS = [t["id"] for t in TOPICS]
TOPIC_BY_ID = {t["id"]: t for t in TOPICS}

# Curriculum VOC units → topics (the curriculum author's own grouping, highest-priority evidence).
UNIT_TOPICS = {
    "VOC-01": ["daily-routine"], "VOC-02": ["family-relationships"], "VOC-03": ["education"], "VOC-04": ["work-careers"],
    "VOC-05": ["transportation", "travel-tourism"], "VOC-06": ["food-drinks", "health"], "VOC-07": ["shopping", "finance-money"],
    "VOC-08": ["technology"], "VOC-09": ["environment"], "VOC-10": ["culture-society", "social-problems"],
    "VOC-11": ["communication"], "VOC-12": ["science"], "VOC-13": ["culture-society"], "VOC-14": ["media-news"],
    "VOC-15": ["business"],
}

# CEFR-J CoreInventory / Threshold categories → topics.
CEFRJ_TOPICS = {
    "Adjectives: personality, description, feelings": ["psychology-emotions"], "Arts": ["culture-society"], "Art": ["culture-society"],
    "Books and literature": ["culture-society"], "Clothes": ["shopping"], "Education": ["education"], "Family life": ["family-relationships"],
    "Film": ["hobbies-entertainment"], "Food and drink": ["food-drinks"], "Hobbies and lifestyles": ["hobbies-entertainment"],
    "Hobbies and pastimes": ["hobbies-entertainment"], "Holidays": ["travel-tourism"], "Leisure activities": ["hobbies-entertainment"],
    "Media": ["media-news"], "Nationalities and countries": ["culture-society"], "News, lifestyles and current affairs": ["media-news"],
    "Objects and rooms": ["home-accommodation"], "Personal information": ["family-relationships"], "Scientific development": ["science"],
    "Shopping": ["shopping"], "Technical and legal language": ["public-services"], "Things in the town, shops and shopping": ["shopping"],
    "Travel and services vocab": ["travel-tourism"], "Ways of travelling": ["transportation"], "Ways of traveling": ["transportation"],
    "Work and Jobs": ["work-careers"], "Work and jobs": ["work-careers"],
    "Daily life": ["daily-routine"], "Free time, entertainment": ["hobbies-entertainment"], "Health and body care": ["health"],
    "House and home, environment": ["home-accommodation"], "Language": ["communication"], "Places": ["travel-tourism"],
    "Relations with other people": ["family-relationships"], "Travel": ["travel-tourism"],
    "Weather": ["environment"],
}

# Wiktionary topic labels / topical categories on a SELECTED sense → topics.
WIKT_TOPICS = {
    "computing": "technology", "programming": "technology", "electronics": "technology", "engineering": "technology",
    "telecommunications": "technology", "graphical user interface": "technology", "software": "technology",
    "internet": "internet-social-media", "social media": "internet-social-media", "online": "internet-social-media",
    "medicine": "health", "anatomy": "health", "pathology": "health", "healthcare": "health", "diseases": "health",
    "finance": "finance-money", "economics": "finance-money", "money": "finance-money", "banking": "finance-money",
    "business": "business", "marketing": "business", "management": "business", "trade": "business", "commerce": "business",
    "law": "public-services", "government": "public-services", "politics": "public-services", "law enforcement": "public-services",
    "crime": "social-problems", "violence": "social-problems",
    "education": "education", "cooking": "food-drinks", "food": "food-drinks", "beverages": "food-drinks",
    "transport": "transportation", "automotive": "transportation", "rail transportation": "transportation", "aviation": "transportation",
    "music": "hobbies-entertainment", "film": "hobbies-entertainment", "sports": "hobbies-entertainment", "games": "hobbies-entertainment",
    "hobbies": "hobbies-entertainment", "entertainment": "hobbies-entertainment", "video games": "hobbies-entertainment",
    "media": "media-news", "journalism": "media-news", "broadcasting": "media-news", "television": "media-news", "publishing": "media-news",
    "biology": "science", "chemistry": "science", "physics": "science", "sciences": "science", "astronomy": "science",
    "ecology": "environment", "meteorology": "environment", "climatology": "climate-change", "weather": "environment",
    "psychology": "psychology-emotions", "emotions": "psychology-emotions", "personality": "psychology-emotions",
    "religion": "culture-society", "arts": "culture-society", "art": "culture-society", "literature": "culture-society",
    "clothing": "shopping", "rooms": "home-accommodation",
    "architecture": "home-accommodation", "construction": "home-accommodation", "family": "family-relationships",
}

# Keyword evidence in a selected sense's English gloss / Vietnamese meaning (lower-case, whole words).
KEYWORDS = {  # English: whole words; Vietnamese: multi-syllable phrases only
    "climate-change": ["climate", "global warming", "greenhouse", "carbon", "emission", "emissions", "fossil fuel", "renewable", "sea level", "khí hậu", "nóng lên", "hạn hán", "lũ lụt", "tái tạo"],
    "daily-routine": ["wake", "sleep", "breakfast", "lunch", "dinner", "bed", "shower", "wash", "routine", "morning", "evening", "thức dậy", "bữa sáng"],
    "environment": ["pollution", "environment", "recycle", "recycling", "nature", "wildlife", "forest", "ô nhiễm", "môi trường"],
    "internet-social-media": ["internet", "website", "web page", "online", "email", "e-mail", "social media", "social network", "web", "browser", "download", "upload", "password", "blog", "trực tuyến", "mạng xã hội", "tải về", "mật khẩu"],
    "psychology-emotions": ["emotion", "feeling", "feelings", "mood", "anxiety", "afraid", "happy", "sad", "angry", "cảm xúc", "cảm giác", "lo lắng"],
    "public-services": ["government", "public", "police", "council", "hospital", "post office", "official", "tax", "chính phủ", "công cộng"],
    "social-problems": ["crime", "poverty", "unemployment", "homeless", "drug", "drugs", "discrimination", "tội phạm", "nghèo đói", "thất nghiệp"],
    "global-issues": ["war", "refugee", "refugees", "global", "worldwide", "pandemic", "famine", "nuclear weapon", "peace", "conflict", "migration", "terrorism", "human rights", "chiến tranh", "quốc tế", "toàn cầu", "hòa bình", "xung đột", "di cư"],
    "finance-money": ["money", "bank", "payment", "price", "pay", "loan", "debt", "ngân hàng"],
    "health": ["illness", "disease", "medical", "doctor", "body", "pain", "sức khỏe"],
    "food-drinks": ["food", "eat", "drink", "meal", "cook", "dish", "đồ ăn"],
    "family-relationships": ["family", "parent", "child", "marriage", "friend", "gia đình"],
    "work-careers": ["job", "employee", "employer", "work", "career", "office", "công việc"],
    "travel-tourism": ["travel", "tourist", "holiday", "hotel", "trip", "du lịch"],
    "transportation": ["vehicle", "road", "car", "train", "bus", "traffic", "xe"],
    "technology": ["computer", "device", "machine", "technology", "digital", "máy tính", "công nghệ"],
    "communication": ["speak", "talk", "say", "language", "message", "conversation", "giao tiếp"],
    "education": ["school", "student", "teacher", "study", "learn", "university"],
}

POS_VI = {
    "noun": "danh từ", "verb": "động từ", "adj": "tính từ", "adv": "trạng từ", "prep": "giới từ", "conj": "liên từ",
    "pron": "đại từ", "det": "hạn định từ", "num": "số từ", "intj": "thán từ", "phrase": "cụm từ", "phrasal_verb": "cụm động từ",
    "aux": "trợ động từ", "collocation": "kết hợp từ", "pattern": "mẫu câu",
}
