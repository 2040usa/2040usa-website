import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2040 USA | DTF Printing in Downtown Los Angeles",
  description: "Production-focused DTF transfers, artwork checks, and local pickup in Downtown Los Angeles.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f7f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
