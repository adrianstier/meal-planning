import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          display_name: displayName,
          email: email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update the user context with new data
      if (updateUser && data.user) {
        updateUser(data.user);
      }

      setSuccess('Profile updated successfully!');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <User className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium text-foreground">Username</p>
              <p className="text-sm">{user?.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium text-foreground">Member Since</p>
              <p className="text-sm">{formatDate(user?.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium text-foreground">Last Login</p>
              <p className="text-sm">{formatDate(user?.last_login)}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </div>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-800 px-4 py-3 rounded-md text-sm">
              {success}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Beta Tester Information</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Thank you for beta testing the Family Meal Planner! Your feedback helps us improve the app.
        </p>
        <p className="text-sm text-muted-foreground">
          If you encounter any issues or have suggestions, please reach out to the development team.
        </p>
      </Card>
    </div>
  );
}
