'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useCreateFollow, useFollows, useRemoveFollow } from '@/hooks/useApi';
import { LeaderCard } from '@/components/LeaderCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const createFollow = useCreateFollow();
  const removeFollow = useRemoveFollow();
  const { data: follows } = useFollows();

  const followedAddresses = new Set(
    (follows ?? []).map((f: any) => f.leader?.address?.toLowerCase()),
  );

  const getFollowId = (address: string) => {
    const follow = (follows ?? []).find(
      (f: any) => f.leader?.address?.toLowerCase() === address.toLowerCase(),
    );
    return follow?.id;
  };

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
      <h1 className="page-title">Search Traders</h1>

      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name or address..."
          className="input-field flex-1"
        />
        <button onClick={handleSearch} disabled={loading} className="btn-primary shrink-0 px-6">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((user: any) => {
          const addr = user.address?.toLowerCase();
          const isFollowing = followedAddresses.has(addr);
          return (
            <LeaderCard
              key={user.address ?? user.id}
              leader={user}
              isFollowing={isFollowing}
              onFollow={() => createFollow.mutate(user.address)}
              onUnfollow={() => {
                const fid = getFollowId(user.address);
                if (fid) removeFollow.mutate(fid);
              }}
              isPending={createFollow.isPending || removeFollow.isPending}
            />
          );
        })}
      </div>

      {results.length === 0 && query && !loading && (
        <p className="text-center text-[--text-muted]">No traders found.</p>
      )}
    </div>
  );
}
