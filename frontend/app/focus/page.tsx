"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Play, Pause, RotateCcw, X, Award } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

// ── Badge definitions ─────────────────────────────────────────────────────────

interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
}

const ALL_BADGES: Badge[] = [
  { id: "first_session",   emoji: "🐧", name: "Focus Starter",  desc: "Complete your first focus session" },
  { id: "three_in_row",    emoji: "🔥", name: "On Fire",         desc: "Complete 3 sessions in a row" },
  { id: "ten_sessions",    emoji: "📚", name: "Scholar",         desc: "10 total focus sessions" },
  { id: "early_bird",      emoji: "☀️", name: "Early Bird",      desc: "Focus session before 8 AM" },
  { id: "night_owl",       emoji: "🦉", name: "Night Owl",       desc: "Focus session after 10 PM" },
  { id: "five_today",      emoji: "🎯", name: "Sharpshooter",    desc: "5 sessions in one day" },
  { id: "long_session",    emoji: "⚡", name: "Deep Work",       desc: "Complete a 45+ minute session" },
];

function loadBadgeStats() {
  try {
    return JSON.parse(localStorage.getItem("focus_stats") ?? "{}");
  } catch { return {}; }
}

function saveBadgeStats(stats: Record<string, unknown>) {
  localStorage.setItem("focus_stats", JSON.stringify(stats));
}

function checkAndAwardBadges(
  stats: Record<string, unknown>,
  sessionMinutes: number,
): Badge[] {
  const newlyEarned: Badge[] = [];
  const earned: string[] = (stats.earned as string[] | undefined) ?? [];
  const totalSessions = ((stats.total as number | undefined) ?? 0) + 1;
  const streak = ((stats.streak as number | undefined) ?? 0) + 1;
  const hour = new Date().getHours();
  const today = new Date().toDateString();
  const todaySessions =
    (stats.last_day as string | undefined) === today
      ? ((stats.today_count as number | undefined) ?? 0) + 1
      : 1;

  const grant = (id: string) => {
    if (!earned.includes(id)) {
      const b = ALL_BADGES.find((b) => b.id === id);
      if (b) { earned.push(id); newlyEarned.push(b); }
    }
  };

  if (totalSessions === 1)          grant("first_session");
  if (totalSessions >= 10)          grant("ten_sessions");
  if (streak >= 3)                  grant("three_in_row");
  if (hour < 8)                     grant("early_bird");
  if (hour >= 22)                   grant("night_owl");
  if (todaySessions >= 5)           grant("five_today");
  if (sessionMinutes >= 45)         grant("long_session");

  saveBadgeStats({
    ...stats,
    earned,
    total: totalSessions,
    streak,
    last_day: today,
    today_count: todaySessions,
  });
  return newlyEarned;
}

// ── Penguin alert ─────────────────────────────────────────────────────────────

function PenguinAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 40 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border bg-surface shadow-modal px-5 py-4 max-w-sm"
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-4xl select-none"
      >
        🐧
      </motion.span>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-text-muted hover:text-text-primary transition-base"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ── Badge pop-up ──────────────────────────────────────────────────────────────

function BadgeToast({ badge, onDismiss }: { badge: Badge; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-sage bg-sage-light px-5 py-3 shadow-modal"
    >
      <span className="text-2xl">{badge.emoji}</span>
      <div>
        <p className="text-xs font-semibold text-sage">Badge unlocked!</p>
        <p className="text-sm font-medium text-text-primary">{badge.name}</p>
      </div>
    </motion.div>
  );
}

// ── Badge board ───────────────────────────────────────────────────────────────

function BadgeBoard({ onClose }: { onClose: () => void }) {
  const earned: string[] = loadBadgeStats().earned ?? [];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl border border-border bg-surface shadow-modal p-6 max-w-sm w-full space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Award size={15} className="text-sage" /> Focus Badges
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-base">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ALL_BADGES.map((b) => {
            const unlocked = earned.includes(b.id);
            return (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-base",
                  unlocked ? "border-sage bg-sage-light" : "border-border bg-background opacity-50"
                )}
              >
                <span className="text-xl">{unlocked ? b.emoji : "🔒"}</span>
                <div>
                  <p className="text-xs font-medium text-text-primary">{b.name}</p>
                  <p className="text-[10px] text-text-muted">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-text-muted text-center">
          {earned.length}/{ALL_BADGES.length} badges unlocked
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── Web Audio beep (no audio file needed) ─────────────────────────────────────

function beepBeepBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const pulses = [0, 0.35, 0.7];
    pulses.forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + offset);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + 0.2);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
    // Close context after all pulses finish
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // AudioContext unavailable (e.g. SSR) — fail silently
  }
}

