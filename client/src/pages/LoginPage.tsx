import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { isMissingCredentials } from '../lib/supabase';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Supabase uses email for login
        await login(email, password);
      } else {
        if (!email || !displayName || !username) {
          setError('Please fill in all fields to create your account.');
          setLoading(false);
          return;
        }
        await register(username, email, password, displayName);
      }
      navigate('/plan');
    } catch (err) {
      const error = err as Error;
      setError(
        error.message ||
        (isLogin
          ? 'Unable to sign in. Please check your credentials and try again.'
          : 'Unable to create account. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Branding */}
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <UtensilsCrossed className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Family Meal Planner
          </h1>
          <p className="mt-2 text-muted-foreground">
            Plan your meals with ease
          </p>
        </div>

        {/* Login/Register Card */}
        <Card className="shadow-xl border-border/50 animate-scale-in">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin
                ? 'Sign in to access your meal plans'
                : 'Start planning your family meals today'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Configuration Error Banner */}
            {isMissingCredentials && (
              <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 animate-fade-in">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Configuration Required</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Supabase environment variables are not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your Vercel project settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email Field - Required for both login and register */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="transition-all duration-150"
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>

              {/* Registration-only Fields */}
              {!isLogin && (
                <div className="space-y-5 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      placeholder="Choose a username"
                      autoComplete="username"
                      className="transition-all duration-150"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your unique identifier
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-sm font-medium">
                      Display name
                    </Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      placeholder="Your name"
                      autoComplete="name"
                      className="transition-all duration-150"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is how you'll appear in the app
                    </p>
                  </div>
                </div>
              )}

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={isLogin ? 'Enter your password' : 'Create a password'}
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="transition-all duration-150"
                />
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div
                  id="login-error"
                  className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-scale-in"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-11 text-base font-medium transition-all duration-150"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                  </>
                ) : (
                  <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                )}
              </Button>
            </form>

            {/* Toggle Login/Register */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                disabled={loading}
                className={cn(
                  "text-sm font-medium transition-colors duration-150",
                  "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1",
                  loading ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                )}
              >
                {isLogin
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-xs text-muted-foreground animate-fade-in">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
