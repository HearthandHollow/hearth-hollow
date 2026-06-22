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
  const [searchQuery, setSearchQuery] = useState('');
  const [siteName, setSiteName] = useState('Hearth & Hollow');
  const router = useRouter();

  useEffect(() => {
    fetchQuotes();
    // Pull the configured site name from theme settings so the dashboard
    // header matches the rest of the site instead of a hardcoded title.
    fetch('/api/theme')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.siteName) setSiteName(d.siteName);
      })
      .catch(() => {
        /* keep fallback */
      });
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

  // Filter quotes by search query
  const getSearchResults = (quotes: Quote[]) => {
    if (!searchQuery.trim()) return quotes;

    const query = searchQuery.toLowerCase().trim();
    return quotes.filter(q => {
      const name = q.customer?.name?.toLowerCase() || '';
      const email = q.customer?.email?.toLowerCase() || '';
      const phone = q.customer?.phone?.toLowerCase() || '';
      const location = q.description?.toLowerCase() || '';

      return (
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        location.includes(query)
      );
    });
  };

  // Filter quotes by tab
  const getQuotesByStatus = (status: TabType) => {
    const filtered = allQuotes.filter(q => q.approvalStatus === status);
    return getSearchResults(filtered);
  };

  // Get all quotes matching search (across all tabs)
  const getSearchedQuotes = () => {
    return getSearchResults(allQuotes);
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

  // Determine which quotes to display
  const currentQuotes = searchQuery.trim() ? getSearchedQuotes() : getQuotesByStatus(activeTab);

  const quoteCounts = {
    awaiting_analysis: getQuotesByStatus('awaiting_analysis').length,
    awaiting_client_approval: getQuotesByStatus('awaiting_client_approval').length,
    active: getQuotesByStatus('active').length,
    denied: getQuotesByStatus('denied').length,
  };

  return (
    <div className="min-h-screen bg-themeBg">
      {/* Header */}
      <div className="bg-white border-b border-themeBorder px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brandDark">{siteName}</h1>
          <p className="text-themeMuted">Admin Dashboard</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:mr-14">
          <Link
            href="/admin/settings"
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-brand hover:bg-brandDark text-white rounded-lg"
          >
            ⚙️ Settings
          </Link>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <input
              type="text"
              placeholder="Search quotes by email, name, phone, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-themeBorder rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            {searchQuery && (
              <div className="mt-2 text-sm text-themeMuted">
                Found {currentQuotes.length} quote{currentQuotes.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className={`bg-white rounded-lg shadow mb-6 border-b border-themeBorder overflow-x-auto ${searchQuery ? 'opacity-60' : ''}`}>
          <div className="flex min-w-max sm:min-w-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!!searchQuery}
                className={`flex-shrink-0 sm:flex-1 whitespace-nowrap px-4 sm:px-6 py-3 sm:py-4 text-center text-sm sm:text-base font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-brand text-brandDark bg-amber-50'
                    : 'border-transparent text-themeMuted hover:text-themeText'
                } ${searchQuery ? 'cursor-not-allowed' : ''}`}
              >
                <span className="text-lg mr-2">{tab.icon}</span>
                {tab.label}
                <span className="ml-2 inline-block px-2 py-1 text-xs font-semibold bg-gray-200 text-themeMuted rounded-full">
                  {quoteCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {searchQuery && (
          <div className="bg-blue-50 border border-accent text-accent px-4 py-3 rounded-lg mb-6 text-sm">
            Showing search results from all tabs. Clear the search to return to the selected tab.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {selectedQuotes.size > 0 && (
          <div className="bg-blue-50 border border-accent rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <div className="text-sm font-semibold text-accent">
                {selectedQuotes.size} quote{selectedQuotes.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkMove(e.target.value as TabType);
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionInProgress}
                  className="px-3 py-2 bg-white border border-accent rounded text-sm font-medium text-accent hover:bg-blue-100 disabled:opacity-50"
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
                  className="px-4 py-2 bg-gray-400 text-white rounded text-sm font-medium hover:bg-themeBg0 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-themeMuted">Loading quotes...</p>
          </div>
        ) : currentQuotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-themeMuted text-lg">No quotes in this category</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentQuotes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedQuotes.size === currentQuotes.length && currentQuotes.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded border-themeBorder"
                />
                <span className="text-sm text-themeMuted">
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
                    className="w-5 h-5 rounded border-themeBorder mt-4 flex-shrink-0"
                  />
                  <Link
                    href={`/admin/quotes/${quote.id}`}
                    className="block flex-1 min-w-0 bg-white rounded-lg shadow hover:shadow-lg transition p-4"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-themeText break-words">
                              {quote.customer?.name || 'Unknown Customer'}
                            </h3>
                            <p className="text-sm text-themeMuted mt-1 break-words">
                              <strong>{quote.category}</strong> • {quote.customer?.email}
                            </p>
                            <p className="text-sm text-themeMuted line-clamp-2 mt-2">
                              {quote.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="sm:ml-6 sm:text-right">
                        {quote.estimate && (
                          <div className="mb-3">
                            <p className="text-sm text-themeMuted">Estimated Cost</p>
                            <p className="text-lg font-bold text-brand">
                              ${quote.estimate.expectedEstimate.toLocaleString()}
                            </p>
                          </div>
                        )}

                        <div className="text-xs text-themeMuted space-y-1">
                          <p>Quote #{quote.id.substring(0, 8)}</p>
                          <p>{new Date(quote.createdAt).toLocaleDateString()}</p>
                          {quote.emailSentAt && (
                            <p className="text-brand">
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
