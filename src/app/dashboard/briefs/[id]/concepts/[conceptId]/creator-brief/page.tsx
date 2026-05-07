// This page has been consolidated into /dashboard/campaign-briefs/[id]/concepts/[conceptId]/creator-brief
// Redirect to the canonical creative brief editor
'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
export default function DeprecatedCreatorBrief() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(
      `/dashboard/campaign-briefs/${params.id}/concepts/${params.conceptId}/creator-brief`
    );
  }, [router, params.id, params.conceptId]);
  return null;
}
