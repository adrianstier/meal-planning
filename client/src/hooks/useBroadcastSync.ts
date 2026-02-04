import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to synchronize React Query cache across browser tabs using BroadcastChannel API
 * When data is mutated in one tab, other tabs are notified to invalidate their cache
 */

interface SyncMessage {
  type: 'invalidate';
  queryKeys: string[][];
  timestamp: number;
}

const CHANNEL_NAME = 'meal-planner-sync';

export function useBroadcastSync() {
  const queryClient = useQueryClient();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.log('[BroadcastSync] BroadcastChannel not supported');
      return;
    }

    // Create broadcast channel
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);

    // Listen for messages from other tabs
    channelRef.current.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { type, queryKeys } = event.data;

      if (type === 'invalidate' && queryKeys?.length > 0) {
        console.log('[BroadcastSync] Received invalidation for:', queryKeys);

        // Invalidate each query key
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    };

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [queryClient]);

  // Function to broadcast invalidation to other tabs
  const broadcastInvalidation = (queryKeys: string[][]) => {
    if (!channelRef.current) return;

    const message: SyncMessage = {
      type: 'invalidate',
      queryKeys,
      timestamp: Date.now(),
    };

    channelRef.current.postMessage(message);
  };

  return { broadcastInvalidation };
}

/**
 * Helper to wrap mutations with broadcast sync
 * Call this after successful mutations to notify other tabs
 */
export function createBroadcastInvalidator(channel: BroadcastChannel | null) {
  return (queryKeys: string[][]) => {
    if (!channel) return;

    const message: SyncMessage = {
      type: 'invalidate',
      queryKeys,
      timestamp: Date.now(),
    };

    channel.postMessage(message);
  };
}
