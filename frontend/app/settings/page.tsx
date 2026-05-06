"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { api } from "@/lib/api";

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
  const [pomodoro, setPomodoro] = useState("25");

  useEffect(() => {
    if (settings) {
      setName(settings.display_name);
      setSummaryTime(settings.daily_summary_time);
      setFocusStart(settings.peak_focus_start);
      setFocusEnd(settings.peak_focus_end);
      setPomodoro(String(settings.pomodoro_duration));
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
      pomodoro_duration: parseInt(pomodoro),
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

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">
                Pomodoro duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                step="5"
                value={pomodoro}
                onChange={(e) => setPomodoro(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage transition-base"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Coming soon</h2>
            <p className="text-sm text-text-muted">
              Phase 2 will add AI task chunking (Ollama phi3:mini), weekly mentor,
              and study debriefs.
            </p>
            <p className="text-sm text-text-muted">
              Phase 3 will add Google Calendar + Gmail sync for morning briefings.
            </p>
            <p className="text-sm text-text-muted">
              Phase 4 will add WhatsApp notifications and deadline reminders.
            </p>
          </div>

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
