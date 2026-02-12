import type { CopyProfile, Order } from '@prisma/client';

export interface GuardrailContext {
  profile: CopyProfile;
  openOrders: Order[];
  leaderSide: 'BUY' | 'SELL';
  leaderPrice: number;
  leaderSize: number;
  currentBalance: number;
}

export interface GuardrailResult {
  allowed: boolean;
  adjustedSize: number;
  adjustedPrice: number;
  skipReason?: string;
}

export function evaluateGuardrails(ctx: GuardrailContext): GuardrailResult {
  const { profile, openOrders, leaderSide, leaderPrice, leaderSize, currentBalance } = ctx;

  // Check: odds within range
  if (leaderPrice < profile.minOdds || leaderPrice > profile.maxOdds) {
    return {
      allowed: false,
      adjustedSize: 0,
      adjustedPrice: leaderPrice,
      skipReason: `Price ${leaderPrice} outside odds range [${profile.minOdds}, ${profile.maxOdds}]`,
    };
  }

  // Check: max open positions
  const uniqueConditions = new Set(openOrders.map((o) => o.conditionId));
  if (uniqueConditions.size >= profile.maxOpenPositions && leaderSide === 'BUY') {
    return {
      allowed: false,
      adjustedSize: 0,
      adjustedPrice: leaderPrice,
      skipReason: `Max open positions reached (${profile.maxOpenPositions})`,
    };
  }

  // Calculate adjusted size based on copy percentage
  let adjustedSize = leaderSize * (profile.copyPercentage / 100);

  // Cap by max position size
  const costUsd = adjustedSize * leaderPrice;
  if (costUsd > profile.maxPositionSizeUsd) {
    adjustedSize = profile.maxPositionSizeUsd / leaderPrice;
  }

  // Cap by available balance
  const requiredUsd = adjustedSize * leaderPrice;
  if (requiredUsd > currentBalance && leaderSide === 'BUY') {
    if (currentBalance < 1) {
      return {
        allowed: false,
        adjustedSize: 0,
        adjustedPrice: leaderPrice,
        skipReason: `Insufficient balance: ${currentBalance.toFixed(2)} USDC`,
      };
    }
    adjustedSize = currentBalance / leaderPrice;
  }

  // Minimum size check
  if (adjustedSize < 0.1) {
    return {
      allowed: false,
      adjustedSize: 0,
      adjustedPrice: leaderPrice,
      skipReason: `Calculated size ${adjustedSize.toFixed(4)} below minimum 0.1`,
    };
  }

  return {
    allowed: true,
    adjustedSize: Number(adjustedSize.toFixed(2)),
    adjustedPrice: leaderPrice,
  };
}
