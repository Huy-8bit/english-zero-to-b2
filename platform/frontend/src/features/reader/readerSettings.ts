export interface ReaderSettings {
  enabled: boolean; tone: "paper" | "warm" | "night" | "black"; size: 17 | 19 | 21 | 23;
  font: "book" | "sans"; spacing: "normal" | "wide"; focus: boolean;
}
export const DEFAULT_READER: ReaderSettings = { enabled: true, tone: "black", size: 19, font: "book", spacing: "normal", focus: true };
export const READER_KEY = "em-reader-settings";
export const READER_DARK_DEFAULT_KEY = "em-reader-dark-default-v1";
export function readerSettings(value: Partial<ReaderSettings> | null): ReaderSettings {
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : DEFAULT_READER.enabled,
    tone: value?.tone === "paper" || value?.tone === "warm" || value?.tone === "night" || value?.tone === "black" ? value.tone : DEFAULT_READER.tone,
    size: [17, 19, 21, 23].includes(value?.size ?? 0) ? value!.size! : 19,
    font: value?.font === "sans" ? "sans" : "book",
    spacing: value?.spacing === "wide" ? "wide" : "normal",
    focus: typeof value?.focus === "boolean" ? value.focus : true,
  };
}
export const isReadingRoute = (path: string) => /^\/(?:learn(?:\/|$)|grammar(?:-night|-sprint)?(?:\/|$)|writing(?:-studio|-daily)?(?:\/|$)|reading(?:-studio)?(?:\/|$)|reference(?:\/|$)|model-library(?:\/|$)|library(?:\/|$))/.test(path);
