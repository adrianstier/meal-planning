import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const SchoolMenuPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>School Menu</CardTitle>
          <CardDescription>Track school cafeteria menus and lunch alternatives</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">School menu tracking coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolMenuPage;
