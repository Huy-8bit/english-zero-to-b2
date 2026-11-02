/** Irregular verbs for B2, grouped by how their forms change (learning a pattern is faster than learning rows).
 *  `past` / `pp` may hold alternatives separated by "/" (all accepted in drills). `core`: the most frequent ones. */

export type VerbPattern = "AAA" | "ABB" | "ABC" | "ABA";
export interface Verb { base: string; past: string; pp: string; vi: string; pattern: VerbPattern; core?: boolean; note?: string }

export const PATTERNS: Record<VerbPattern, { title: string; hint: string }> = {
  AAA: { title: "A – A – A", hint: "3 dạng giống nhau: cut – cut – cut. Chỉ cần nhớ đó là động từ bất quy tắc." },
  ABB: { title: "A – B – B", hint: "Quá khứ = quá khứ phân từ: buy – bought – bought. Nhớ 1 dạng là đủ cả hai." },
  ABC: { title: "A – B – C", hint: "3 dạng khác nhau: go – went – gone. Dạng 3 thường có -n/-en (taken, written)." },
  ABA: { title: "A – B – A", hint: "Dạng 3 quay về dạng gốc: come – came – come, run – ran – run." },
};

const v = (pattern: VerbPattern, rows: [string, string, string, string, number?, string?][]): Verb[] =>
  rows.map(([base, past, pp, vi, core, note]) => ({ base, past, pp, vi, pattern, ...(core ? { core: true } : {}), ...(note ? { note } : {}) }));

