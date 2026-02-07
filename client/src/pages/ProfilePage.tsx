import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, CheckCircle2, Loader2, Info } from 'lucide-react';
import { formatDate } from '../lib/utils';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track if form has changes
  useEffect(() => {
    const changed =
      displayName !== (user?.display_name || '') ||
      email !== (user?.email || '');
    setHasChanges(changed);
  }, [displayName, email, user]);

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Use AuthContext updateProfile to update via Supabase directly
      await updateProfile({
        display_name: displayName,
        email: email,
      });

      setSuccess('Your profile has been updated successfully.');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unexpected error occurred');
      setError(error.message || 'Unable to update your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDisplayName(user?.display_name || '');
    setEmail(user?.email || '');
    setError('');
    setSuccess('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in p-4 sm:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Profile Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      {/* Account Overview Card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Account Information</CardTitle>
          <CardDescription>
            View your account details and membership status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Username */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Username</p>
                <p className="text-sm text-muted-foreground">{user?.username}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Calendar className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Member Since</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(user?.created_at || new Date().toISOString())}
                </p>
              </div>
            </div>

            {/* Last Login */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Last Login</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(user?.last_login || new Date().toISOString())}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Edit Profile</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium">
                Display name
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                required
                disabled={loading}
                className="transition-all duration-150"
              />
              <p className="text-xs text-muted-foreground">
                This is how your name will appear throughout the app
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="transition-all duration-150"
              />
              <p className="text-xs text-muted-foreground">
                We'll use this email for account notifications
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-scale-in"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div
                className="flex items-start gap-3 p-4 rounded-lg bg-success/10 border border-success/20 animate-scale-in"
                role="alert"
                aria-live="polite"
              >
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success">{success}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading || !hasChanges}
                className="sm:flex-1"
              >
                Reset Changes
              </Button>
              <Button
                type="submit"
                disabled={loading || !hasChanges}
                className="sm:flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Beta Tester Info Card */}
      <Card className="border-info/20 bg-info/5">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/20">
                <Info className="h-5 w-5 text-info" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Beta Tester
              </h3>
              <p className="text-sm text-muted-foreground">
                Thank you for beta testing Family Meal Planner! Your feedback helps us build a better product.
              </p>
              <p className="text-sm text-muted-foreground">
                Have suggestions or found a bug? Please report it in the{' '}
                <a
                  href="/diagnostics"
                  className="font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                >
                  Diagnostics
                </a>{' '}
                page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
