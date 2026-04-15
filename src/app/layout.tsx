import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binance Alpha Monitoring",
  description: "Real-time dashboard for high-potential low-cap tokens on Binance Alpha.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
