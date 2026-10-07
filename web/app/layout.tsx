import type { Metadata } from "next";
import "./globals.css";

const description =
  "BI Control Center М'ЯСТОРІЯ: оборот, чеки, середній чек, націнка, доставка, агрегатори, заклади, LFL, динаміка та автоматичні insights.";

export const metadata: Metadata = {
  title: {
    default: "М'ЯСТОРІЯ — Control Center",
    template: "%s | М'ЯСТОРІЯ Control Center"
  },
  description,
  applicationName: "М'ЯСТОРІЯ Control Center",
  openGraph: {
    title: "М'ЯСТОРІЯ — Control Center",
    description,
    type: "website",
    locale: "uk_UA"
  },
  appleWebApp: {
    capable: true,
    title: "М'ЯСТОРІЯ BI",
    statusBarStyle: "black-translucent"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
