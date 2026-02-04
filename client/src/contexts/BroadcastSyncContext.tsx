import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Context to synchronize React Query cache across browser tabs using BroadcastChannel API
 * When data is mutated in one tab, other tabs are notified to invalidate their cache
 */

interface SyncMessage {
  type: 'invalidate';
  queryKeys: (string | number)[][];
  timestamp: number;
}

interface BroadcastSyncContextType {
  broadcastInvalidation: (queryKeys: (string | number)[][]) => void;
}

const BroadcastSyncContext = createContext<BroadcastSyncContextType>({
  broadcastInvalidation: () => {},
});

const CHANNEL_NAME = 'meal-planner-sync';

export function BroadcastSyncProvider({ children }: { children: React.ReactNode }) {
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

    // Handle visibility change to refetch stale queries when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only refetch queries that are stale (not all queries)
        // This prevents unnecessary network requests when switching tabs
        queryClient.invalidateQueries({
          refetchType: 'active', // Only refetch active queries
          stale: true, // Only if they're actually stale
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);

  // Function to broadcast invalidation to other tabs
  const broadcastInvalidation = useCallback((queryKeys: (string | number)[][]) => {
    if (!channelRef.current) return;

    const message: SyncMessage = {
      type: 'invalidate',
      queryKeys,
      timestamp: Date.now(),
    };

    channelRef.current.postMessage(message);
  }, []);

  return (
    <BroadcastSyncContext.Provider value={{ broadcastInvalidation }}>
      {children}
    </BroadcastSyncContext.Provider>
  );
}

export function useBroadcastSync() {
  return useContext(BroadcastSyncContext);
}
