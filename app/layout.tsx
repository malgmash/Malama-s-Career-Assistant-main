import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Malama's Career Assistant",
  description: 'Personal career pipeline.',
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
