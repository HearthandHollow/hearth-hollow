'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

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
  assets?: Array<{
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
    } catch (err) {
      setError('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/analyze`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setQuote(data);
    } catch (err) {
      setError('Failed to analyze quote');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSendEstimate = async () => {
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send estimate');
      setQuote({ ...quote!, status: 'sent' });
    } catch (err) {
      setError('Failed to send estimate');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-amber-600 hover:text-amber-700 mb-4"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {quote.customer?.name}
              </h1>
              <p className="text-gray-600 mt-1">{quote.customer?.email}</p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                quote.status === 'submitted'
                  ? 'bg-blue-100 text-blue-800'
                  : quote.status === 'analyzed'
                  ? 'bg-green-100 text-green-800'
                  : quote.status === 'sent'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {quote.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Project Details
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {quote.category}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {quote.location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Timeline</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {quote.timeline || 'Flexible'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-gray-900 mt-2">{quote.description}</p>
                </div>
              </div>
            </div>

            {/* Photos */}
            {quote.assets && quote.assets.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Photos ({quote.assets.length})
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {quote.assets.map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-75 transition"
                    >
                      {asset.mimeType.startsWith('image') ? (
                        <Image
                          src={asset.s3Url}
                          alt={asset.filename}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-center text-sm text-gray-600">
                            {asset.filename}
                          </p>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Estimate */}
            {quote.estimate && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  AI Analysis
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Low Estimate</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${quote.estimate.lowEstimate.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expected</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ${quote.estimate.expectedEstimate.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">High Estimate</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ${quote.estimate.highEstimate.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Confidence</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${quote.estimate.confidence * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {(quote.estimate.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Breakdown</p>
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {quote.estimate.breakdown}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {!quote.estimate && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition"
                  >
                    {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                  </button>
                )}

                {quote.estimate && quote.status !== 'sent' && (
                  <button
                    onClick={handleSendEstimate}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Send Estimate to Customer
                  </button>
                )}

                {quote.status === 'sent' && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                    ✓ Estimate sent to customer
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Contact Info
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Email</p>
                <a
                  href={`mailto:${quote.customer?.email}`}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {quote.customer?.email}
                </a>
                <p className="text-sm text-gray-600 mt-4">Phone</p>
                <a
                  href={`tel:${quote.customer?.phone}`}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {quote.customer?.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
