'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useCreateFollow } from '@/hooks/useApi';
import { LeaderCard } from '@/components/LeaderCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const createFollow = useCreateFollow();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/users/search?query=${encodeURIComponent(query)}`);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search Traders</h1>

      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name or address..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((user: any) => (
          <LeaderCard
            key={user.address ?? user.id}
            leader={user}
            onFollow={() => createFollow.mutate(user.address)}
          />
        ))}
      </div>

      {results.length === 0 && query && !loading && (
        <p className="text-center text-gray-500">No traders found.</p>
      )}
    </div>
  );
}
