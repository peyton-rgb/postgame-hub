// Tab title for the posting-instructions pages (the index is a client
// component, so it can't export metadata itself).
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Posting instructions' };

export default function PostingInstructionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
