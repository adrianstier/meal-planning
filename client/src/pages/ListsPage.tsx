import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const ListsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shopping Lists</CardTitle>
          <CardDescription>Manage your shopping lists and grocery items</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Shopping list management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListsPage;
