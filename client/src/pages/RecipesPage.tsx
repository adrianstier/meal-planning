import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const RecipesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recipes</CardTitle>
          <CardDescription>Manage your recipe collection</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Recipe management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecipesPage;
