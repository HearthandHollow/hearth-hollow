'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quote {
  id: string;
  customerId: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface CustomerProfile {
  email: string;
  name: string;
  phone: string;
  quoteCount: number;
  quotes: Quote[];
  lastQuoteDate: string;
  statuses: {
    submitted: number;
    analyzed: number;
    sent: number;
  };
}

export default function AdminDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
      setQuotes(data);
    } catch (err) {
      setError('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  // Group quotes by email and create customer profiles
  const customerProfiles = useMemo(() => {
    const profiles: Record<string, CustomerProfile> = {};

    quotes.forEach((quote) => {
      const email = quote.customer?.email || 'unknown';
      if (!profiles[email]) {
        profiles[email] = {
          email,
          name: quote.customer?.name || 'Unknown',
          phone: quote.customer?.phone || '',
          quoteCount: 0,
          quotes: [],
          lastQuoteDate: '',
          statuses: { submitted: 0, analyzed: 0, sent: 0 },
        };
      }

      profiles[email].quoteCount++;
      profiles[email].quotes.push(quote);
      profiles[email].lastQuoteDate = quote.createdAt;

      // Count statuses
      const status = quote.status as keyof typeof profiles[email]['statuses'];
      if (status in profiles[email].statuses) {
        profiles[email].statuses[status]++;
      }
    });

    return Object.values(profiles);
  }, [quotes]);

  // Filter profiles based on search
  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return customerProfiles;

    const term = searchTerm.toLowerCase();
    return customerProfiles.filter(
      (profile) =>
        profile.email.toLowerCase().includes(term) ||
        profile.name.toLowerCase().includes(term) ||
        profile.phone.toLowerCase().includes(term)
    );
  }, [customerProfiles, searchTerm]);

  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'analyzed':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-amber-900">
            Hearth & Hollow
          </h1>
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
      <div className="max-w-7xl mx-auto p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by email, name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border-0 focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Customers</p>
            <p className="text-3xl font-bold text-gray-900">
              {filteredProfiles.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Quotes</p>
            <p className="text-3xl font-bold text-gray-900">
              {filteredProfiles.reduce((sum, p) => sum + p.quoteCount, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Pending Analysis</p>
            <p className="text-3xl font-bold text-blue-600">
              {filteredProfiles.reduce(
                (sum, p) => sum + p.statuses.submitted,
                0
              )}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Sent Estimates</p>
            <p className="text-3xl font-bold text-purple-600">
              {filteredProfiles.reduce((sum, p) => sum + p.statuses.sent, 0)}
            </p>
          </div>
        </div>

        {/* Title Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Customer Profiles
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            {filteredProfiles.length} customer{filteredProfiles.length !== 1 ? 's' : ''} with{' '}
            {filteredProfiles.reduce((sum, p) => sum + p.quoteCount, 0)} total quote
            {filteredProfiles.reduce((sum, p) => sum + p.quoteCount, 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading customers...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No customers match your search' : 'No customers yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProfiles
              .sort(
                (a, b) =>
                  new Date(b.lastQuoteDate).getTime() -
                  new Date(a.lastQuoteDate).getTime()
              )
              .map((profile) => (
                <div
                  key={profile.email}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition"
                >
                  {/* Customer Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {profile.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {profile.email}
                        </p>
                        <p className="text-sm text-gray-600">
                          {profile.phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-600">
                          {profile.quoteCount}
                        </p>
                        <p className="text-xs text-gray-500">Quote{profile.quoteCount !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Last:{' '}
                          {new Date(profile.lastQuoteDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex gap-2 mt-4">
                      {profile.statuses.submitted > 0 && (
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                          {profile.statuses.submitted} Pending
                        </span>
                      )}
                      {profile.statuses.analyzed > 0 && (
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                          {profile.statuses.analyzed} Ready
                        </span>
                      )}
                      {profile.statuses.sent > 0 && (
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                          {profile.statuses.sent} Sent
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quotes List */}
                  <div className="divide-y divide-gray-100">
                    {profile.quotes
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((quote) => (
                        <Link
                          key={quote.id}
                          href={`/admin/quotes/${quote.id}`}
                          className="p-4 hover:bg-gray-50 cursor-pointer transition flex justify-between items-center"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {quote.category}
                            </p>
                            <p className="text-sm text-gray-600 line-clamp-1 mt-1">
                              {quote.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Quote #{quote.id.substring(0, 8)} •{' '}
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                quote.status
                              )}`}
                            >
                              {quote.status}
                            </span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
/* Deployed at Wed Jun  3 19:11:05 UTC 2026 */
