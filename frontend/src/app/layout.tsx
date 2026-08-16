import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CreditPulse AI',
  description: 'Autonomous RWA Risk Assessment',
  keywords: ['DeFi', 'RWA', 'Risk Assessment', 'Creditcoin', 'Blockchain', 'Credit Score', 'Smart Contract'],
  authors: [{ name: 'CreditPulse AI Team' }],
  openGraph: {
    title: 'CreditPulse AI — Autonomous RWA Risk Assessment',
    description: 'AI-powered risk scoring for Real-World Assets on Creditcoin blockchain',
    type: 'website',
    siteName: 'CreditPulse AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreditPulse AI',
    description: 'Autonomous RWA Risk Assessment on Creditcoin',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
