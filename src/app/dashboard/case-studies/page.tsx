// This page has been moved to /case-studies (public-facing).
// This file can be safely deleted from the repo.
// Editing/creating case studies will live under Website Editor.

import { redirect } from 'next/navigation';

export default function CaseStudiesRedirect() {
  redirect('/case-studies');
}
