'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { SSEEvent } from '@mirrormarkets/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function useSSE(path: string, enabled = true) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!enabled) return;

    const token = api.getToken();
    if (!token) return;

    // EventSource doesn't support custom headers, so we pass token as query param
    const url = `${API_BASE}${path}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev.slice(-99), parsed]); // Keep last 100
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
      setConnected(false);
    };
  }, [path, enabled]);

  return { events, connected, clear };
}
