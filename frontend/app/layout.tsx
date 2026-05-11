import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/OnboardingGate";
import { MentorBox } from "@/components/MentorBox";
import { CourseForm } from "@/components/courses/CourseForm";

export const metadata: Metadata = {
  title: "StudyBuddy",
  description: "Your personal local study dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <OnboardingGate>
            <div className="flex h-screen overflow-hidden bg-background">
              <Sidebar />
              <main className="flex-1 flex flex-col overflow-hidden">
                {children}
              </main>
              <MentorBox />
              <CourseForm />
            </div>
          </OnboardingGate>
        </Providers>
      </body>
    </html>
  );
}
