import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";

const montserratLogo = Montserrat({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Backpack",
  description: "Frontend of Backpack.exchange",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserratLogo.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
