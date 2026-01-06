import type { Metadata } from "next";
import { ToastProvider } from "@/components/Toast";
import { PlayerProvider } from "@/components/PlayerContext";
import { AuthProvider } from "@/components/AuthContext";
import GlobalPlayer from "@/components/GlobalPlayer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hibiki - YouTube Music Streaming",
    template: "%s | Hibiki",
  },
  description: "Self-hosted YouTube music streaming app with collaborative radio mode. Stream your playlists and listen together in sync.",
  keywords: ["youtube", "music", "streaming", "playlist", "radio", "self-hosted"],
  authors: [{ name: "Hibiki" }],
  openGraph: {
    title: "Hibiki - YouTube Music Streaming",
    description: "Self-hosted YouTube music streaming app with collaborative radio mode",
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="bg-tokyo-bg text-tokyo-fg h-screen overflow-hidden"
        suppressHydrationWarning
      >
        <AuthProvider>
          <ToastProvider>
            <PlayerProvider>
              {children}
              <GlobalPlayer />
            </PlayerProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
