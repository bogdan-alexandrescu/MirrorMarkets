'use client';

import type { OrderInfo } from '@mirrormarkets/shared';
import { formatPercentage } from '@mirrormarkets/shared';

interface Props {
  orders: OrderInfo[];
  onCancel: (orderId: string) => void;
}

export function OrderTable({ orders, onCancel }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Market</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Side</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Size</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Price</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Filled</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                {order.marketSlug ?? order.conditionId.slice(0, 8)}
              </td>
              <td className="px-4 py-3">
                <span className={`font-medium ${order.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                  {order.side}
                </span>
              </td>
              <td className="px-4 py-3 text-right">{order.size.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">{formatPercentage(order.price)}</td>
              <td className="px-4 py-3 text-right">{order.filledSize.toFixed(2)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  order.status === 'FILLED' ? 'bg-green-100 text-green-700' :
                  order.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                  order.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {order.status === 'OPEN' && (
                  <button
                    onClick={() => onCancel(order.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
