import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "../components/Navbar";
import config from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "Relive AI - Premium Google Veo 3.1 & OpenAI Sora 2 Studio Workspace",
  description: "Dramatically bring your thoughts, memories, and start frames to life with state-of-the-art AI video models. Experience next-generation video effects, cinematic pans, and flawless detail.",
  keywords: "Google Veo 3.1, OpenAI Sora 2, AI Video Generation, Text to Video, Image to Video, Premium Workspace, SaaS Studio",
  authors: [{ name: "Relive AI team" }],
};

export default function RootLayout({ children }) {
  const theme = config?.theme || "slate-indigo";

  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      data-theme={theme}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col bg-bg-page text-primary-text font-sans overflow-hidden">
        <Providers>
          <Navbar />
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

