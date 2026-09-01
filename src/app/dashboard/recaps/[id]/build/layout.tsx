// ============================================================
// Recap Builder segment layout — /dashboard/recaps/[id]/build
//
// Loads the two faces the approved prototypes use that the root
// layout does not (Anton for the big figures, Arimo for recap
// page body copy), plus the exact Inter/JetBrains weights the
// prototype CSS asks for (Inter 600 for buttons, Mono 500 for
// kickers) which the root layout does not carry.
//
// They are loaded HERE rather than in the root layout so this
// port stays route-local: no other page's font payload changes.
// ============================================================

import { Anton, Arimo, Inter, JetBrains_Mono } from 'next/font/google';
import './builder-chrome.css';

const builderInter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-builder-inter',
  display: 'swap',
});

const builderMono = JetBrains_Mono({
  weight: ['500'],
  subsets: ['latin'],
  variable: '--font-builder-mono',
  display: 'swap',
});

const builderAnton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-builder-anton',
  display: 'swap',
});

const builderArimo = Arimo({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-builder-arimo',
  display: 'swap',
});

export default function RecapBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${builderInter.variable} ${builderMono.variable} ${builderAnton.variable} ${builderArimo.variable}`}
    >
      {children}
    </div>
  );
}
