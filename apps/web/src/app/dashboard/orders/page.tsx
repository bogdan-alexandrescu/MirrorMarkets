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
      <h1 className="page-title">Orders</h1>

      {isLoading ? (
        <p className="text-[--text-muted]">Loading orders...</p>
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
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="text-sm text-[--text-muted]">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="text-[--text-muted]">No orders yet.</p>
      )}
    </div>
  );
}
