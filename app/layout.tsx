import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBanner from "@/components/TopBanner";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Ask a question about Dubai building regulations and get a short answer with the exact clause, document, edition and page behind it. Reference tool only.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dubai-building-regulations-copilot.vercel.app"),
  title: { default: "Dubai Regulations Copilot", template: "%s | Dubai Regulations Copilot" },
  description: DESCRIPTION,
  openGraph: {
    title: "Dubai Regulations Copilot",
    description: DESCRIPTION,
    type: "website",
    siteName: "Dubai Regulations Copilot",
  },
  twitter: { card: "summary", title: "Dubai Regulations Copilot", description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopBanner />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
