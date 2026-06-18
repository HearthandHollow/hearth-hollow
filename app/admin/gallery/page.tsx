'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
}

export default function AdminGalleryPage() {
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadImages = async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      setImages(data.images || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caption', caption);
      const res = await fetch('/api/admin/gallery', { method: 'POST', body: fd });
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setFile(null);
      setCaption('');
      (document.getElementById('gallery-file') as HTMLInputElement | null)?.value &&
        ((document.getElementById('gallery-file') as HTMLInputElement).value = '');
      await loadImages();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this image from the gallery?')) return;
    try {
      const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-themeBg py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-1">Gallery</h1>
          <p className="text-themeMuted mb-6 text-sm">
            Upload photos of past work. These appear on your public gallery page (/gallery), newest first.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Image</label>
              <input
                id="gallery-file"
                type="file"
                accept="image/*,.heic,.heif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Caption (optional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g., Custom cedar deck — Greensboro"
                className="w-full px-3 py-2 border border-themeBorder rounded-lg"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="px-5 py-2 bg-brand text-white rounded-lg hover:bg-brandDark disabled:opacity-50 font-semibold"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-bold mb-4">Current photos ({images.length})</h2>
          {loading ? (
            <p className="text-themeMuted">Loading…</p>
          ) : images.length === 0 ? (
            <p className="text-themeMuted">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="border border-themeBorder rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption || 'Project'} className="w-full h-36 object-cover" />
                  <div className="p-2">
                    {img.caption && <p className="text-xs text-themeMuted mb-2 line-clamp-2">{img.caption}</p>}
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
