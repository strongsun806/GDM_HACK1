import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeCity AI | Autonomous Disaster Response Simulator",
  description:
    "Google DeepMind AI Hackathon - Real-Time 3D Subway & Urban Disaster Evacuation Simulator Powered by Gemini 4 Argon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-[#050912] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
