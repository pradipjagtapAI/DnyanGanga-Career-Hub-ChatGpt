import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DnyanGanga Career Hub | Your AI-Powered Career Growth Platform",
  description:
    "A thoughtful career workspace for your profile, resumes, job search and interview preparation.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
