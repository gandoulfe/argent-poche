import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Argent de poche',
  description: "Gérez l'argent de poche de vos enfants",
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#7C5CBF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Argent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
