import type { Metadata, Viewport } from 'next';
import './globals.css';

const TITLE = 'PolicyEngine 2025 Year in Code';
const DESCRIPTION = 'View 2025 GitHub contributions to PolicyEngine';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: 'https://policyengine.org/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
