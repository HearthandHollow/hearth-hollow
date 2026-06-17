'use client';

import { useEffect, useState } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/gallery');
        const data = await res.json();
        setImages(data.images || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-themeBg py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-brandDark">Our Work</h1>
        <p className="text-themeMuted mb-8">A look at recent projects from The Hearth &amp; Hollow.</p>

        {loading ? (
          <p className="text-themeMuted">Loading…</p>
        ) : images.length === 0 ? (
          <p className="text-themeMuted">Photos coming soon — check back shortly.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img) => (
              <figure key={img.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || 'Project photo'} className="w-full h-56 object-cover" />
                {img.caption && (
                  <figcaption className="p-3 text-sm text-themeMuted">{img.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
