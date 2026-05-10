"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircleQuestion, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";

export function MentorBox() {
  const [open, setOpen] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  const mentorMutation = useMutation({
    mutationFn: api.ai.mentor,
    onSuccess: (data) => setAdvice(data.advice),
  });

  function handleOpen() {
    setOpen(true);
    if (!advice) mentorMutation.mutate();
  }

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="trigger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={handleOpen}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-sage px-4 py-2.5 text-sm font-medium text-white shadow-modal hover:bg-sage-dark transition-base"
          >
            <MessageCircleQuestion size={16} />
            אבוד? תשאל אותי
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/10"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-border bg-surface shadow-modal p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧑‍🏫</span>
                  <p className="text-sm font-semibold text-text-primary">מה לעשות עכשיו?</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:bg-gray-50 transition-base"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Content */}
              <div className="min-h-[100px]">
                {mentorMutation.isPending && (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-muted">
                    <Loader2 size={20} className="animate-spin text-sage" />
                    <p className="text-xs">חושב…</p>
                  </div>
                )}

                {mentorMutation.isError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-xs text-red-700">
                      Ollama לא זמין. ודא ש-Ollama רץ ואז נסה שוב.
                    </p>
                  </div>
                )}

                {advice && !mentorMutation.isPending && (
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap text-right" dir="rtl">
                    {advice}
                  </p>
                )}
              </div>

              {/* Refresh */}
              {(advice || mentorMutation.isError) && !mentorMutation.isPending && (
                <button
                  onClick={() => { setAdvice(null); mentorMutation.mutate(); }}
                  className="mt-3 flex items-center gap-1.5 text-xs text-text-muted hover:text-sage transition-base"
                >
                  <RefreshCw size={12} />
                  עדכן המלצה
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
