'use client';

import { useState } from 'react';
import { useOrders, useCancelOrder } from '@/hooks/useApi';
import { OrderTable } from '@/components/OrderTable';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrders(page);
  const cancelOrder = useCancelOrder();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>

      {isLoading ? (
        <p className="text-gray-500">Loading orders...</p>
      ) : data && data.items.length > 0 ? (
        <>
          <OrderTable
            orders={data.items}
            onCancel={(id) => cancelOrder.mutate(id)}
          />
          <div className="flex justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="text-gray-500">No orders yet.</p>
      )}
    </div>
  );
}
