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
  createdAt: string;
  customer?: {
    name: string;
    email: string;
  };
}

export default function AdminDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Incoming Quote Requests
          </h2>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading quotes...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No quote requests yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/admin/quotes/${quote.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {quote.customer?.name || 'Unknown Customer'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {quote.customer?.email}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      <strong>Category:</strong> {quote.category}
                    </p>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                      <strong>Description:</strong> {quote.description}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        quote.status === 'submitted'
                          ? 'bg-blue-100 text-blue-800'
                          : quote.status === 'analyzed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {quote.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
