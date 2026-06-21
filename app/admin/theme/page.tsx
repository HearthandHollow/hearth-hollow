'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Theme settings moved into the consolidated Settings page as a tab.
// This route is kept so old links/bookmarks still land somewhere useful.
export default function ThemePageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/settings');
  }, [router]);
  return null;
}
