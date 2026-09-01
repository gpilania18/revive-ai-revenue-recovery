import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RecoveryProvider } from "@/context/recovery-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "REVIVE | Payment Recovery Intelligence",
  description: "Payment recovery simulation and evaluation environment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <RecoveryProvider>{children}</RecoveryProvider>
      </body>
    </html>
  );
}
