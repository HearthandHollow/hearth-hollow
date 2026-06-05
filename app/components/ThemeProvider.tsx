'use client';

import { useEffect } from 'react';

interface ThemeSettings {
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

export function ThemeProvider() {
  useEffect(() => {
    const fetchAndApplyTheme = async () => {
      try {
        const response = await fetch('/api/theme');
        if (!response.ok) throw new Error('Failed to fetch theme');
        const theme: ThemeSettings = await response.json();

        // Apply CSS variables to document root
        const root = document.documentElement;
        root.style.setProperty('--color-primary', theme.primaryColor);
        root.style.setProperty('--color-secondary', theme.secondaryColor);
        root.style.setProperty('--color-accent', theme.accentColor);
        root.style.setProperty('--color-text-primary', theme.textPrimary);
        root.style.setProperty('--color-text-secondary', theme.textSecondary);
        root.style.setProperty('--color-background', theme.backgroundColor);
        root.style.setProperty('--color-border', theme.borderColor);
        root.style.setProperty('--font-body', theme.fontFamily);
        root.style.setProperty('--font-heading', theme.headingFont);

        // Also store in localStorage for faster subsequent loads
        localStorage.setItem('theme', JSON.stringify(theme));
      } catch (error) {
        console.error('Failed to load theme:', error);

        // Try to load from localStorage as fallback
        const cached = localStorage.getItem('theme');
        if (cached) {
          try {
            const theme: ThemeSettings = JSON.parse(cached);
            const root = document.documentElement;
            root.style.setProperty('--color-primary', theme.primaryColor);
            root.style.setProperty('--color-secondary', theme.secondaryColor);
            root.style.setProperty('--color-accent', theme.accentColor);
            root.style.setProperty('--color-text-primary', theme.textPrimary);
            root.style.setProperty('--color-text-secondary', theme.textSecondary);
            root.style.setProperty('--color-background', theme.backgroundColor);
            root.style.setProperty('--color-border', theme.borderColor);
            root.style.setProperty('--font-body', theme.fontFamily);
            root.style.setProperty('--font-heading', theme.headingFont);
          } catch (e) {
            console.error('Failed to parse cached theme:', e);
          }
        }
      }
    };

    fetchAndApplyTheme();

    // Refresh theme every 30 seconds to catch admin changes
    const interval = setInterval(fetchAndApplyTheme, 30000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
