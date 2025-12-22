import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { User as SupabaseUser, Session, AuthChangeEvent, Provider } from '@supabase/supabase-js';
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

// Constants for auth operations
const AUTH_TIMEOUT_MS = 15000;
const PROFILE_POLL_INTERVAL_MS = 200;
const PROFILE_POLL_MAX_ATTEMPTS = 15; // 3 seconds max

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
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

  // Track if initial auth check is complete to prevent race conditions
  const initialCheckComplete = useRef(false);
  const authStateQueue = useRef<Array<{ event: AuthChangeEvent; session: Session | null }>>([]);

  // Fetch user profile from profiles table with retry logic
  const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Don't log PGRST116 (no rows) as error - profile may not exist yet
        if (error.code !== 'PGRST116') {
          console.error('[Auth] Error fetching profile:', error.code);
        }
        return null;
      }
      return data as User;
    } catch (err) {
      console.error('[Auth] Profile fetch failed');
      return null;
    }
  }, []);

  // Poll for profile with exponential backoff (for after registration)
  const pollForProfile = useCallback(async (userId: string): Promise<User | null> => {
    for (let attempt = 0; attempt < PROFILE_POLL_MAX_ATTEMPTS; attempt++) {
      const profile = await fetchProfile(userId);
      if (profile) {
        return profile;
      }
      // Wait with slight exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, PROFILE_POLL_INTERVAL_MS * Math.min(attempt + 1, 3))
      );
    }
    return null;
  }, [fetchProfile]);

  // Create profile for OAuth users if one doesn't exist
  const ensureProfileExists = useCallback(async (user: SupabaseUser): Promise<User | null> => {
    // First try to fetch existing profile
    let profile = await fetchProfile(user.id);

    if (profile) {
      return profile;
    }

    // Profile doesn't exist - create one for OAuth user
    // Extract info from user metadata
    const metadata = user.user_metadata || {};
    const email = user.email || '';
    const displayName = metadata.full_name || metadata.name || email.split('@')[0];
    const username = metadata.preferred_username ||
                     metadata.user_name ||
                     email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
                     Math.random().toString(36).substring(2, 6);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: email,
          username: username,
          display_name: displayName,
        })
        .select()
        .single();

      if (error) {
        // Profile might have been created by trigger, try fetching again
        profile = await pollForProfile(user.id);
        return profile;
      }

      return data as User;
    } catch (err) {
      console.error('[Auth] Failed to create profile for OAuth user');
      // Try polling as fallback
      return await pollForProfile(user.id);
    }
  }, [fetchProfile, pollForProfile]);

  // Process auth state updates
  const handleAuthStateChange = useCallback(async (
    event: AuthChangeEvent,
    newSession: Session | null
  ) => {
    console.log('[Auth] handleAuthStateChange:', event, !!newSession?.user);
    setSession(newSession);
    setSupabaseUser(newSession?.user ?? null);

    if (newSession?.user) {
      // Check if email is confirmed (OAuth users are always confirmed)
      const emailConfirmed = !!newSession.user.email_confirmed_at;
      setEmailConfirmationPending(!emailConfirmed);
      console.log('[Auth] Email confirmed:', emailConfirmed);

      if (emailConfirmed) {
        // For OAuth users or regular users, ensure profile exists
        // Add timeout to prevent hanging
        console.log('[Auth] Fetching/creating profile for:', newSession.user.email);
        try {
          const profilePromise = ensureProfileExists(newSession.user);
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              console.warn('[Auth] Profile fetch timed out');
              resolve(null);
            }, 5000);
          });
          const profile = await Promise.race([profilePromise, timeoutPromise]);
          console.log('[Auth] Profile result:', !!profile, profile?.email);
          setUser(profile);
        } catch (err) {
          console.error('[Auth] Profile fetch error:', err);
          setUser(null);
        }
      } else {
        // Don't set user profile if email not confirmed
        setUser(null);
      }
    } else {
      setUser(null);
      setEmailConfirmationPending(false);
    }
  }, [ensureProfileExists]);

  const checkAuth = useCallback(async () => {
    // If credentials are missing, skip auth check and show login page
    if (isMissingCredentials) {
      console.error('[Auth] Supabase credentials missing');
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      setLoading(false);
      initialCheckComplete.current = true;
      return;
    }

    // Add a timeout to prevent infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Auth check timeout')), AUTH_TIMEOUT_MS);
    });

    try {
      console.log('[Auth] Checking session...');
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        timeoutPromise
      ]);

      const { data: { session: currentSession } } = sessionResult as { data: { session: Session | null } };
      console.log('[Auth] Session check result:', !!currentSession, currentSession?.user?.email);

      await handleAuthStateChange('INITIAL_SESSION' as AuthChangeEvent, currentSession);
    } catch (error) {
      console.error('[Auth] Auth check failed:', error);
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    } finally {
      setLoading(false);
      initialCheckComplete.current = true;

      // Process any queued auth events that came in during initial check
      while (authStateQueue.current.length > 0) {
        const queued = authStateQueue.current.shift();
        if (queued) {
          console.log('[Auth] Processing queued event:', queued.event);
          await handleAuthStateChange(queued.event, queued.session);
        }
      }
    }
  }, [handleAuthStateChange]);

  useEffect(() => {
    // Skip auth listener if credentials are missing
    if (isMissingCredentials) {
      console.error('[Auth] Supabase credentials missing - showing login');
      setLoading(false);
      return;
    }

    console.log('[Auth] Initializing auth...');

    // Safety timeout - ensure loading never gets stuck
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Safety timeout reached - forcing loading to false');
      setLoading(false);
      initialCheckComplete.current = true;
    }, 5000);

    // Helper to process session
    const processSession = async (sessionData: Session | null) => {
      console.log('[Auth] Processing session:', !!sessionData?.user);
      setSession(sessionData);
      setSupabaseUser(sessionData?.user ?? null);

      if (sessionData?.user) {
        const emailConfirmed = !!sessionData.user.email_confirmed_at;
        setEmailConfirmationPending(!emailConfirmed);

        if (emailConfirmed) {
          console.log('[Auth] Fetching profile for:', sessionData.user.email);
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', sessionData.user.id)
              .single();
            console.log('[Auth] Profile fetched:', !!profile);
            setUser(profile as User | null);
          } catch (err) {
            console.error('[Auth] Profile fetch failed:', err);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
        setEmailConfirmationPending(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] Auth state change:', event, !!newSession);
        await processSession(newSession);
        setLoading(false);
        initialCheckComplete.current = true;
        clearTimeout(safetyTimeout);
      }
    );

    // Perform initial auth check
    const doInitialCheck = async () => {
      try {
        console.log('[Auth] Getting initial session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('[Auth] Initial session:', !!currentSession, currentSession?.user?.email);
        await processSession(currentSession);
      } catch (error) {
        console.error('[Auth] Initial auth check failed:', error);
        setUser(null);
        setSupabaseUser(null);
        setSession(null);
      } finally {
        console.log('[Auth] Initial check done, loading=false');
        setLoading(false);
        initialCheckComplete.current = true;
        clearTimeout(safetyTimeout);
      }
    };

    doInitialCheck();

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);

    // Add timeout to login to prevent infinite spinner
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Login timeout - please try again')), AUTH_TIMEOUT_MS);
    });

    try {
      const authResult = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        timeoutPromise
      ]);

      const { data, error } = authResult as { data: { user: SupabaseUser | null; session: Session | null }; error: Error | null };

      if (error) {
        throw new Error(error.message);
      }

      if (data.user && data.session) {
        // Check if email is confirmed
        const emailConfirmed = !!data.user.email_confirmed_at;
        setEmailConfirmationPending(!emailConfirmed);

        if (emailConfirmed) {
          const profile = await fetchProfile(data.user.id);
          setUser(profile);
          setSupabaseUser(data.user);
          setSession(data.session);
        } else {
          throw new Error('Please confirm your email before logging in.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithOAuth = async (provider: OAuthProvider) => {
    setLoading(true);

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

      // OAuth redirects to provider, so we don't need to do anything else here
      // The auth state change listener will handle the callback
    } catch (error) {
      setLoading(false);
      throw error;
    }
    // Note: We don't set loading to false here because the page will redirect
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

      // Check if email confirmation is required
      // If session is null but user exists, email confirmation is pending
      const emailConfirmationRequired = !!data.user && !data.session;

      if (emailConfirmationRequired) {
        setEmailConfirmationPending(true);
        return { emailConfirmationRequired: true };
      }

      // Email confirmation not required - user is logged in
      if (data.user && data.session) {
        // Profile is created automatically via trigger
        // Poll for profile with exponential backoff instead of arbitrary sleep
        const profile = await pollForProfile(data.user.id);

        if (profile) {
          setUser(profile);
          setSupabaseUser(data.user);
          setSession(data.session);
        } else {
          // Profile creation failed - still let user in, profile can be created later
          console.warn('[Auth] Profile not created after registration');
          setSupabaseUser(data.user);
          setSession(data.session);
        }
      }

      return { emailConfirmationRequired: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Clear local state first to ensure user appears logged out immediately
    // This prevents issues where network failures leave user in a weird state
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
    setEmailConfirmationPending(false);

    try {
      // Attempt to sign out on server
      // Use 'local' scope to only clear local session if server is unreachable
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('[Auth] Logout error');
      }
    } catch (error) {
      // Network error - local state already cleared, user is effectively logged out
      console.error('[Auth] Logout request failed');
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
