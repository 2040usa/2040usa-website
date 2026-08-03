import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2040 USA | DTF Printing in Downtown Los Angeles",
  description: "Production-focused DTF transfers, artwork checks, and local pickup in Downtown Los Angeles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
