// This page has been consolidated into /dashboard/campaign-briefs/new
// Redirect to the canonical Brand Brief form
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function DeprecatedNewBrief() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/campaign-briefs/new'); }, [router]);
  return null;
}
