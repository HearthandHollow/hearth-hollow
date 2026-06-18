'use client';

import { useEffect, useState, useCallback } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

  const close = useCallback(() => setActiveIndex(null), []);
  const showPrev = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length]
  );
  const showNext = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, close, showPrev, showNext]);

  const active = activeIndex !== null ? images[activeIndex] : null;

  return (
    <div className="min-h-screen bg-themeBg py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-brandDark">Our Work</h1>
        <p className="text-themeMuted mb-8">A look at recent projects from The Hearth &amp; Hollow.</p>

        {loading ? (
          <p className="text-themeMuted">Loading…</p>
        ) : images.length === 0 ? (
          <p className="text-themeMuted">Photos coming soon — check back shortly.</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            {images.map((img, idx) => (
              <figure
                key={img.id}
                className="mb-4 bg-white rounded-lg shadow-md overflow-hidden break-inside-avoid cursor-zoom-in"
                onClick={() => setActiveIndex(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || 'Project photo'}
                  className="w-full h-auto block"
                  loading="lazy"
                />
                {img.caption && (
                  <figcaption className="p-3 text-sm text-themeMuted">{img.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-4"
          onClick={close}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:opacity-75"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            &times;
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white text-4xl leading-none px-3 py-2 hover:opacity-75"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
              >
                &#8249;
              </button>
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white text-4xl leading-none px-3 py-2 hover:opacity-75"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
              >
                &#8250;
              </button>
            </>
          )}

          <div className="max-w-5xl max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.caption || 'Project photo'}
              className="max-h-[85vh] max-w-full object-contain rounded"
            />
            {active.caption && <p className="text-white text-sm mt-3 text-center">{active.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