// ── Timer display ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FocusPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => api.tasks.list() });

  const defaultMinutes = settings?.pomodoro_duration ?? 25;
  const [durationMinutes, setDurationMinutes] = useState(defaultMinutes);
  const [remaining, setRemaining] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [penguin, setPenguin] = useState<string | null>(null);
  const [badgesToShow, setBadgesToShow] = useState<Badge[]>([]);
  const [showBadgeBoard, setShowBadgeBoard] = useState(false);
  const sessionStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync duration from settings once loaded
  useEffect(() => {
    if (settings && !running) {
      setDurationMinutes(settings.pomodoro_duration);
      setRemaining(settings.pomodoro_duration * 60);
    }
  }, [settings, running]);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          handleSessionComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Penguin alert + beep on tab switch during active session
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden && running) {
        setPenguin("היי! אתה אמור להיות בפוקוס 🐧 חזור לכאן!");
        beepBeepBeep();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [running]);

  const handleSessionComplete = useCallback(() => {
    const elapsed = sessionStartRef.current
      ? Math.round((Date.now() - sessionStartRef.current) / 60000)
      : durationMinutes;
    const stats = loadBadgeStats();
    const newBadges = checkAndAwardBadges(stats, elapsed);
    if (newBadges.length) setBadgesToShow(newBadges);
    setPenguin("כל הכבוד! סשן הפוקוס הסתיים 🎉 קח הפסקה קצרה.");
    sessionStartRef.current = null;
  }, [durationMinutes]);

  function handleStart() {
    sessionStartRef.current = Date.now();
    setRunning(true);
    setPenguin(null);
  }

  function handlePause() { setRunning(false); }

  function handleReset() {
    setRunning(false);
    setRemaining(durationMinutes * 60);
    sessionStartRef.current = null;
    setPenguin(null);
  }

  function handleDurationChange(mins: number) {
    if (running) return;
    setDurationMinutes(mins);
    setRemaining(mins * 60);
  }

  const activeTasks = tasks.filter((t) => t.status !== "Done" && !t.parent_task_id);
  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId) ?? null;
  const pct = 1 - remaining / (durationMinutes * 60);
  const circumference = 2 * Math.PI * 110; // r=110

  const earned = (loadBadgeStats().earned as string[] | undefined) ?? [];

  return (
    <div className="fixed inset-0 z-30 bg-background flex flex-col items-center justify-center p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 absolute top-4 left-4 right-4 justify-between">
        <p className="text-sm font-semibold text-text-primary">🐧 Focus Mode</p>
        <button
          onClick={() => setShowBadgeBoard(true)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-sage transition-base"
        >
          <Award size={13} />
          {earned.length}/{ALL_BADGES.length} badges
        </button>
      </div>

      {/* Task selector */}
      <div className="relative w-full max-w-xs">
        <select
          value={selectedTaskId ?? ""}
          onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : null)}
          className="w-full appearance-none rounded-xl border border-border bg-surface px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sage transition-base"
        >
          <option value="">— בחר משימה לעבוד עליה —</option>
          {activeTasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      </div>

      {/* Circular timer */}
      <div className="relative flex items-center justify-center">
        <svg width={260} height={260} className="-rotate-90">
          <circle cx={130} cy={130} r={110} fill="none" stroke="var(--color-border)" strokeWidth={10} />
          <motion.circle
            cx={130} cy={130} r={110}
            fill="none"
            stroke="var(--color-sage)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transition={{ duration: 0.5 }}
          />
        </svg>

        <div className="absolute flex flex-col items-center gap-1">
          <motion.span
            key={remaining}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="text-5xl font-mono font-semibold text-text-primary tabular-nums"
          >
            {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
          </motion.span>
          {selectedTask && (
            <p className="text-xs text-text-muted max-w-[160px] text-center truncate">
              {selectedTask.title}
            </p>
          )}
        </div>
      </div>

      {/* Duration presets */}
      {!running && (
        <div className="flex gap-2">
          {[15, 25, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => handleDurationChange(m)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-base",
                durationMinutes === m
                  ? "border-sage bg-sage-light text-sage"
                  : "border-border text-text-muted hover:border-sage hover:text-sage"
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-gray-50 transition-base"
        >
          <RotateCcw size={14} /> Reset
        </button>
        <button
          onClick={running ? handlePause : handleStart}
          className="flex items-center gap-2 rounded-xl bg-sage px-6 py-2.5 text-sm font-medium text-white hover:bg-sage-dark transition-base shadow-card"
        >
          {running
            ? <><Pause size={16} /> Pause</>
            : <><Play size={16} /> {remaining === durationMinutes * 60 ? "Start" : "Resume"}</>}
        </button>
      </div>

      {/* Penguin alert */}
      <AnimatePresence>
        {penguin && (
          <PenguinAlert key="penguin" message={penguin} onDismiss={() => setPenguin(null)} />
        )}
      </AnimatePresence>

      {/* Badge toast queue */}
      <AnimatePresence>
        {badgesToShow[0] && (
          <BadgeToast
            key={badgesToShow[0].id}
            badge={badgesToShow[0]}
            onDismiss={() => setBadgesToShow((b) => b.slice(1))}
          />
        )}
      </AnimatePresence>

      {/* Badge board modal */}
      <AnimatePresence>
        {showBadgeBoard && <BadgeBoard key="board" onClose={() => setShowBadgeBoard(false)} />}
      </AnimatePresence>
    </div>
  );
}
