import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isMissingCredentials } from '../lib/supabase';

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
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
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

  // Fetch user profile from profiles table
  const fetchProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as User;
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return null;
    }
  };

  const checkAuth = async () => {
    console.log('[AuthContext] checkAuth starting...');

    // If credentials are missing, skip auth check and show login page
    if (isMissingCredentials) {
      console.error('[AuthContext] Supabase credentials missing - skipping auth check');
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    // Add a timeout to prevent infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Auth check timeout after 10s')), 10000);
    });

    try {
      console.log('[AuthContext] Getting session from Supabase...');
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        timeoutPromise
      ]);

      const { data: { session } } = sessionResult as { data: { session: Session | null } };
      console.log('[AuthContext] Session result:', session ? 'found' : 'none');

      setSession(session);
      setSupabaseUser(session?.user ?? null);

      if (session?.user) {
        console.log('[AuthContext] Fetching profile for user:', session.user.id);
        const profile = await fetchProfile(session.user.id);
        console.log('[AuthContext] Profile result:', profile ? 'found' : 'none');
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Auth check failed:', error);
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    } finally {
      console.log('[AuthContext] checkAuth complete, setting loading=false');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    checkAuth();

    // Skip auth listener if credentials are missing
    if (isMissingCredentials) {
      return;
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setSupabaseUser(session?.user ?? null);

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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

      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        setUser(profile);
        setSupabaseUser(data.user);
        setSession(data.session);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    displayName: string
  ) => {
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

      // Note: User might need to confirm email depending on Supabase settings
      if (data.user) {
        // Profile is created automatically via trigger
        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        const profile = await fetchProfile(data.user.id);
        setUser(profile);
        setSupabaseUser(data.user);
        setSession(data.session);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
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

  const value = {
    user,
    supabaseUser,
    session,
    loading,
    isAdmin: user?.is_admin ?? false,
    login,
    register,
    logout,
    checkAuth,
    updateUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
