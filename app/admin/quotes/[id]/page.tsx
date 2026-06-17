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
  approvalStatus: string;
  createdAt: string;
  emailSentAt?: string;
  clientApprovedAt?: string;
  clientDeniedAt?: string;
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
    materialRequirements?: string;
    timeEstimation?: string;
    isEdited?: boolean;
  };
}

interface AssetWithSignedUrl {
  id: string;
  filename: string;
  s3Url: string;
  mimeType: string;
  signedUrl?: string;
  signedUrlError?: string;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [assetsWithUrls, setAssetsWithUrls] = useState<AssetWithSignedUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingEstimate, setIsEditingEstimate] = useState(false);
  const [editData, setEditData] = useState({
    description: '',
    category: '',
    location: '',
    timeline: '',
  });
  const [estimateEditData, setEstimateEditData] = useState({
    lowEstimate: 0,
    expectedEstimate: 0,
    highEstimate: 0,
    breakdown: '',
    materialRequirements: '',
    timeEstimation: '',
  });
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [changingStatus, setChangingStatus] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(false);

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

      // Initialize estimate edit data
      if (data.estimate) {
        setEstimateEditData({
          lowEstimate: data.estimate.lowEstimate,
          expectedEstimate: data.estimate.expectedEstimate,
          highEstimate: data.estimate.highEstimate,
          breakdown: data.estimate.breakdown,
          materialRequirements: data.estimate.materialRequirements || '',
          timeEstimation: data.estimate.timeEstimation || '',
        });
      }

      // Generate signed URLs for assets
      if (data.uploadedAssets && data.uploadedAssets.length > 0) {
        const withUrls = await Promise.all(
          data.uploadedAssets.map(async (asset: any) => {
            try {
              const signResponse = await fetch(`/api/admin/quotes/${quoteId}/get-signed-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3Key: asset.s3Url }),
              });

              if (signResponse.ok) {
                const { signedUrl } = await signResponse.json();
                return { ...asset, signedUrl };
              } else {
                return { ...asset, signedUrlError: 'Failed to generate signed URL' };
              }
            } catch (err) {
              console.error('Error generating signed URL:', err);
              return { ...asset, signedUrlError: String(err) };
            }
          })
        );

        setAssetsWithUrls(withUrls);
      }
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includePhotos }),
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

  const handleImageError = (assetId: string) => {
    setImageLoadErrors(prev => ({ ...prev, [assetId]: true }));
  };

  const handleDeleteQuote = async () => {
    if (!window.confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/delete`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete quote');
      setError('');
      // Redirect to dashboard after successful deletion
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quote');
    }
  };

  const handleSaveEstimate = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/estimate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimateEditData),
      });
      if (!response.ok) throw new Error('Failed to save estimate');
      const data = await response.json();
      setQuote(prev => prev ? { ...prev, estimate: data } : null);
      setIsEditingEstimate(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save estimate');
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    setChangingStatus(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      const data = await response.json();
      setQuote(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setChangingStatus(false);
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Quote #{quote.id.substring(0, 8)}</h1>
              <p className="text-gray-600">Status: <span className="font-semibold capitalize">{quote.status}</span></p>
            </div>
            <div className="flex gap-2">
              {quote.status !== 'sent' && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Details'}
                </button>
              )}
              <button
                onClick={handleDeleteQuote}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Quote
              </button>
            </div>
          </div>

          {/* Approval Status Section */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Approval Status: <span className="capitalize">{quote.approvalStatus?.replace('_', ' ')}</span></p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleChangeStatus('awaiting_analysis')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'awaiting_analysis'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ⏳ Awaiting Analysis
              </button>
              <button
                onClick={() => handleChangeStatus('awaiting_client_approval')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'awaiting_client_approval'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ⏱️ Waiting Client Approval
              </button>
              <button
                onClick={() => handleChangeStatus('active')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ✓ Active Job
              </button>
              <button
                onClick={() => handleChangeStatus('denied')}
                disabled={changingStatus}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  quote.approvalStatus === 'denied'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ✕ Denied Quote
              </button>
            </div>
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
        {assetsWithUrls && assetsWithUrls.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Uploaded Files ({assetsWithUrls.length})</h2>
            <div className="space-y-3">
              {assetsWithUrls.map((asset) => {
                const hasError = imageLoadErrors[asset.id];
                const displayUrl = asset.signedUrl || asset.s3Url;
                
                return (
                  <div key={asset.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{asset.filename}</p>
                        <p className="text-xs text-gray-500 mt-1">Type: {asset.mimeType}</p>
                        {asset.signedUrlError && (
                          <p className="text-xs text-red-600 mt-1">Error: {asset.signedUrlError}</p>
                        )}
                      </div>
                      <div className="ml-4 flex gap-2">
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Open
                        </a>
                        <a
                          href={displayUrl}
                          download
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                    
                    {/* Try to show image preview */}
                    {asset.mimeType.startsWith('image/') && !hasError && asset.signedUrl && (
                      <div className="mt-3">
                        <img
                          src={asset.signedUrl}
                          alt={asset.filename}
                          className="max-w-xs h-auto rounded border border-gray-300"
                          onError={() => handleImageError(asset.id)}
                        />
                      </div>
                    )}
                    
                    {hasError && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                        ⚠️ Image preview failed to load.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estimate Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">AI Analysis {quote.estimate?.isEdited && <span className="text-sm text-amber-600">(Edited)</span>}</h2>
            <div className="flex gap-2">
              {quote.estimate && !isEditingEstimate && (
                <button
                  onClick={() => setIsEditingEstimate(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold"
                >
                  Edit Estimate
                </button>
              )}
              {assetsWithUrls.some((a) => a.mimeType?.startsWith('image/')) && (
                <label className="flex items-center gap-2 text-sm text-gray-700 select-none mr-2">
                  <input
                    type="checkbox"
                    checked={includePhotos}
                    onChange={(e) => setIncludePhotos(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Include photos
                </label>
              )}
              <button
                onClick={handleAnalyze}
                disabled={analyzing || isEditing || isEditingEstimate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {analyzing ? 'Analyzing...' : quote.estimate ? 'Re-Analyze' : 'Analyze'}
              </button>
            </div>
          </div>

          {isEditingEstimate && quote.estimate && (
            <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-amber-900">Edit Estimate Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Low Estimate ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.lowEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, lowEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Expected Cost ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.expectedEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, expectedEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">High Estimate ($)</label>
                    <input
                      type="number"
                      value={estimateEditData.highEstimate}
                      onChange={(e) => setEstimateEditData({ ...estimateEditData, highEstimate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Time Estimation</label>
                  <input
                    type="text"
                    placeholder="e.g., '3-5 days', '1-2 weeks'"
                    value={estimateEditData.timeEstimation}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, timeEstimation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Material Requirements</label>
                  <textarea
                    placeholder="List of materials needed for this project"
                    value={estimateEditData.materialRequirements}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, materialRequirements: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Breakdown</label>
                  <textarea
                    value={estimateEditData.breakdown}
                    onChange={(e) => setEstimateEditData({ ...estimateEditData, breakdown: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEstimate}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingEstimate(false)}
                    className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {quote.estimate && !isEditingEstimate && (
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

              {quote.estimate.timeEstimation && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Timeline</p>
                  <p className="text-gray-600">{quote.estimate.timeEstimation}</p>
                </div>
              )}

              {quote.estimate.materialRequirements && (
                <div className="bg-purple-50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Materials Required</p>
                  <p className="text-gray-600 whitespace-pre-wrap text-sm">{quote.estimate.materialRequirements}</p>
                </div>
              )}

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
          )}

          {!quote.estimate && (
            <p className="text-gray-600">No analysis yet. Click "Analyze" to generate an estimate.</p>
          )}
        </div>
      </div>
    </div>
  );
}
