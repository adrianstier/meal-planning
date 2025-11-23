import React from 'react';
import { AlertCircle, Calendar, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useLeftovers, useConsumeLeftover, useLeftoverSuggestions } from '../hooks/useLeftovers';
import { cn } from '../lib/utils';

const LeftoversPage: React.FC = () => {
  const { data: leftovers, isLoading } = useLeftovers();
  const { data: suggestions } = useLeftoverSuggestions();
  const consumeLeftover = useConsumeLeftover();

  const handleConsume = async (id: number) => {
    await consumeLeftover.mutateAsync(id);
  };

  const getExpiryColor = (daysUntilExpiry: number) => {
    if (daysUntilExpiry <= 1) return 'expiring'; // Red
    if (daysUntilExpiry <= 3) return 'soon'; // Yellow
    return 'fresh'; // Green
  };

  const getExpiryBadge = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) {
      return <span className="text-xs font-semibold text-red-600">EXPIRED</span>;
    }
    if (daysUntilExpiry === 0) {
      return <span className="text-xs font-semibold text-red-600">Expires today!</span>;
    }
    if (daysUntilExpiry === 1) {
      return <span className="text-xs font-semibold text-red-600">Expires tomorrow</span>;
    }
    return <span className="text-xs text-muted-foreground">{daysUntilExpiry} days left</span>;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">Leftovers Tracker</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Manage your leftovers and avoid food waste
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertCircle className="h-5 w-5" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-md"
              >
                <div>
                  <p className="font-medium">{suggestion.meal_name}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.suggestion}</p>
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                  {suggestion.days_until_expiry} days left
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Leftovers */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading leftovers...
        </div>
      ) : !leftovers || leftovers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No leftovers tracked</p>
            <p className="text-sm">
              Leftovers will appear here when you cook meals that make leftovers
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {leftovers.map((leftover) => {
            const expiryStatus = getExpiryColor(leftover.days_until_expiry);

            return (
              <Card
                key={leftover.id}
                className={cn(
                  'flex flex-col transition-all',
                  expiryStatus === 'expiring' && 'border-red-500 bg-red-50 dark:bg-red-950/20',
                  expiryStatus === 'soon' && 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
                  expiryStatus === 'fresh' && 'border-green-500 bg-green-50 dark:bg-green-950/20'
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{leftover.meal_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {getExpiryBadge(leftover.days_until_expiry)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        expiryStatus === 'expiring' && 'bg-red-500',
                        expiryStatus === 'soon' && 'bg-amber-500',
                        expiryStatus === 'fresh' && 'bg-green-500'
                      )}
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Cooked: {new Date(leftover.cooked_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        Expires: {new Date(leftover.expires_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-lg">{leftover.servings_remaining}</span>
                      <span className="text-muted-foreground ml-1">
                        serving{leftover.servings_remaining !== 1 ? 's' : ''} left
                      </span>
                    </div>
                  </div>

                  {leftover.notes && (
                    <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-2">
                      {leftover.notes}
                    </p>
                  )}

                  <Button
                    onClick={() => handleConsume(leftover.id)}
                    disabled={consumeLeftover.isPending}
                    variant="outline"
                    className="w-full h-11 sm:h-10 min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Mark as Consumed
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 text-base">
            How Leftovers Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong className="text-blue-900 dark:text-blue-100">Color Guide:</strong>
          </p>
          <ul className="space-y-1 ml-4">
            <li className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Fresh (4+ days)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span>Use Soon (2-3 days)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Expiring (0-1 days)</span>
            </li>
          </ul>
          <p className="mt-3">
            Leftovers are automatically tracked when you cook meals. Mark them as consumed when you eat them to keep your inventory accurate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeftoversPage;
