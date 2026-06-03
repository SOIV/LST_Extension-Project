import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource-variable/noto-sans/wght.css";
import "@fontsource-variable/noto-sans-kr/wght.css";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./globals.css";
import { getLocale } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "LST Project",
  description: "Community subtitle platform for live streaming",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
