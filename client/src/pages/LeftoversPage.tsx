import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const LeftoversPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leftovers</CardTitle>
          <CardDescription>Track and manage your leftovers</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Leftovers tracking coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeftoversPage;
