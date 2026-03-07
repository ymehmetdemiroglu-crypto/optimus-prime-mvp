import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSubscription(
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
) {
    // Keep a ref to the latest callback to avoid stale closures without
    // causing the subscription to be recreated on every render.
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const channel = supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                },
                (payload) => callbackRef.current(payload)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table]);
}