export const VERBS: Verb[] = [
  ...v("AAA", [
    ["cost", "cost", "cost", "có giá, tốn", 1], ["cut", "cut", "cut", "cắt", 1], ["hit", "hit", "hit", "đánh, va vào", 1],
    ["hurt", "hurt", "hurt", "làm đau, bị đau", 1], ["let", "let", "let", "để cho, cho phép", 1], ["put", "put", "put", "đặt, để", 1],
    ["set", "set", "set", "đặt, thiết lập", 1], ["shut", "shut", "shut", "đóng"], ["quit", "quit", "quit", "bỏ (việc, thói quen)", 1],
    ["spread", "spread", "spread", "lan truyền, trải ra", 1], ["upset", "upset", "upset", "làm buồn, làm đảo lộn"],
    ["broadcast", "broadcast", "broadcast", "phát sóng"], ["forecast", "forecast", "forecast", "dự báo"], ["burst", "burst", "burst", "vỡ, nổ tung"],
    ["bet", "bet", "bet", "cá cược"], ["split", "split", "split", "chia, tách"],
    ["read", "read", "read", "đọc", 1, "Viết giống nhau nhưng quá khứ đọc là /red/"],
  ]),
  ...v("ABB", [
    ["bring", "brought", "brought", "mang đến", 1], ["buy", "bought", "bought", "mua", 1], ["catch", "caught", "caught", "bắt, bắt kịp", 1],
    ["fight", "fought", "fought", "chiến đấu, cãi nhau"], ["seek", "sought", "sought", "tìm kiếm (trang trọng)"], ["teach", "taught", "taught", "dạy", 1],
    ["think", "thought", "thought", "nghĩ", 1], ["build", "built", "built", "xây dựng", 1], ["lend", "lent", "lent", "cho mượn"],
    ["send", "sent", "sent", "gửi", 1], ["spend", "spent", "spent", "tiêu, dành (thời gian)", 1], ["feel", "felt", "felt", "cảm thấy", 1],
    ["keep", "kept", "kept", "giữ", 1], ["leave", "left", "left", "rời đi, để lại", 1], ["meet", "met", "met", "gặp", 1],
    ["sleep", "slept", "slept", "ngủ", 1], ["lead", "led", "led", "dẫn dắt, dẫn đến", 1], ["mean", "meant", "meant", "có nghĩa là", 1],
    ["deal", "dealt", "dealt", "giải quyết (deal with)"], ["lose", "lost", "lost", "mất, thua", 1], ["hold", "held", "held", "cầm, tổ chức", 1],
    ["sit", "sat", "sat", "ngồi", 1], ["stand", "stood", "stood", "đứng", 1], ["understand", "understood", "understood", "hiểu", 1],
    ["find", "found", "found", "tìm thấy", 1], ["have", "had", "had", "có", 1], ["hear", "heard", "heard", "nghe thấy", 1],
    ["make", "made", "made", "làm, tạo ra", 1], ["pay", "paid", "paid", "trả tiền", 1], ["say", "said", "said", "nói", 1],
    ["lay", "laid", "laid", "đặt, đẻ (trứng)"], ["sell", "sold", "sold", "bán", 1], ["tell", "told", "told", "kể, bảo", 1],
    ["get", "got", "got/gotten", "nhận được, trở nên", 1, "Anh-Anh: got; Anh-Mỹ: gotten"], ["win", "won", "won", "thắng", 1],
    ["hang", "hung", "hung", "treo"], ["stick", "stuck", "stuck", "dính, mắc kẹt"], ["feed", "fed", "fed", "cho ăn"],
    ["light", "lit", "lit", "thắp sáng"], ["shoot", "shot", "shot", "bắn, quay phim"], ["dig", "dug", "dug", "đào"],
    ["learn", "learnt/learned", "learnt/learned", "học", 1, "Cả learnt và learned đều đúng"],
    ["burn", "burnt/burned", "burnt/burned", "đốt cháy"], ["dream", "dreamt/dreamed", "dreamt/dreamed", "mơ"],
    ["mislead", "misled", "misled", "làm hiểu lầm"], ["withhold", "withheld", "withheld", "giữ lại, từ chối cung cấp"],
  ]),
  ...v("ABC", [
    ["be", "was/were", "been", "thì, là, ở", 1], ["begin", "began", "begun", "bắt đầu", 1], ["break", "broke", "broken", "làm vỡ", 1],
    ["choose", "chose", "chosen", "chọn", 1], ["do", "did", "done", "làm", 1], ["drink", "drank", "drunk", "uống", 1],
    ["drive", "drove", "driven", "lái xe", 1], ["eat", "ate", "eaten", "ăn", 1], ["fall", "fell", "fallen", "rơi, ngã", 1],
    ["fly", "flew", "flown", "bay", 1], ["forget", "forgot", "forgotten", "quên", 1], ["forgive", "forgave", "forgiven", "tha thứ"],
    ["freeze", "froze", "frozen", "đóng băng"], ["give", "gave", "given", "cho, tặng", 1], ["go", "went", "gone", "đi", 1],
    ["grow", "grew", "grown", "lớn lên, trồng", 1], ["hide", "hid", "hidden", "trốn, giấu"], ["know", "knew", "known", "biết", 1],
    ["ride", "rode", "ridden", "cưỡi, đi (xe đạp, xe máy)"], ["ring", "rang", "rung", "reo, gọi điện"], ["rise", "rose", "risen", "tăng, mọc lên", 1],
    ["arise", "arose", "arisen", "nảy sinh, phát sinh"], ["see", "saw", "seen", "nhìn thấy", 1], ["sing", "sang", "sung", "hát"],
    ["speak", "spoke", "spoken", "nói", 1], ["steal", "stole", "stolen", "ăn trộm"], ["swim", "swam", "swum", "bơi"],
    ["take", "took", "taken", "lấy, mang đi", 1], ["undertake", "undertook", "undertaken", "đảm nhận"], ["tear", "tore", "torn", "xé"],
    ["throw", "threw", "thrown", "ném", 1], ["wake", "woke", "woken", "thức dậy"], ["wear", "wore", "worn", "mặc, đội", 1],
    ["write", "wrote", "written", "viết", 1], ["draw", "drew", "drawn", "vẽ, thu hút"], ["withdraw", "withdrew", "withdrawn", "rút (tiền), rút lui"],
    ["show", "showed", "shown", "cho thấy", 1], ["shake", "shook", "shaken", "lắc, rung"], ["mistake", "mistook", "mistaken", "nhầm lẫn"],
    ["foresee", "foresaw", "foreseen", "thấy trước, dự đoán"], ["bear", "bore", "borne", "chịu đựng"], ["forbid", "forbade", "forbidden", "cấm"],
    ["bite", "bit", "bitten", "cắn"], ["beat", "beat", "beaten", "đánh bại", 1, "A – A – B: beat – beat – beaten"],
    ["lie", "lay", "lain", "nằm", 0, "lie (nói dối) là động từ có quy tắc: lied – lied"],
    ["prove", "proved", "proven/proved", "chứng minh"], ["sew", "sewed", "sewn/sewed", "khâu, may"],
  ]),
  ...v("ABA", [
    ["come", "came", "come", "đến", 1], ["become", "became", "become", "trở thành", 1], ["run", "ran", "run", "chạy, điều hành", 1],
    ["overcome", "overcame", "overcome", "vượt qua", 1],
  ]),
];

/** "learnt/learned" → ["learnt", "learned"]; an answer is right when it is one of them (or all of them). */
export function formMatches(answer: string, form: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const a = norm(answer);
  const alts = form.split("/").map(norm);
  return alts.includes(a) || a === norm(form) || (a.includes("/") && a.split("/").every((x) => alts.includes(x)));
}
