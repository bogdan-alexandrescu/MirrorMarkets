'use client';

import { useLeaderboard, useCreateFollow, useFollows, useRemoveFollow } from '@/hooks/useApi';
import { LeaderCard } from '@/components/LeaderCard';

export default function LeaderboardPage() {
  const { data: leaders, isLoading } = useLeaderboard();
  const { data: follows } = useFollows();
  const createFollow = useCreateFollow();
  const removeFollow = useRemoveFollow();

  const followedAddresses = new Map(
    follows?.map((f) => [f.leader.address.toLowerCase(), f.id]) ?? [],
  );

  return (
    <div className="space-y-6">
      <h1 className="page-title">Leaderboard</h1>

      {isLoading ? (
        <p className="text-[--text-muted]">Loading leaderboard...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leaders?.map((leader: any) => {
            const followId = followedAddresses.get(leader.address.toLowerCase());
            return (
              <LeaderCard
                key={leader.id}
                leader={leader}
                isFollowing={!!followId}
                onFollow={() => createFollow.mutate(leader.address)}
                onUnfollow={() => followId && removeFollow.mutate(followId)}
                isPending={createFollow.isPending || removeFollow.isPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
