import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as SupabaseUser, Session, Provider } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isMissingCredentials } from '../lib/supabase';

// Supported OAuth providers
export type OAuthProvider = 'google' | 'apple' | 'github';

interface Profile {
  id: string;
  username: string;
  email: string;
  display_name: string;
  is_admin?: boolean;
  created_at?: string;
  last_login?: string;
}

// Keep backwards compatible User interface
interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  is_admin?: boolean;
  created_at?: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  emailConfirmationPending: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: OAuthProvider) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<{ emailConfirmationRequired: boolean }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('[Auth] Profile fetch error:', error.code);
        }
        return null;
      }
      return data as User;
    } catch (err) {
      console.error('[Auth] Profile fetch failed');
      return null;
    }
  }, []);

  // Poll for profile with exponential backoff (handles database trigger delays)
  const waitForProfile = useCallback(async (userId: string, maxWaitMs = 3000): Promise<User | null> => {
    const startTime = Date.now();
    const pollIntervals = [100, 200, 400, 800]; // Exponential backoff
    let attempt = 0;

    while (Date.now() - startTime < maxWaitMs) {
      const profile = await fetchProfile(userId);
      if (profile) return profile;

      const delay = pollIntervals[Math.min(attempt, pollIntervals.length - 1)];
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }

    console.warn('[Auth] Profile not created after', maxWaitMs, 'ms');
    return null;
  }, [fetchProfile]);

  // Create profile for user if it doesn't exist (for OAuth users)
  const createProfileIfNeeded = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    // First try to fetch existing profile
    let profile = await fetchProfile(authUser.id);
    if (profile) return profile;

    // Profile doesn't exist - create one
    const metadata = authUser.user_metadata || {};
    const email = authUser.email || '';
    const displayName = metadata.full_name || metadata.name || email.split('@')[0];
    const username = metadata.preferred_username ||
                     metadata.user_name ||
                     email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
                     Math.random().toString(36).substring(2, 6);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: email,
          username: username,
          display_name: displayName,
        })
        .select()
        .single();

      if (error) {
        // Profile might have been created by trigger, poll for it with exponential backoff
        console.log('[Auth] Insert failed, polling for profile...');
        return await waitForProfile(authUser.id, 3000);
      }

      return data as User;
    } catch (err) {
      console.error('[Auth] Failed to create profile');
      return null;
    }
  }, [fetchProfile, waitForProfile]);

  // Handle session updates
  const handleSession = useCallback(async (newSession: Session | null) => {
    console.log('[Auth] handleSession:', !!newSession?.user);

    setSession(newSession);
    setSupabaseUser(newSession?.user ?? null);

    if (!newSession?.user) {
      setUser(null);
      setEmailConfirmationPending(false);
      return;
    }

    // Check if email is confirmed
    const emailConfirmed = !!newSession.user.email_confirmed_at;
    setEmailConfirmationPending(!emailConfirmed);

    if (!emailConfirmed) {
      setUser(null);
      return;
    }

    // Fetch or create profile
    try {
      const profile = await createProfileIfNeeded(newSession.user);
      setUser(profile);
    } catch (err) {
      console.error('[Auth] Profile handling failed');
      setUser(null);
    }
  }, [createProfileIfNeeded]);

  // Initialize auth state
  useEffect(() => {
    // If credentials are missing, show login immediately
    if (isMissingCredentials) {
      console.error('[Auth] Supabase credentials missing');
      setLoading(false);
      return;
    }

    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] Auth state change:', event);
        if (mounted) {
          await handleSession(newSession);
          setLoading(false);
        }
      }
    );

    // Set up cross-tab logout listener
    let logoutChannel: BroadcastChannel | null = null;
    try {
      logoutChannel = new BroadcastChannel('meal-planner-auth');
      logoutChannel.onmessage = (event) => {
        if (event.data?.type === 'logout' && mounted) {
          setUser(null);
          setSupabaseUser(null);
          setSession(null);
          queryClient.clear();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported in this browser
    }

    // Then get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log('[Auth] Initial session:', !!initialSession?.user);

        if (mounted) {
          await handleSession(initialSession);
          setLoading(false);
        }
      } catch (error) {
        console.error('[Auth] Init failed:', error);
        if (mounted) {
          setUser(null);
          setSupabaseUser(null);
          setSession(null);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Safety timeout - forcing load complete');
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      logoutChannel?.close();
    };
  }, [handleSession, queryClient]);

  const checkAuth = useCallback(async () => {
    if (isMissingCredentials) {
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await handleSession(currentSession);
    } catch (error) {
      console.error('[Auth] checkAuth failed:', error);
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [handleSession]);

  const login = async (email: string, password: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user || !data.session) {
        throw new Error('Login failed - no session returned');
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        setEmailConfirmationPending(true);
        throw new Error('Please confirm your email before logging in.');
      }

      // Fetch profile
      const profile = await fetchProfile(data.user.id);

      setUser(profile);
      setSupabaseUser(data.user);
      setSession(data.session);
      setEmailConfirmationPending(false);
    } finally {
      setLoading(false);
    }
  };

  const loginWithOAuth = async (provider: OAuthProvider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: `${window.location.origin}/plan`,
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      // OAuth redirects to provider - don't set loading false
    } catch (error) {
      throw error;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    displayName: string
  ): Promise<{ emailConfirmationRequired: boolean }> => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // If session is null but user exists, email confirmation is required
      const emailConfirmationRequired = !!data.user && !data.session;

      if (emailConfirmationRequired) {
        setEmailConfirmationPending(true);
        return { emailConfirmationRequired: true };
      }

      // User is logged in - wait for profile to be created by trigger
      if (data.user && data.session) {
        // Poll for profile (trigger creates it asynchronously)
        let profile: User | null = null;
        for (let i = 0; i < 10; i++) {
          profile = await fetchProfile(data.user.id);
          if (profile) break;
          await new Promise(r => setTimeout(r, 300));
        }

        setUser(profile);
        setSupabaseUser(data.user);
        setSession(data.session);
      }

      return { emailConfirmationRequired: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Clear local state first for immediate UI feedback
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
    setEmailConfirmationPending(false);

    // Clear ALL cached queries
    queryClient.clear();

    // Notify other tabs about logout
    try {
      const logoutChannel = new BroadcastChannel('meal-planner-auth');
      logoutChannel.postMessage({ type: 'logout' });
      logoutChannel.close();
    } catch (e) {
      // BroadcastChannel not supported, ignore
    }

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('[Auth] Logout error - user already logged out locally');
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!supabaseUser) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', supabaseUser.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    setUser(data as User);
  };

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    loading,
    isAdmin: user?.is_admin ?? false,
    emailConfirmationPending,
    login,
    loginWithOAuth,
    register,
    logout,
    checkAuth,
    updateUser,
    updateProfile,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
