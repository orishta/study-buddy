"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle, BookOpen, CheckCircle2, ExternalLink, FileSpreadsheet,
  Loader2, Upload, Link as LinkIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── 8-Question Executive Functioning Questionnaire ────────────────────────────

interface Question {
  key: string;
  he: string;
  en: string;
  options: { value: string; he: string; en: string; emoji: string }[];
}

const QUESTIONS: Question[] = [
  {
    key: "q1",
    he: "כמה קשה לך להתחיל משימה גם כשאתה יודע שצריך?",
    en: "How hard is it to start a task even when you know you should?",
    options: [
      { value: "q1_hard",   he: "מאוד קשה — לעתים נעצר לשעות", en: "Very hard — I stall for hours",   emoji: "😩" },
      { value: "q1_medium", he: "קשה לפעמים — צריך דחיפה",      en: "Sometimes hard — need a push",    emoji: "😐" },
      { value: "q1_easy",   he: "קל יחסית — מתחיל מיד",          en: "Usually easy — I just start",     emoji: "🚀" },
    ],
  },
  {
    key: "q2",
    he: "כמה זמן אתה מצליח להישאר ממוקד לפני שהתשומת-לב נשברת?",
    en: "How long can you stay focused before your attention breaks?",
    options: [
      { value: "q2_15", he: "עד 15 דקות", en: "Up to 15 min", emoji: "⚡" },
      { value: "q2_30", he: "כ-30 דקות",  en: "About 30 min", emoji: "⏱️" },
      { value: "q2_60", he: "כ-60 דקות",  en: "About 60 min", emoji: "🎯" },
      { value: "q2_90", he: "90+ דקות",   en: "90+ min",      emoji: "🔥" },
    ],
  },
  {
    key: "q3",
    he: "קריאת טקסטים ארוכים מרגישה לך:",
    en: "Reading long texts feels:",
    options: [
      { value: "q3_avoid",  he: "כמעט בלתי-אפשרי — מתחמק",       en: "Nearly impossible — I avoid it",    emoji: "😰" },
      { value: "q3_skip",   he: "קשה — מדלג על קטעים",             en: "Hard — I skip sections",             emoji: "📖" },
      { value: "q3_ok",     he: "בסדר — עם הפסקות",                en: "OK — with breaks",                   emoji: "✅" },
      { value: "q3_enjoy",  he: "נוח ומהנה",                        en: "Comfortable and enjoyable",          emoji: "🤓" },
    ],
  },
  {
    key: "q4",
    he: "כמה פעמים בשבוע אתה מאחר, שוכח דדליינים, או מופתע מכמה זמן עבר?",
    en: "How often do you lose track of time, miss deadlines, or feel surprised how much time passed?",
    options: [
      { value: "q4_often",     he: "כמעט כל יום",    en: "Almost every day", emoji: "😵" },
      { value: "q4_sometimes", he: "כמה פעמים בשבוע", en: "A few times/week", emoji: "🤔" },
      { value: "q4_rarely",    he: "לפעמים",          en: "Sometimes",        emoji: "😊" },
      { value: "q4_never",     he: "כמעט אף פעם",     en: "Rarely",           emoji: "⏰" },
    ],
  },
  {
    key: "q5",
    he: "כשרשימת המשימות שלך ארוכה מדי, מה קורה?",
    en: "When your task list is too long, what happens?",
    options: [
      { value: "q5_shutdown", he: "נסגר — לא עושה כלום",      en: "I shut down — do nothing",       emoji: "🫥" },
      { value: "q5_panic",    he: "חרד — קופץ בין משימות",     en: "I panic — jump between tasks",   emoji: "😰" },
      { value: "q5_manage",   he: "מנהל, אבל מרגיש לחץ",       en: "I manage but feel stressed",     emoji: "😤" },
      { value: "q5_fine",     he: "בסדר — מסדר ומתחיל",        en: "Fine — I prioritize and go",     emoji: "💪" },
    ],
  },
  {
    key: "q6",
    he: "מה הכי מניע אותך להשלים משימה?",
    en: "What motivates you most to complete a task?",
    options: [
      { value: "q6_intrinsic", he: "עניין ואהבה לנושא",    en: "Interest & love of subject",   emoji: "🌱" },
      { value: "q6_social",    he: "שיתוף עם חברים / קבוצה", en: "Studying with others",       emoji: "👥" },
      { value: "q6_deadline",  he: "לחץ הדדליין",           en: "Deadline pressure",            emoji: "⏰" },
      { value: "q6_gamified",  he: "נקודות / פרסים / רצף",  en: "Points / rewards / streaks",   emoji: "🏆" },
    ],
  },
  {
    key: "q7",
    he: "מתי אתה הכי חד ומרוכז ביום?",
    en: "When do you feel sharpest during the day?",
    options: [
      { value: "q7_morning",   he: "בוקר (6–10)",         en: "Morning (6–10am)",    emoji: "🌅" },
      { value: "q7_midday",    he: "צהריים (10–13)",       en: "Midday (10am–1pm)",   emoji: "☀️" },
      { value: "q7_afternoon", he: "אחר הצהריים (14–18)",  en: "Afternoon (2–6pm)",   emoji: "🌤" },
      { value: "q7_evening",   he: "ערב (19+)",            en: "Evening (7pm+)",      emoji: "🌙" },
    ],
  },
  {
    key: "q8",
    he: "איזה סגנון הפסקות עובד הכי טוב בשבילך?",
    en: "Which break style works best for you?",
    options: [
      { value: "q8_pomodoro", he: "25 דקות עבודה + 5 הפסקה",     en: "25 min work + 5 break",       emoji: "🍅" },
      { value: "q8_deep",     he: "50 דקות עבודה + 15 הפסקה",    en: "50 min work + 15 break",      emoji: "🎯" },
      { value: "q8_flow",     he: "עד שאני עוצר לבד",             en: "Until I naturally stop",      emoji: "🌊" },
      { value: "q8_micro",    he: "15 דקות עבודה + 3 הפסקה",     en: "15 min work + 3 break",       emoji: "⚡" },
    ],
  },
];

