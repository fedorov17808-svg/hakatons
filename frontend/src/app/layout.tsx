import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CreditPulse AI — Autonomous RWA Risk Assessment',
  description: 'Real-time DeFi credit risk scoring powered by AI agents, DeFiLlama oracles, and Creditcoin blockchain',
  keywords: 'DeFi, risk assessment, RWA, Creditcoin, credit score, blockchain, AI',
  authors: [{ name: 'CreditPulse AI Team' }],
  openGraph: {
    title: 'CreditPulse AI — Autonomous RWA Risk Assessment',
    description: 'Real-time DeFi credit risk scoring powered by AI agents, DeFiLlama oracles, and Creditcoin blockchain',
    type: 'website',
    siteName: 'CreditPulse AI',
    url: 'https://frontend-gamma-pink-41.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CreditPulse AI — Autonomous RWA Risk Assessment',
    description: 'Real-time DeFi credit risk scoring powered by AI agents, DeFiLlama oracles, and Creditcoin blockchain',
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
        <noscript>
          <div style={{ padding: '2rem', textAlign: 'center', color: 'white', background: '#020617' }}>
            <h1>CreditPulse AI requires JavaScript</h1>
            <p>Please enable JavaScript in your browser to use this application.</p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
