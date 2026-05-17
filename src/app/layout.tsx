import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoManage - Premium SaaS Rent Car Management",
  description: "Dual-dashboard architecture for administrators and car rental owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