// ── Questionnaire step ────────────────────────────────────────────────────────

function StepQuiz({ onNext }: { onNext: (answers: Record<string, string>) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<"he" | "en">("he");

  const q = QUESTIONS[qIndex];
  const total = QUESTIONS.length;

  function pick(value: string) {
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    if (qIndex < total - 1) {
      setTimeout(() => setQIndex((i) => i + 1), 220);
    } else {
      onNext(next);
    }
  }

  return (
    <motion.div
      key={qIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
      className="w-full max-w-md space-y-5"
    >
      {/* Language toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setLang((l) => (l === "he" ? "en" : "he"))}
          className="text-xs text-text-muted hover:text-sage transition-base px-2 py-1 rounded-lg border border-border bg-surface"
        >
          {lang === "he" ? "English" : "עברית"}
        </button>
      </div>

      <div className={cn("text-center space-y-2", lang === "he" ? "direction-rtl" : "")} dir={lang === "he" ? "rtl" : "ltr"}>
        <p className="text-xs text-text-muted font-medium tracking-wide uppercase">
          {lang === "he" ? `שאלה ${qIndex + 1} מתוך ${total}` : `Question ${qIndex + 1} of ${total}`}
        </p>
        <h2 className="text-lg font-semibold text-text-primary leading-snug">
          {lang === "he" ? q.he : q.en}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2.5" dir={lang === "he" ? "rtl" : "ltr"}>
        {q.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => pick(opt.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-sm font-medium transition-base hover:border-sage hover:bg-sage-light",
              answers[q.key] === opt.value
                ? "border-sage bg-sage-light text-sage"
                : "border-border text-text-primary bg-surface"
            )}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="text-xs leading-tight text-center">{lang === "he" ? opt.he : opt.en}</span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 justify-center">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === qIndex ? "w-5 bg-sage" : i < qIndex ? "w-1.5 bg-sage/40" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Welcome step ──────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState("");
  const saveMutation = useMutation({ mutationFn: api.settings.update });

  function handleNext() {
    if (!name.trim()) return;
    saveMutation.mutate(
      { display_name: name.trim() },
      { onSuccess: () => onNext(name.trim()) },
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-sage-light mx-auto">
          <BookOpen size={28} className="text-sage" />
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">ברוך הבא ל-StudyBuddy</h1>
        <p className="text-sm text-text-muted">
          הלוח האישי שלך לניהול לימודים. בוא נגדיר אותו תוך דקה.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1.5">
            מה שמך?
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
            placeholder="שם פרטי"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
          />
        </div>

        <button
          onClick={handleNext}
          disabled={!name.trim() || saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
        >
          {saveMutation.isPending
            ? <><Loader2 size={14} className="animate-spin" />שומר…</>
            : "המשך →"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Schedule step ─────────────────────────────────────────────────────────────

const FORMAT_EXAMPLE = `subject_name,day_of_week,start_time,end_time,room
אלגוריתמים,1,08:15,11:45,וסטון 007
מבוא לתכנות,שלישי,10:00,12:00,101`;

type ScheduleMode = "url" | "file";

function StepSchedule({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScheduleMode>("url");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleError(err: Error) {
    try {
      const body = err.message.replace(/^API \d+: /, "");
      setError(JSON.parse(body).detail ?? err.message);
    } catch {
      setError(err.message);
    }
  }

  const urlMutation = useMutation({
    mutationFn: async () => {
      const previews = await api.schedule.previewUrl(url.trim());
      return api.schedule.bulkCreate(previews.map((s) => ({
        subject_name: s.subject_name,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        instructor: s.instructor ?? undefined,
        room: s.room ?? undefined,
        color_code: s.color_code,
      })));
    },
    onSuccess: (slots) => { setImported(slots.length); setError(null); },
    onError: handleError,
  });

  const fileMutation = useMutation({
    mutationFn: () => api.schedule.import(file!),
    onSuccess: (slots) => { setImported(slots.length); setError(null); },
    onError: handleError,
  });

  const isPending = urlMutation.isPending || fileMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md space-y-4"
    >
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-text-primary">הוסף את לוח הזמנים שלך</h2>
        <p className="text-sm text-text-muted">
          ייבא ישירות מהמערכת של הקורסים שלך, או העלה CSV/Excel.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 space-y-4">
        {/* Mode tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {(["url", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setImported(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-base",
                mode === m ? "bg-sage text-white" : "bg-background text-text-muted hover:bg-gray-50"
              )}
            >
              {m === "url" ? <><LinkIcon size={13} />קישור iCal</> : <><Upload size={13} />CSV / Excel</>}
            </button>
          ))}
        </div>

        {imported !== null ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
            <CheckCircle2 size={20} className="text-sage shrink-0" />
            <p className="text-sm font-medium text-text-primary">{imported} שיעורים יובאו בהצלחה!</p>
          </div>
        ) : mode === "url" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
              <strong>MTA / יד-עון:</strong> היכנס למערכת, לחץ &ldquo;Google Calendar&rdquo; ← העתק את הקישור (מתחיל ב-webcal:// או https://).
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mtamn.mta.ac.il/…Google_Token=…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
            />
            <button
              onClick={() => urlMutation.mutate()}
              disabled={!url.trim() || isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
            >
              {isPending ? <><Loader2 size={13} className="animate-spin" />טוען…</> : "טען יומן →"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[11px] font-medium text-text-muted mb-1.5">עמודות נדרשות:</p>
              <pre className="text-[10px] font-mono text-text-primary overflow-x-auto whitespace-pre">{FORMAT_EXAMPLE}</pre>
            </div>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
                <FileSpreadsheet size={20} className="text-sage shrink-0" />
                <p className="flex-1 text-sm font-medium text-text-primary truncate">{file.name}</p>
                <button onClick={() => setFile(null)} className="text-text-muted hover:text-text-primary transition-base">✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-sage hover:bg-sage-light/50 px-4 py-6 text-center transition-base group"
              >
                <Upload size={22} className="mx-auto mb-2 text-text-muted group-hover:text-sage transition-base" />
                <p className="text-sm text-text-muted group-hover:text-sage transition-base">בחר קובץ CSV או Excel</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setError(null); }
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileMutation.mutate()}
              disabled={!file || isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
            >
              {isPending ? <><Loader2 size={13} className="animate-spin" />מייבא…</> : <><Upload size={13} />יבא</>}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {imported !== null && (
          <button
            onClick={onNext}
            className="w-full rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark transition-base"
          >
            המשך →
          </button>
        )}

        <button
          onClick={onSkip}
          className="w-full text-center text-xs text-text-muted hover:text-text-primary transition-base py-1"
        >
          אוסיף מאוחר יותר →
        </button>
      </div>
    </motion.div>
  );
}

// ── Telegram step ─────────────────────────────────────────────────────────────

function StepTelegram({ onComplete }: { onComplete: () => void }) {
  const [botToken, setBotToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tgStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["tg-status"],
    queryFn: api.ai.telegramStatus,
    refetchInterval: false,
  });

  const isConnected = tgStatus?.connected ?? false;

  useEffect(() => {
    if (isConnected && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [isConnected]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) => api.settings.update({ telegram_bot_token: token }),
    onSuccess: () => { setTokenSaved(true); setTimeout(() => setTokenSaved(false), 3000); },
  });

  const generateMutation = useMutation({
    mutationFn: api.ai.generateTelegramStart,
    onSuccess: async (data) => {
      setError(null);
      setDeepLink(data.tg_url);
      const url = await QRCode.toDataURL(data.start_url, { margin: 2, width: 200 });
      setQrDataUrl(url);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => refetchStatus(), 3000);
    },
    onError: (err: Error) => {
      const msg = err.message;
      setError(
        msg.includes("bot token") || msg.includes("No Telegram")
          ? "שמור תחילה את הטוקן של הבוט."
          : `שגיאה: ${msg}`,
      );
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md space-y-4"
    >
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-text-primary">חבר את Telegram</h2>
        <p className="text-sm text-text-muted">
          כל בוקר תקבל הודעה עם לוח הזמנים שלך, המשימות הדחופות וטיפ אחד ליום.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 space-y-4">
        {isConnected ? (
          <div className="flex items-center gap-2 text-sage text-sm font-medium">
            <CheckCircle2 size={18} />
            <span>מחובר בהצלחה!</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted">
                1. פתח Telegram → חפש{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage underline"
                >
                  @BotFather
                </a>
                {" "}→ שלח <code className="font-mono bg-surface border border-border rounded px-1">/newbot</code> → עקוב אחרי ההוראות → קבל טוקן.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => { setBotToken(e.target.value); setTokenSaved(false); }}
                  placeholder="1234567890:AAF..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
                <button
                  type="button"
                  onClick={() => saveTokenMutation.mutate(botToken)}
                  disabled={!botToken.trim() || saveTokenMutation.isPending}
                  className="rounded-lg border border-sage px-3 py-2 text-sm font-medium text-sage hover:bg-sage-light disabled:opacity-50 transition-base"
                >
                  {saveTokenMutation.isPending
                    ? <Loader2 size={13} className="animate-spin" />
                    : tokenSaved ? "✓ נשמר" : "שמור"}
                </button>
              </div>
            </div>

            <div>
              <p className={cn(
                "text-xs font-medium mb-2 transition-base",
                tokenSaved ? "text-text-muted" : "text-text-muted/40"
              )}>
                2. לחץ להצגת QR לסריקה מהטלפון:
              </p>
              <button
                type="button"
                onClick={() => { setError(null); generateMutation.mutate(); }}
                disabled={!tokenSaved || generateMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
              >
                {generateMutation.isPending
                  ? <><Loader2 size={13} className="animate-spin" />יוצר…</>
                  : qrDataUrl ? "רענן QR" : "הצג QR להתחברות"}
              </button>
            </div>

            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Telegram QR" className="rounded-lg" width={200} height={200} />
                {deepLink && (
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-sage hover:underline"
                  >
                    <ExternalLink size={11} />
                    פתח ב-Telegram Desktop
                  </a>
                )}
                <p className="text-[11px] text-text-muted">
                  ממתין לחיבור
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                  </span>
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={onComplete}
          className="w-full rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-sage-dark transition-base"
        >
          {isConnected ? "סיים הגדרה →" : "דלג ועבור לאפליקציה →"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

const STEPS = ["סגנון למידה", "שם", "לוח זמנים", "Telegram"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const profileMutation = useMutation({
    mutationFn: (answers: Record<string, string>) => api.ai.submitQuestionnaire(answers),
  });

  function handleQuizDone(answers: Record<string, string>) {
    profileMutation.mutate(answers);
    setStep(1);
  }

  function complete() {
    localStorage.setItem("onboarding_done", "true");
    router.replace("/");
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8 shrink-0">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-sage" : i < step ? "w-2 bg-sage/40" : "w-2 bg-border",
              )}
            />
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <StepQuiz key="quiz" onNext={handleQuizDone} />
        )}
        {step === 1 && (
          <StepWelcome key="welcome" onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepSchedule key="schedule" onNext={() => setStep(3)} onSkip={() => setStep(3)} />
        )}
        {step === 3 && (
          <StepTelegram key="telegram" onComplete={complete} />
        )}
      </AnimatePresence>
    </div>
  );
}
