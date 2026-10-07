import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "М'ЯСТОРІЯ — Control Center",
  description: "Digital, delivery and aggregator business intelligence"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
