import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

// Inter for text, as on zod.dev; JetBrains Mono for code.
const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-text',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-code',
});

export const metadata = {
  title: 'Motherload',
  description: 'Import a TOML, YAML, JSON5, JSONC or .env file and get a typed module. Import a JSON Schema and get its type and a validator.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
