import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MentalMath – Practice Makes Perfect',
    template: '%s | MentalMath',
  },
  description:
    'A fun mental-math practice platform for kids aged 8–13. Multiplication, division, fractions, decimals and more.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'Nunito, system-ui, sans-serif',
              fontWeight: 600,
              borderRadius: '12px',
              padding: '12px 18px',
            },
          }}
        />
      </body>
    </html>
  );
}
