'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quote {
  id: string;
  customerId: string;
  category: string;
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
  estimate?: {
    lowEstimate: number;
    expectedEstimate: number;
    highEstimate: number;
  };
}

type TabType = 'awaiting_analysis' | 'awaiting_client_approval' | 'active' | 'denied';

export default function AdminDashboard() {
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('awaiting_analysis');
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const response = await fetch('/api/admin/quotes');
      if (response.status === 401) {
        router.push('/admin');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch quotes');
      const data = await response.json();

      // Flatten all quotes from profiles
      const quotes = data.profiles?.flatMap((p: any) =>
        p.quotes.map((q: any) => ({ ...q, customer: p }))
      ) || [];

      setAllQuotes(quotes);
    } catch (err) {
      setError('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  // Filter quotes by tab
  const getQuotesByStatus = (status: TabType) => {
    return allQuotes.filter(q => q.approvalStatus === status);
  };

  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  };

  const toggleQuoteSelection = (quoteId: string) => {
    const newSelected = new Set(selectedQuotes);
    if (newSelected.has(quoteId)) {
      newSelected.delete(quoteId);
    } else {
      newSelected.add(quoteId);
    }
    setSelectedQuotes(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedQuotes.size === currentQuotes.length) {
      setSelectedQuotes(new Set());
    } else {
      setSelectedQuotes(new Set(currentQuotes.map(q => q.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedQuotes.size} quote(s)? This action cannot be undone.`)) {
      return;
    }

    setBulkActionInProgress(true);
    try {
      const response = await fetch('/api/admin/bulk-actions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteIds: Array.from(selectedQuotes) }),
      });

      if (!response.ok) throw new Error('Failed to delete quotes');
      await fetchQuotes();
      setSelectedQuotes(new Set());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quotes');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkMove = async (newStatus: TabType) => {
    setBulkActionInProgress(true);
    try {
      const response = await fetch('/api/admin/bulk-actions/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteIds: Array.from(selectedQuotes),
          status: newStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to move quotes');
      await fetchQuotes();
      setSelectedQuotes(new Set());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move quotes');
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'awaiting_analysis', label: 'Awaiting Analysis', icon: '⏳' },
    { id: 'awaiting_client_approval', label: 'Waiting Client Approval', icon: '⏱️' },
    { id: 'active', label: 'Active Jobs', icon: '✓' },
    { id: 'denied', label: 'Denied Quotes', icon: '✕' },
  ];

  const currentQuotes = getQuotesByStatus(activeTab);
  const quoteCounts = {
    awaiting_analysis: getQuotesByStatus('awaiting_analysis').length,
    awaiting_client_approval: getQuotesByStatus('awaiting_client_approval').length,
    active: getQuotesByStatus('active').length,
    denied: getQuotesByStatus('denied').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">Hearth & Hollow</h1>
          <p className="text-gray-600">Admin Dashboard</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6 border-b border-gray-200">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-center font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-amber-600 text-amber-900 bg-amber-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="text-lg mr-2">{tab.icon}</span>
                {tab.label}
                <span className="ml-2 inline-block px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded-full">
                  {quoteCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {selectedQuotes.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-4 mb-6">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold text-blue-900">
                {selectedQuotes.size} quote{selectedQuotes.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkMove(e.target.value as TabType);
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionInProgress}
                  className="px-3 py-2 bg-white border border-blue-300 rounded text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50"
                >
                  <option value="">Move to...</option>
                  <option value="awaiting_analysis">⏳ Awaiting Analysis</option>
                  <option value="awaiting_client_approval">⏱️ Waiting Client Approval</option>
                  <option value="active">✓ Active Jobs</option>
                  <option value="denied">✕ Denied Quotes</option>
                </select>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionInProgress}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkActionInProgress ? 'Deleting...' : 'Delete Selected'}
                </button>
                <button
                  onClick={() => setSelectedQuotes(new Set())}
                  disabled={bulkActionInProgress}
                  className="px-4 py-2 bg-gray-400 text-white rounded text-sm font-medium hover:bg-gray-500 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading quotes...</p>
          </div>
        ) : currentQuotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No quotes in this category</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentQuotes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedQuotes.size === currentQuotes.length && currentQuotes.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  {selectedQuotes.size === currentQuotes.length && currentQuotes.length > 0
                    ? 'All selected'
                    : `Select all ${currentQuotes.length}`}
                </span>
              </div>
            )}
            {currentQuotes
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map(quote => (
                <div key={quote.id} className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={selectedQuotes.has(quote.id)}
                    onChange={() => toggleQuoteSelection(quote.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-gray-300 mt-4 flex-shrink-0"
                  />
                  <Link
                    href={`/admin/quotes/${quote.id}`}
                    className="block flex-1 bg-white rounded-lg shadow hover:shadow-lg transition p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {quote.customer?.name || 'Unknown Customer'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              <strong>{quote.category}</strong> • {quote.customer?.email}
                            </p>
                            <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                              {quote.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-6 text-right">
                        {quote.estimate && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-600">Estimated Cost</p>
                            <p className="text-lg font-bold text-amber-600">
                              ${quote.estimate.expectedEstimate.toLocaleString()}
                            </p>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Quote #{quote.id.substring(0, 8)}</p>
                          <p>{new Date(quote.createdAt).toLocaleDateString()}</p>
                          {quote.emailSentAt && (
                            <p className="text-amber-600">
                              Sent: {new Date(quote.emailSentAt).toLocaleDateString()}
                            </p>
                          )}
                          {quote.clientApprovedAt && (
                            <p className="text-green-600">
                              Approved: {new Date(quote.clientApprovedAt).toLocaleDateString()}
                            </p>
                          )}
                          {quote.clientDeniedAt && (
                            <p className="text-red-600">
                              Denied: {new Date(quote.clientDeniedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
