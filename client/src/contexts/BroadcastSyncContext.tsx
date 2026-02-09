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

    let channel: BroadcastChannel | null = null;

    try {
      // Create broadcast channel
      channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      // Listen for messages from other tabs
      channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        try {
          const { type, queryKeys } = event.data;

          if (type === 'invalidate' && queryKeys?.length > 0) {
            console.log('[BroadcastSync] Received invalidation for:', queryKeys);

            // Invalidate each query key
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          }
        } catch (err) {
          console.error('[BroadcastSync] Error processing message:', err);
        }
      };

      // Note: BroadcastChannel doesn't have an onerror event in the standard API
      // Errors are typically thrown synchronously during postMessage
    } catch (err) {
      console.error('[BroadcastSync] Failed to create channel:', err);
      return;
    }

    // Handle visibility change to refetch stale queries when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch active (mounted) queries when tab becomes visible
        queryClient.invalidateQueries({
          refetchType: 'active',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      try {
        channel?.close();
        channelRef.current = null;
      } catch (err) {
        console.error('[BroadcastSync] Cleanup error:', err);
      }
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

    try {
      channelRef.current.postMessage(message);
    } catch (err) {
      console.error('[BroadcastSync] Failed to post message:', err);
    }
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
