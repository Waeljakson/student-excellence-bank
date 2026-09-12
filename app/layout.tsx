import type { Metadata } from "next";
import "./globals.css";
import "@neondatabase/auth-ui/css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "بنك التميز الطلابي | مدارس المشكاة الأهلية",
  description: "منصة التحفيز والتميز الطلابي وإدارة نقاط المكافآت وشيكات QR",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><Providers>{children}</Providers></body></html>;
}
