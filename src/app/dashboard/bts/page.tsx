"use client";

import Link from "next/link";
import { PostgameLogo } from "@/components/PostgameLogo";
import { createBrowserSupabase } from "@/lib/supabase";
import BtsListClient from "./BtsListClient";

/**
 * /dashboard/bts — admin list view for BTS submissions.
 *
 * Thin shell that matches the /dashboard/brands pattern: header +
 * breadcrumb on top, a reusable list client below that does its own
 * Supabase fetch in a useEffect. Auth is enforced by middleware.
 */
export default function BtsAdminPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <PostgameLogo size="md" />
            </Link>
            <span className="text-gray-700">/</span>
            <Link
              href="/dashboard"
              className="text-sm font-bold text-gray-500 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-gray-700">/</span>
            <h1 className="text-sm font-black text-white">BTS Submissions</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await createBrowserSupabase().auth.signOut();
                window.location.href = "/login";
              }}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <BtsListClient />
      </div>
    </div>
  );
}
