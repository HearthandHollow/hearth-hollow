'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeSettingsTab from './ThemeSettings';
import AvailabilitySettingsTab from './AvailabilitySettings';
import GallerySettingsTab from './GallerySettings';
import NotificationsSettings from './NotificationsSettings';

type Tab = 'theme' | 'availability' | 'gallery' | 'notifications';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'theme', label: 'Theme', icon: '🎨' },
  { key: 'availability', label: 'Availability', icon: '📅' },
  { key: 'gallery', label: 'Gallery', icon: '🖼️' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('theme');

  return (
    <div className="min-h-screen bg-themeBg">
      {/* Header */}
      <div className="bg-white border-b border-themeBorder px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-themeText">Settings</h1>
          <p className="text-themeMuted">Theme, availability, gallery, and notifications</p>
        </div>
        <Link
          href="/admin/dashboard"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg self-start sm:self-auto sm:mr-14"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-themeBorder px-3 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 max-w-6xl mx-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                tab === t.key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-themeMuted hover:text-themeText'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {tab === 'theme' && <ThemeSettingsTab />}
        {tab === 'availability' && <AvailabilitySettingsTab />}
        {tab === 'gallery' && <GallerySettingsTab />}
        {tab === 'notifications' && <NotificationsSettings />}
      </div>
    </div>
  );
}
