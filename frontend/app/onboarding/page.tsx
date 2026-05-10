"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle, BookOpen, CheckCircle2, ExternalLink, FileSpreadsheet,
  Loader2, Upload,
} from "lucide-react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Step components ────────────────────────────────────────────────────────────

type QuizAnswers = { motivation: string; style: string; peak_time: string };

const QUIZ_QUESTIONS = [
  {
    key: "motivation" as const,
    question: "מה מניע אותך ללמוד?",
    options: [
      { value: "grades", label: "ציונים", emoji: "🏆" },
      { value: "curiosity", label: "סקרנות", emoji: "🧠" },
      { value: "deadlines", label: "לחץ מועדים", emoji: "📅" },
    ],
  },
  {
    key: "style" as const,
    question: "איך אתה לומד הכי טוב?",
    options: [
      { value: "reading", label: "קריאה", emoji: "📖" },
      { value: "practice", label: "תרגול", emoji: "✏️" },
      { value: "listening", label: "הקשבה", emoji: "🎧" },
    ],
  },
  {
    key: "peak_time" as const,
    question: "מתי אתה הכי ממוקד?",
    options: [
      { value: "morning", label: "בוקר", emoji: "🌅" },
      { value: "afternoon", label: "צהריים", emoji: "☀️" },
      { value: "evening", label: "ערב", emoji: "🌙" },
    ],
  },
];

function StepQuiz({ onNext }: { onNext: (answers: QuizAnswers) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});

  const q = QUIZ_QUESTIONS[qIndex];
  const totalQ = QUIZ_QUESTIONS.length;

  function pick(value: string) {
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    if (qIndex < totalQ - 1) {
      setTimeout(() => setQIndex((i) => i + 1), 220);
    } else {
      onNext(next as QuizAnswers);
    }
  }

  return (
    <motion.div
      key={qIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
      className="w-full max-w-md space-y-6"
    >
      <div className="text-center space-y-2">
        <p className="text-xs text-text-muted font-medium tracking-wide uppercase">
          שאלה {qIndex + 1} מתוך {totalQ}
        </p>
        <h2 className="text-xl font-semibold text-text-primary">{q.question}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {q.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => pick(opt.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-sm font-medium transition-base hover:border-sage hover:bg-sage-light",
              answers[q.key] === opt.value
                ? "border-sage bg-sage-light text-sage"
                : "border-border text-text-primary bg-surface"
            )}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5">
        {QUIZ_QUESTIONS.map((_, i) => (
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

// ── ──────────────────────────────────────────────────────────────────────────

const FORMAT_EXAMPLE = `subject_name,day_of_week,start_time,end_time,room
אלגוריתמים,1,08:15,11:45,וסטון 007
מבוא לתכנות,שלישי,10:00,12:00,101`;

function StepSchedule({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: () => api.schedule.import(file!),
    onSuccess: (slots) => { setImported(slots.length); setError(null); },
    onError: (err: Error) => {
      try {
        const body = err.message.replace(/^API \d+: /, "");
        setError(JSON.parse(body).detail ?? err.message);
      } catch {
        setError(err.message);
      }
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
        <h2 className="text-xl font-semibold text-text-primary">הוסף את לוח הזמנים שלך</h2>
        <p className="text-sm text-text-muted">
          העלה קובץ CSV או Excel עם שיעוריך — כל שורה הופכת לשיעור בתצוגת השבוע.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 space-y-4">
        {/* Format hint */}
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] font-medium text-text-muted mb-1.5">עמודות נדרשות:</p>
          <pre className="text-[10px] font-mono text-text-primary overflow-x-auto whitespace-pre">{FORMAT_EXAMPLE}</pre>
          <p className="text-[10px] text-text-muted mt-1.5">
            יום: מספר 0–5 (0=ראשון) או שם כגון &quot;ראשון&quot; / &quot;Sunday&quot;
          </p>
        </div>

        {/* File zone */}
        {imported !== null ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
            <CheckCircle2 size={20} className="text-sage shrink-0" />
            <p className="text-sm font-medium text-text-primary">
              {imported} שיעורים יובאו בהצלחה!
            </p>
          </div>
        ) : file ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-sage bg-sage-light px-4 py-3">
            <FileSpreadsheet size={20} className="text-sage shrink-0" />
            <p className="flex-1 text-sm font-medium text-text-primary truncate">{file.name}</p>
            <button onClick={() => setFile(null)} className="text-text-muted hover:text-text-primary transition-base">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border hover:border-sage hover:bg-sage-light/50 px-4 py-6 text-center transition-base group"
          >
            <Upload size={22} className="mx-auto mb-2 text-text-muted group-hover:text-sage transition-base" />
            <p className="text-sm text-text-muted group-hover:text-sage transition-base">
              בחר קובץ CSV או Excel
            </p>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setError(null); setImported(null); }
            e.target.value = "";
          }}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          {imported === null && (
            <button
              onClick={() => importMutation.mutate()}
              disabled={!file || importMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
            >
              {importMutation.isPending
                ? <><Loader2 size={13} className="animate-spin" />מייבא…</>
                : <><Upload size={13} />יבא</>}
            </button>
          )}
          {imported !== null && (
            <button
              onClick={onNext}
              className="flex-1 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark transition-base"
            >
              המשך →
            </button>
          )}
        </div>

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

// ── ──────────────────────────────────────────────────────────────────────────

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
            {/* Step 1: paste token */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-1.5">
                1. צור בוט ב-<strong>@BotFather</strong> והדבק את הטוקן:
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="1234567890:AAF..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
                <button
                  type="button"
                  onClick={() => saveTokenMutation.mutate(botToken)}
                  disabled={!botToken.trim() || saveTokenMutation.isPending}
                  className="rounded-lg border border-sage px-3 py-2 text-sm font-medium text-sage hover:bg-sage-light disabled:opacity-50 transition-base"
                >
                  {saveTokenMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : tokenSaved ? "✓" : "שמור"}
                </button>
              </div>
            </div>

            {/* Step 2: scan QR */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">
                2. לחץ לקבל QR לסריקה מהטלפון:
              </p>
              <button
                type="button"
                onClick={() => { setError(null); generateMutation.mutate(); }}
                disabled={generateMutation.isPending}
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
  const saveProfileMutation = useMutation({ mutationFn: api.settings.update });

  function handleQuizDone(answers: QuizAnswers) {
    saveProfileMutation.mutate({ learning_style_profile: answers });
    setStep(1);
  }

  function complete() {
    localStorage.setItem("onboarding_done", "true");
    router.replace("/");
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
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
