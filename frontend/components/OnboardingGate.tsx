"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Redirects first-time users to /onboarding.
 * After onboarding completes, localStorage["onboarding_done"] is set to "true"
 * and this gate becomes a no-op on every subsequent visit.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem("onboarding_done");
    if (!done && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
