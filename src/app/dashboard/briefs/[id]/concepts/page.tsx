// This page has been consolidated into /dashboard/campaign-briefs/[id]/concepts
// Redirect to the canonical concepts page
'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
export default function DeprecatedConcepts() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/dashboard/campaign-briefs/${params.id}/concepts`);
  }, [router, params.id]);
  return null;
}
