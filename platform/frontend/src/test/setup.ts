import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom has no audio playback; TTS unlocks audio on the first pointer event.
vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
