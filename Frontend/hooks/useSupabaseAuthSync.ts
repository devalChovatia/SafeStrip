import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppDispatch } from '@/store';
import { setAuth } from '@/store/slices/authSlice';

/**
 * Syncs Supabase auth state to Redux. Call once at app root (e.g. in App.tsx).
 * Supabase remains the source of truth; Redux is the UI-facing mirror.
 */
export function useSupabaseAuthSync() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(
        setAuth({
          user: session?.user ?? null,
          session: session ?? null,
        })
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(
        setAuth({
          user: session?.user ?? null,
          session: session ?? null,
        })
      );
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);
}
