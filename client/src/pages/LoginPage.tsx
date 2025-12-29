import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { UtensilsCrossed, Loader2, AlertTriangle, CheckCircle2, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuth, OAuthProvider } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { isMissingCredentials } from '../lib/supabase';

// Social login provider icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain uppercase, lowercase, and a number';
  }
  return null;
}

type ViewMode = 'login' | 'register' | 'forgot-password' | 'email-sent' | 'reset-password';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [mode, setMode] = useState<ViewMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  const { user, loading: authLoading, login, loginWithOAuth, register, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  // Redirect authenticated users to /plan
  useEffect(() => {
    if (!authLoading && user) {
      // Get the intended destination from location state, or default to /plan
      const from = (location.state as { from?: string })?.from || '/plan';
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location.state]);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setError('');
    setOauthLoading(provider);
    try {
      await loginWithOAuth(provider);
      // OAuth redirects to provider, so this won't be reached immediately
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to sign in. Please try again.');
      setOauthLoading(null);
    }
  };

  // Check for password reset flow from URL
  useEffect(() => {
    if (searchParams.get('reset') === 'true') {
      setMode('reset-password');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/plan');
      } else if (mode === 'register') {
        // Validate all fields
        if (!email || !displayName || !username) {
          setError('Please fill in all fields to create your account.');
          setLoading(false);
          return;
        }

        // Validate password strength
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          setLoading(false);
          return;
        }

        // Check password confirmation
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        const result = await register(username, email, password, displayName);

        if (result.emailConfirmationRequired) {
          setEmailConfirmationSent(true);
          setMode('email-sent');
        } else {
          navigate('/plan');
        }
      } else if (mode === 'forgot-password') {
        await resetPassword(email);
        setMode('email-sent');
        setSuccessMessage('Password reset email sent! Check your inbox.');
      } else if (mode === 'reset-password') {
        // Validate new password
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }

        await updatePassword(password);
        setSuccessMessage('Password updated successfully!');
        setMode('login');
      }
    } catch (err) {
      const error = err as Error;
      // Sanitize error messages to avoid exposing internal details
      const errorMsg = error.message?.toLowerCase() || '';
      let userMessage: string;

      if (errorMsg.includes('confirm your email')) {
        userMessage = 'Please confirm your email address before logging in. Check your inbox.';
      } else if (errorMsg.includes('invalid') || errorMsg.includes('credentials')) {
        userMessage = 'Invalid email or password. Please try again.';
      } else if (errorMsg.includes('not found') || errorMsg.includes('no user')) {
        userMessage = 'No account found with this email. Please check your email or create a new account.';
      } else if (errorMsg.includes('already') || errorMsg.includes('exists')) {
        userMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (errorMsg.includes('weak') || errorMsg.includes('password')) {
        userMessage = `Password must be at least ${MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, and a number.`;
      } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
        userMessage = 'Connection timed out. Please check your internet and try again.';
      } else if (errorMsg.includes('rate') || errorMsg.includes('limit')) {
        userMessage = 'Too many attempts. Please wait a moment and try again.';
      } else {
        userMessage = mode === 'login'
          ? 'Unable to sign in. Please check your credentials and try again.'
          : 'Unable to complete request. Please try again.';
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: ViewMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setEmailConfirmationSent(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back';
      case 'register': return 'Create your account';
      case 'forgot-password': return 'Reset your password';
      case 'email-sent': return emailConfirmationSent ? 'Check your email' : 'Email sent';
      case 'reset-password': return 'Set new password';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login': return 'Sign in to access your meal plans';
      case 'register': return 'Start planning your family meals today';
      case 'forgot-password': return "Enter your email and we'll send you a reset link";
      case 'email-sent': return emailConfirmationSent
        ? 'We sent a confirmation link to your email. Please verify your account.'
        : 'Check your email for the password reset link.';
      case 'reset-password': return 'Choose a strong password for your account';
    }
  };

  const passwordStrength = getPasswordStrength(password);

  // Show loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
              {getTitle()}
            </CardTitle>
            <CardDescription className="text-center">
              {getDescription()}
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

            {/* Email Sent Confirmation View */}
            {mode === 'email-sent' ? (
              <div className="text-center py-6 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <Mail className="w-8 h-8 text-green-600" aria-hidden="true" />
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  {emailConfirmationSent
                    ? 'Click the link in your email to verify your account, then come back to sign in.'
                    : 'Click the link in your email to reset your password.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => switchMode('login')}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Email Field - for login, register, forgot-password */}
                {(mode === 'login' || mode === 'register' || mode === 'forgot-password') && (
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
                )}

                {/* Registration-only Fields */}
                {mode === 'register' && (
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
                        required
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
                        required
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

                {/* Password Field - for login, register, reset-password */}
                {(mode === 'login' || mode === 'register' || mode === 'reset-password') && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      {mode === 'reset-password' ? 'New password' : 'Password'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder={mode === 'login' ? 'Enter your password' : 'Create a strong password'}
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="transition-all duration-150"
                    />
                    {/* Password Strength Indicator */}
                    {(mode === 'register' || mode === 'reset-password') && password && (
                      <div className="space-y-1 animate-fade-in">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={cn(
                                "h-1 flex-1 rounded-full transition-colors",
                                level <= passwordStrength.score
                                  ? passwordStrength.color
                                  : "bg-gray-200"
                              )}
                            />
                          ))}
                        </div>
                        <p className={cn(
                          "text-xs",
                          passwordStrength.score <= 1 ? "text-red-600" :
                          passwordStrength.score === 2 ? "text-orange-600" :
                          passwordStrength.score === 3 ? "text-yellow-600" : "text-green-600"
                        )}>
                          {passwordStrength.label} - Use 8+ characters with uppercase, lowercase, and numbers
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm Password - for register and reset-password */}
                {(mode === 'register' || mode === 'reset-password') && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirm password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="transition-all duration-150"
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-600">Passwords do not match</p>
                    )}
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div
                    className="flex items-start gap-2 p-4 rounded-lg bg-green-50 border border-green-200 animate-scale-in"
                    role="status"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div
                    id="login-error"
                    className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-scale-in"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-destructive">{error}</p>
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
                      <span>
                        {mode === 'login' ? 'Signing in...' :
                         mode === 'register' ? 'Creating account...' :
                         mode === 'forgot-password' ? 'Sending...' :
                         'Updating...'}
                      </span>
                    </>
                  ) : (
                    <span>
                      {mode === 'login' ? 'Sign in' :
                       mode === 'register' ? 'Create account' :
                       mode === 'forgot-password' ? 'Send reset link' :
                       'Update password'}
                    </span>
                  )}
                </Button>

                {/* Forgot Password Link - only on login */}
                {mode === 'login' && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      disabled={loading}
                      className={cn(
                        "text-sm transition-colors duration-150",
                        "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1",
                        loading ? "text-muted-foreground cursor-not-allowed" : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}

                {/* Social Login Divider and Buttons - only on login */}
                {mode === 'login' && (
                  <div className="space-y-4 pt-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOAuthLogin('google')}
                        disabled={loading || oauthLoading !== null}
                        className="h-11 relative"
                        aria-label="Sign in with Google"
                      >
                        {oauthLoading === 'google' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <GoogleIcon />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOAuthLogin('apple')}
                        disabled={loading || oauthLoading !== null}
                        className="h-11 relative"
                        aria-label="Sign in with Apple"
                      >
                        {oauthLoading === 'apple' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <AppleIcon />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOAuthLogin('github')}
                        disabled={loading || oauthLoading !== null}
                        className="h-11 relative"
                        aria-label="Sign in with GitHub"
                      >
                        {oauthLoading === 'github' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <GitHubIcon />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* Mode Toggle Links */}
            {mode !== 'email-sent' && (
              <div className="mt-6 text-center space-y-2">
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    disabled={loading}
                    className={cn(
                      "text-sm font-medium transition-colors duration-150",
                      "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1",
                      loading ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                    )}
                  >
                    Don't have an account? Create one
                  </button>
                )}
                {mode === 'register' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    disabled={loading}
                    className={cn(
                      "text-sm font-medium transition-colors duration-150",
                      "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1",
                      loading ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                    )}
                  >
                    Already have an account? Sign in
                  </button>
                )}
                {(mode === 'forgot-password' || mode === 'reset-password') && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    disabled={loading}
                    className={cn(
                      "text-sm font-medium transition-colors duration-150",
                      "hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1",
                      loading ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                    )}
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            )}
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
