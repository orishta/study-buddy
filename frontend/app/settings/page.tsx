"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, Mail, Send } from "lucide-react";
import QRCode from "qrcode";
import { TopBar } from "@/components/layout/TopBar";
import { api } from "@/lib/api";

// ── Telegram connection panel ──────────────────────────────────────────────────

function TelegramPanel() {
  const qc = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const { data: tgStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["tg-status"],
    queryFn: api.ai.telegramStatus,
    refetchInterval: false,
  });

  const isConnected = tgStatus?.connected ?? false;

  useEffect(() => {
    if (settings?.telegram_bot_token) setBotToken(settings.telegram_bot_token);
  }, [settings]);

  // Stop polling once connected
  useEffect(() => {
    if (isConnected && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setQrDataUrl(null);
    }
  }, [isConnected]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) => api.settings.update({ telegram_bot_token: token }),
    onSuccess: () => {
      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: api.ai.generateTelegramStart,
    onSuccess: async (data) => {
      setGenError(null);
      setDeepLink(data.tg_url);
      const url = await QRCode.toDataURL(data.start_url, { margin: 2, width: 220 });
      setQrDataUrl(url);
      // Poll status every 3s until connected
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => refetchStatus(), 3000);
    },
    onError: (err: Error) => {
      const msg = err.message;
      setGenError(
        msg.includes("No Telegram bot token") || msg.includes("bot token")
          ? "הכנס תחילה את הטוקן של הבוט ושמור."
          : msg.includes("503") || msg.includes("Cannot reach")
          ? "לא ניתן להתחבר ל-Telegram. בדוק שהטוקן נכון."
          : `שגיאה: ${msg}`,
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: api.ai.testTelegramBrief,
    onSuccess: () => { setTestSent(true); setTimeout(() => setTestSent(false), 4000); },
    onError: (err: Error) => setGenError(`שליחה נכשלה: ${err.message}`),
  });

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Telegram morning brief</h2>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-sage font-medium">
            <CheckCircle2 size={13} />
            Connected
          </span>
        )}
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Every morning at your summary time, StudyBuddy sends you a personalised
        Hebrew briefing with today&apos;s classes, pending tasks, and advice for the day.
      </p>

      {/* Token input */}
      <div>
        <label className="text-xs font-medium text-text-muted block mb-1.5">
          Bot token
        </label>
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
            {saveTokenMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : tokenSaved ? "✓" : "Save"}
          </button>
        </div>
        <p className="text-[11px] text-text-muted mt-1">
          Create a bot via <strong>@BotFather</strong> on Telegram → paste its token here.
        </p>
      </div>

      {genError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {genError}
        </p>
      )}

      {/* QR code */}
      {!isConnected && qrDataUrl && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-text-muted text-center">
            סרוק עם הטלפון כדי לחבר את הבוט, או לחץ על הכפתור למטה
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Telegram QR code" className="rounded-lg" width={220} height={220} />
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-sage hover:underline"
            >
              <ExternalLink size={12} />
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

      {isConnected && tgStatus?.chat_id && (
        <p className="text-xs text-text-muted">
          Chat ID: <span className="font-mono">{tgStatus.chat_id}</span>
        </p>
      )}

      <div className="flex gap-2">
        {!isConnected && (
          <button
            type="button"
            onClick={() => { setGenError(null); generateMutation.mutate(); }}
            disabled={generateMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
          >
            {generateMutation.isPending
              ? <><Loader2 size={13} className="animate-spin" />Generating…</>
              : qrDataUrl ? "Refresh QR" : "Generate connection QR"}
          </button>
        )}

        {isConnected && (
          <>
            <button
              type="button"
              onClick={() => { setGenError(null); generateMutation.mutate(); }}
              disabled={generateMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-gray-50 disabled:opacity-50 transition-base"
            >
              {generateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : "Re-connect"}
            </button>
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || testSent}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sage px-3 py-2 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
            >
              {testMutation.isPending
                ? <><Loader2 size={13} className="animate-spin" />Sending…</>
                : testSent
                ? <><CheckCircle2 size={13} />Sent!</>
                : <><Send size={13} />Send test brief</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Gmail connection panel ─────────────────────────────────────────────────────

function GmailPanel() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = Boolean(settings?.gmail_refresh_token);

  useEffect(() => {
    if (settings) {
      setClientId(settings.gmail_client_id ?? "");
      setClientSecret(settings.gmail_client_secret ?? "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.settings.update({
        gmail_client_id: clientId.trim(),
        gmail_client_secret: clientSecret.trim(),
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-sage" />
          <h2 className="text-sm font-semibold text-text-primary">Gmail integration</h2>
        </div>
        {isConnected && (
          <span className="flex items-center gap-1 text-xs text-sage font-medium">
            <CheckCircle2 size={13} />
            Connected
          </span>
        )}
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        StudyBuddy scans your inbox every morning for assignment emails and sends you a
        Telegram notification with a one-tap button to add the task to your dashboard.
        All processing stays local — only your credentials leave this app (to Google).
      </p>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
        <strong>Setup:</strong>{" "}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-amber-900"
        >
          Google Cloud Console
        </a>{" "}
        → Create OAuth 2.0 Client ID → Application type: <strong>Desktop app</strong> →
        copy Client ID &amp; Secret below. Add{" "}
        <code className="font-mono bg-amber-100 px-0.5 rounded">http://localhost:8765/oauth/callback</code>{" "}
        as an authorised redirect URI.
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1.5">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="1234567890-abc...apps.googleusercontent.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1.5">
            Client Secret
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="GOCSPX-..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!clientId.trim() || !clientSecret.trim() || saveMutation.isPending}
          className="rounded-lg border border-sage px-3 py-2 text-sm font-medium text-sage hover:bg-sage-light disabled:opacity-50 transition-base"
        >
          {saveMutation.isPending ? <Loader2 size={13} className="animate-spin inline" /> : saved ? "✓ Saved" : "Save credentials"}
        </button>

        {settings?.gmail_client_id && (
          <p className="text-xs text-text-muted">
            Then send <code className="font-mono bg-surface border border-border rounded px-1">/connect_gmail</code> to your Telegram bot to authorise access.
          </p>
        )}
      </div>

      {isConnected && (
        <p className="text-xs text-sage">
          ✓ Gmail is connected. StudyBuddy will scan your inbox every morning at 08:05.
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
  });

  const [name, setName] = useState("");
  const [summaryTime, setSummaryTime] = useState("08:00");
  const [focusStart, setFocusStart] = useState("09:00");
  const [focusEnd, setFocusEnd] = useState("13:00");

  useEffect(() => {
    if (settings) {
      setName(settings.display_name);
      setSummaryTime(settings.daily_summary_time);
      setFocusStart(settings.peak_focus_start);
      setFocusEnd(settings.peak_focus_end);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: api.settings.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      display_name: name,
      daily_summary_time: summaryTime,
      peak_focus_start: focusStart,
      peak_focus_end: focusEnd,
    });
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 max-w-xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">General</h2>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">
                Daily summary time
              </label>
              <input
                type="time"
                value={summaryTime}
                onChange={(e) => setSummaryTime(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Focus preferences</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Peak focus starts
                </label>
                <input
                  type="time"
                  value={focusStart}
                  onChange={(e) => setFocusStart(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Peak focus ends
                </label>
                <input
                  type="time"
                  value={focusEnd}
                  onChange={(e) => setFocusEnd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage transition-base"
                />
              </div>
            </div>

          </div>

          <TelegramPanel />

          <GmailPanel />

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full rounded-lg bg-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-sage-dark disabled:opacity-50 transition-base"
          >
            {updateMutation.isPending ? "Saving..." : "Save settings"}
          </button>

          {updateMutation.isSuccess && (
            <p className="text-center text-sm text-sage">✓ Settings saved</p>
          )}
        </form>
      </div>
    </>
  );
}
