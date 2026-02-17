'use client';

import type { OrderInfo } from '@mirrormarkets/shared';
import { formatPercentage } from '@mirrormarkets/shared';

interface Props {
  orders: OrderInfo[];
  onCancel: (orderId: string) => void;
}

export function OrderTable({ orders, onCancel }: Props) {
  return (
    <div className="table-wrapper">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-th">Market</th>
            <th className="table-th">Side</th>
            <th className="table-th-right">Size</th>
            <th className="table-th-right">Price</th>
            <th className="table-th-right">Filled</th>
            <th className="table-th">Status</th>
            <th className="table-th-right">Actions</th>
          </tr>
        </thead>
        <tbody className="table-body">
          {orders.map((order) => (
            <tr key={order.id} className="transition hover:bg-[--bg-surface-light]">
              <td className="table-td font-medium text-white">{order.marketSlug ?? order.conditionId.slice(0, 8)}</td>
              <td className="table-td">
                <span className={order.side === 'BUY' ? 'badge-success' : 'badge-danger'}>{order.side}</span>
              </td>
              <td className="table-td text-right">{order.size.toFixed(2)}</td>
              <td className="table-td text-right">{formatPercentage(order.price)}</td>
              <td className="table-td text-right">{order.filledSize.toFixed(2)}</td>
              <td className="table-td">
                <span className={
                  order.status === 'FILLED' ? 'badge-success' :
                  order.status === 'CANCELLED' ? 'badge-neutral' :
                  order.status === 'OPEN' ? 'badge-info' :
                  'badge-warning'
                }>{order.status}</span>
              </td>
              <td className="table-td text-right">
                {order.status === 'OPEN' && (
                  <button onClick={() => onCancel(order.id)} className="text-xs font-medium text-[--accent-red] transition hover:brightness-125">
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
