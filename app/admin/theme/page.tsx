'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ThemeSettings {
  id?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  backgroundColor: string;
  borderColor: string;
  fontFamily: string;
  headingFont: string;
  siteName: string;
  siteDescription: string;
}

export default function ThemePage() {
  const [theme, setTheme] = useState<ThemeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    try {
      const response = await fetch('/api/admin/theme');
      if (response.status === 401) {
        router.push('/admin');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch theme');
      const data = await response.json();
      setTheme(data);
    } catch (err) {
      setError('Failed to load theme settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!theme) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });

      if (!response.ok) throw new Error('Failed to save theme');
      setSuccess('Theme settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (field: string, value: string) => {
    if (theme) {
      setTheme({ ...theme, [field]: value });
    }
  };

  const handleTextChange = (field: string, value: string) => {
    if (theme) {
      setTheme({ ...theme, [field]: value });
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Reset all theme settings to defaults?')) {
      setTheme({
        primaryColor: '#b45309',
        secondaryColor: '#78350f',
        accentColor: '#ea580c',
        textPrimary: '#1f2937',
        textSecondary: '#6b7280',
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        headingFont: 'system-ui, -apple-system, sans-serif',
        siteName: 'Hearth & Hollow',
        siteDescription: 'Custom handyman and carpentry services',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-themeMuted">Loading theme settings...</p>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-red-600">Failed to load theme settings</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-themeBg">
      {/* Header */}
      <div className="bg-white border-b border-themeBorder px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-themeText">Theme Customizer</h1>
          <p className="text-themeMuted">Customize your website's appearance</p>
        </div>
        <Link
          href="/admin/dashboard"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg self-start sm:self-auto"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Color Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Branding */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Branding</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Site Name</label>
                  <input
                    type="text"
                    value={theme.siteName}
                    onChange={(e) => handleTextChange('siteName', e.target.value)}
                    className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Site Description</label>
                  <input
                    type="text"
                    value={theme.siteDescription}
                    onChange={(e) => handleTextChange('siteDescription', e.target.value)}
                    className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Colors</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Primary Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#b45309"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Buttons, links, headers</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Secondary Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#78350f"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Backgrounds, accents</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Accent Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#ea580c"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Highlights, emphasis</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Border Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.borderColor}
                      onChange={(e) => handleColorChange('borderColor', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.borderColor}
                      onChange={(e) => handleColorChange('borderColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#e5e7eb"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Dividers, borders</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Background Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#f9fafb"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Page background</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Text Primary Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.textPrimary}
                      onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.textPrimary}
                      onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#1f2937"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Main text color</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Text Secondary Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={theme.textSecondary}
                      onChange={(e) => handleColorChange('textSecondary', e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.textSecondary}
                      onChange={(e) => handleColorChange('textSecondary', e.target.value)}
                      className="flex-1 px-4 py-2 border border-themeBorder rounded-lg"
                      placeholder="#6b7280"
                    />
                  </div>
                  <p className="text-xs text-themeMuted mt-1">Secondary text, labels</p>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Typography</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Body Font Family</label>
                  <input
                    type="text"
                    value={theme.fontFamily}
                    onChange={(e) => handleTextChange('fontFamily', e.target.value)}
                    className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                    placeholder="system-ui, -apple-system, sans-serif"
                  />
                  <p className="text-xs text-themeMuted mt-1">CSS font stack for body text</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Heading Font Family</label>
                  <input
                    type="text"
                    value={theme.headingFont}
                    onChange={(e) => handleTextChange('headingFont', e.target.value)}
                    className="w-full px-4 py-2 border border-themeBorder rounded-lg"
                    placeholder="system-ui, -apple-system, sans-serif"
                  />
                  <p className="text-xs text-themeMuted mt-1">CSS font stack for headings</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-bold mb-4">Preview</h2>

              {/* Preview Box */}
              <div
                className="rounded-lg p-6 mb-4"
                style={{ backgroundColor: theme.backgroundColor }}
              >
                <div style={{ color: theme.textPrimary, fontFamily: theme.headingFont }}>
                  <h3 className="text-2xl font-bold mb-2">{theme.siteName}</h3>
                  <p style={{ color: theme.textSecondary, fontFamily: theme.fontFamily }}>
                    {theme.siteDescription}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    style={{ backgroundColor: theme.primaryColor }}
                    className="w-full py-2 px-4 text-white rounded-lg font-medium"
                  >
                    Primary Button
                  </button>
                  <button
                    style={{ backgroundColor: theme.accentColor }}
                    className="w-full py-2 px-4 text-white rounded-lg font-medium"
                  >
                    Accent Button
                  </button>
                </div>

                <div className="mt-4 p-4 rounded" style={{ backgroundColor: theme.secondaryColor }}>
                  <p style={{ color: '#ffffff' }} className="text-sm">
                    Secondary section example
                  </p>
                </div>
              </div>

              {/* Color Swatches */}
              <div className="space-y-2 mb-6">
                <p className="text-xs font-semibold text-themeMuted uppercase">Color Palette</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Primary', color: theme.primaryColor },
                    { name: 'Secondary', color: theme.secondaryColor },
                    { name: 'Accent', color: theme.accentColor },
                    { name: 'Text', color: theme.textPrimary },
                    { name: 'Border', color: theme.borderColor },
                    { name: 'BG', color: theme.backgroundColor },
                  ].map((item) => (
                    <div key={item.name}>
                      <div
                        className="w-full h-12 rounded-lg border border-themeBorder"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="text-xs text-center mt-1">{item.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={resetToDefaults}
                  className="w-full px-4 py-2 bg-gray-300 text-themeText rounded-lg hover:bg-gray-400 font-medium"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
