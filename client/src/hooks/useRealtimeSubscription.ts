import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSubscription(
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<any>) => void
) {
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
                callback
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table]);
}
