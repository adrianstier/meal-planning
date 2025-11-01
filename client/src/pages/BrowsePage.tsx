import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const BrowsePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Browse Meals</CardTitle>
          <CardDescription>Search and filter your meals</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Browse functionality coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrowsePage;
