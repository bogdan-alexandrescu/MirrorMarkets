'use client';

import { useLeaderboard, useCreateFollow } from '@/hooks/useApi';
import { LeaderCard } from '@/components/LeaderCard';

export default function LeaderboardPage() {
  const { data: leaders, isLoading } = useLeaderboard();
  const createFollow = useCreateFollow();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leaderboard</h1>

      {isLoading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leaders?.map((leader: any) => (
            <LeaderCard
              key={leader.id}
              leader={leader}
              onFollow={() => createFollow.mutate(leader.address)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
