import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Providers from './providers';

export const metadata = {
  title: 'Web3 Word Chain',
  description: 'Short sentence chain game on Arbitrum Sepolia',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
