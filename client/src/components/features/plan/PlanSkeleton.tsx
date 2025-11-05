import React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';

const PlanSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-36 bg-muted animate-pulse rounded" />
              <div className="h-10 w-36 bg-muted animate-pulse rounded" />
              <div className="h-10 w-10 bg-muted animate-pulse rounded" />
              <div className="h-10 w-24 bg-muted animate-pulse rounded" />
              <div className="h-10 w-10 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, dayIndex) => (
          <Card key={dayIndex} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded mt-1" />
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {/* Breakfast */}
              <div className="space-y-2">
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                <div className="h-24 bg-muted animate-pulse rounded" />
              </div>

              {/* Lunch */}
              <div className="space-y-2">
                <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                <div className="h-24 bg-muted animate-pulse rounded" />
              </div>

              {/* Dinner */}
              <div className="space-y-2">
                <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                <div className="h-24 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlanSkeleton;
