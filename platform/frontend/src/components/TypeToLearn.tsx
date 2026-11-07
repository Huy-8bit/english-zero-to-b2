import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Characters the learner types; spaces and punctuation are filled in for them. */
const typable = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const same = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" }) === 0;

/** Index of the next character to type at or after `i` (skips spaces/punctuation). */
export function nextTypable(chars: string[], i: number) {
  while (i < chars.length && !typable(chars[i])) i++;
  return i;
}

/** One key against the expected letter: the new position, or null for a miss (a miss is not typed in). */
export function typeKey(chars: string[], pos: number, key: string): number | null {
  if (pos >= chars.length || !same(key, chars[pos])) return null;
  return nextTypable(chars, pos + 1);
}

/**
 * After a miss, the right answer as letter tiles to type in, like a game: a right letter pops green, a wrong key shakes
 * the row and makes the expected letter bounce as a hint — it has to be typed to go on. Case and accents are ignored;
 * spaces and punctuation fill themselves. Works with on-screen keyboards (reads the input's value, not key codes).
 */
export function TypeToLearn({ target, onDone, label = "Gõ lại đáp án đúng" }: { target: string; onDone: () => void; label?: string }) {
  const chars = [...target];
  const [pos, setPos] = useState(() => nextTypable(chars, 0));
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState(0); // bumps to replay the shake/bounce on every miss
  const [combo, setCombo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const done = pos >= chars.length;
  const doneOnce = useRef(false);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (done && !doneOnce.current) { doneOnce.current = true; onDone(); }
  }, [done, onDone]);

  const feed = (typed: string) => {
    let p = pos;
    for (const ch of typed) {
      const n = typeKey(chars, p, ch);
      if (n === null) {
        if (!typable(ch)) continue; // a space or comma typed by habit is not a mistake
        setMisses((m) => m + 1);
        setShake((x) => x + 1);
        setCombo(0);
        break;
      }
      p = n;
      setCombo((c) => c + 1);
    }
    setPos(p);
  };

  const words: { ch: string; i: number }[][] = [[]];
  chars.forEach((ch, i) => (ch === " " ? words.push([]) : words[words.length - 1].push({ ch, i })));
  return (
    <div className="space-y-3 text-center" data-testid="type-to-learn" onClick={() => input.current?.focus()}>
      <p className="text-sm font-medium">{done ? (misses === 0 ? "🎉 Hoàn hảo! Không sai chữ nào." : `👍 Xong! Sai ${misses} chữ — lần sau sẽ nhớ hơn.`) : label}</p>
      <motion.div key={shake} animate={shake && !reduce ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }}
        className="mx-auto flex max-w-xl flex-wrap justify-center gap-x-4 gap-y-2" aria-hidden>
        {words.map((w, wi) => (
          <span key={wi} className="flex gap-1">
            {w.map(({ ch, i }) => {
              const typed = i < pos;
              const current = i === pos;
              const missed = current && shake > 0;
              return (
                <motion.span key={i}
                  animate={reduce ? undefined : typed ? { scale: [1, 1.25, 1], y: [0, -6, 0] } : current ? { y: missed ? [0, -14, 0, -8, 0] : [0, -5, 0] } : undefined}
                  transition={typed ? { duration: 0.25 } : { duration: missed ? 0.6 : 1, repeat: missed ? 0 : Infinity, ease: "easeInOut" }}
                  className={cn("grid h-11 min-w-9 place-items-center rounded-xl border-2 px-1 font-mono text-xl font-bold uppercase transition-colors",
                    typed ? "border-success bg-success-soft text-success"
                      : current ? (missed ? "border-danger bg-danger-soft text-danger" : "border-primary bg-primary-soft text-primary")
                        : typable(ch) ? "border-border text-muted/60" : "border-transparent text-muted")}>
                  {ch}
                </motion.span>
              );
            })}
          </span>
        ))}
      </motion.div>
      <div className="flex items-center justify-center gap-3 text-sm text-muted">
        {!done && combo >= 3 && <motion.span key={combo} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-bold text-warning">🔥 Combo ×{combo}</motion.span>}
        {!done && <span>Chữ sai không được nhập — gõ đúng chữ đang nảy để đi tiếp.</span>}
      </div>
      <input ref={input} value="" onChange={(e) => feed(e.target.value)} disabled={done} aria-label={`${label}: ${target}`}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="mx-auto block h-1 w-1 opacity-0" />
      <p className="sr-only" aria-live="polite">{done ? "Đã gõ xong" : `Đã gõ ${chars.slice(0, pos).join("")}`}</p>
    </div>
  );
}
