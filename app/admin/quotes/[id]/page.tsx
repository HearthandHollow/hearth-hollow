'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Quote {
  id: string;
  customerId: string;
  category: string;
  location: string;
  timeline: string;
  description: string;
  status: string;
  createdAt: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  uploadedAssets?: Array<{
    id: string;
    filename: string;
    s3Url: string;
    mimeType: string;
  }>;
  estimate?: {
    id: string;
    lowEstimate: number;
    expectedEstimate: number;
    highEstimate: number;
    breakdown: string;
    confidence: number;
  };
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    description: '',
    category: '',
    location: '',
    timeline: '',
  });

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`);
      if (response.status === 401) {
        router.push('/admin');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch quote');
      const data = await response.json();
      setQuote(data);
      setEditData({
        description: data.description,
        category: data.category,
        location: data.location,
        timeline: data.timeline,
      });
    } catch (err) {
      setError('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/analyze`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze quote');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveEdits = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!response.ok) throw new Error('Failed to save changes');
      const data = await response.json();
      setQuote(data);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleSendEstimate = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send estimate');
      const data = await response.json();
      setQuote(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send estimate');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-gray-500">Loading quote...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-red-600">Quote not found</p>
      </div>
    );
  }

  const CATEGORIES = [
    "General Carpentry",
    "Furniture Building",
    "Deck Repair/Building",
    "Fence Building",
    "Wall Repair",
    "Welding",
    "Installation",
    "Other",
  ];

  const TIMELINES = [
    "ASAP",
    "1-2 weeks",
    "2-4 weeks",
    "1-2 months",
    "Flexible",
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Quote Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Quote #{quote.id.substring(0, 8)}</h1>
              <p className="text-gray-600">Status: <span className="font-semibold capitalize">{quote.status}</span></p>
            </div>
            {quote.status !== 'sent' && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Details'}
              </button>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold mb-4">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold">{quote.customer?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{quote.customer?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{quote.customer?.phone}</p>
            </div>
          </div>
        </div>

        {/* Project Details - Edit Mode */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6 border-2 border-blue-300">
            <h2 className="text-xl font-bold mb-4">Edit Project Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Category</label>
                <select
                  value={editData.category}
                  onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Location</label>
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Timeline</label>
                <select
                  value={editData.timeline}
                  onChange={(e) => setEditData({ ...editData, timeline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Timeline</option>
                  {TIMELINES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleSaveEdits}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Project Details - View Mode */}
        {!isEditing && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Project Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <p className="font-semibold">{quote.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold">{quote.location || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Timeline</p>
                <p className="font-semibold">{quote.timeline || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-gray-700 whitespace-pre-wrap mt-1">{quote.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded Photos */}
        {quote.uploadedAssets && quote.uploadedAssets.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Photos ({quote.uploadedAssets.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quote.uploadedAssets.map((asset) => (
                <div key={asset.id} className="relative overflow-hidden rounded-lg bg-gray-200 group">
                  {asset.mimeType.startsWith('image/') ? (
                    <>
                      <img
                        src={asset.s3Url}
                        alt={asset.filename}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          console.error('Image load error:', asset.s3Url);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <a
                        href={asset.s3Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition"
                      >
                        Open
                      </a>
                    </>
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                      <span className="text-gray-500 text-sm">Not an image</span>
                    </div>
                  )}
                  <p className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 truncate">
                    {asset.filename}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimate Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">AI Analysis</h2>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || isEditing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              {analyzing ? 'Analyzing...' : quote.estimate ? 'Re-Analyze' : 'Analyze'}
            </button>
          </div>

          {quote.estimate ? (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Low Estimate</p>
                  <p className="text-2xl font-bold text-blue-600">${quote.estimate.lowEstimate.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Expected</p>
                  <p className="text-2xl font-bold text-green-600">${quote.estimate.expectedEstimate.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">High Estimate</p>
                  <p className="text-2xl font-bold text-red-600">${quote.estimate.highEstimate.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Breakdown</p>
                <p className="text-gray-600 whitespace-pre-wrap text-sm">{quote.estimate.breakdown}</p>
              </div>

              {quote.status !== 'sent' && (
                <button
                  onClick={handleSendEstimate}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Send Estimate to Customer
                </button>
              )}

              {quote.status === 'sent' && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-700 text-center font-semibold">
                  ✅ Estimate sent to customer
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">No analysis yet. Click "Analyze" to generate an estimate.</p>
          )}
        </div>
      </div>
    </div>
  );
}
