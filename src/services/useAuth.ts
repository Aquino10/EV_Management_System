import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from './dataService';
import { isSupabaseConfigured, supabase } from './supabase';

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: UserProfile | null;
  error: string | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    ready: !isSupabaseConfigured,
    session: null,
    profile: null,
    error: null,
  });

  const loadProfile = useCallback(async (user: User) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, license_plate')
      .eq('id', user.id)
      .single();

    if (error) {
      setAuth(current => ({
        ...current,
        ready: true,
        error: `Signed in, but your profile could not be loaded: ${error.message}`,
      }));
      return;
    }

    setAuth(current => ({
      ...current,
      ready: true,
      profile: {
        id: data.id,
        name: data.display_name,
        role: data.role,
        licensePlate: data.license_plate ?? undefined,
        email: user.email,
      },
      error: null,
    }));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setAuth(current => ({
        ...current,
        ready: !session,
        session,
        profile: null,
        error: null,
      }));

      if (session) {
        queueMicrotask(() => {
          if (active) void loadProfile(session.user);
        });
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuth(current => ({ ...current, ready: true, error: error.message }));
        return;
      }

      if (data.session) {
        setAuth(current => ({ ...current, session: data.session }));
        void loadProfile(data.session.user);
      } else {
        setAuth(current => ({ ...current, ready: true, session: null, profile: null }));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase is not configured.' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) return { error: 'Supabase is not configured.', needsEmailConfirmation: false };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    return {
      error: error?.message ?? null,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: 'Supabase is not configured.' };

    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  }, []);

  return {
    ...auth,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
  };
}
