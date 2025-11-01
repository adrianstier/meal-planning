import React, { useState } from 'react';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

// Note: Shopping hooks would go here, using placeholder data for now
// import { useShoppingItems, useAddShoppingItem, useToggleShoppingItem, useDeleteShoppingItem } from '../hooks/useShopping';

const ListsPage: React.FC = () => {
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  // Placeholder - replace with real hooks
  const shoppingItems: any[] = [];
  const isLoading = false;

  const handleAddItem = async () => {
    if (!newItem.trim()) return;

    // await addShoppingItem.mutateAsync({
    //   item_name: newItem,
    //   quantity: newQuantity || undefined,
    // });

    setNewItem('');
    setNewQuantity('');
  };

  // Group items by purchased status
  const activeItems = shoppingItems?.filter(item => !item.is_purchased) || [];
  const purchasedItems = shoppingItems?.filter(item => item.is_purchased) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Shopping List</CardTitle>
          <CardDescription>
            Keep track of what you need to buy
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Add Item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Item name"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              className="flex-1"
            />
            <Input
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              className="w-24"
            />
            <Button onClick={handleAddItem} disabled={!newItem.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shopping List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading shopping list...
        </div>
      ) : activeItems.length === 0 && purchasedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Your shopping list is empty</p>
            <p className="text-sm">Add items above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Active Items */}
          {activeItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  To Buy ({activeItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <button
                        // onClick={() => toggleItem.mutateAsync(item.id)}
                        className="flex-shrink-0 h-5 w-5 rounded border-2 border-primary hover:bg-primary/10 transition-colors"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.item_name}</p>
                        {item.quantity && (
                          <p className="text-sm text-muted-foreground">{item.quantity}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        // onClick={() => deleteItem.mutateAsync(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Purchased Items */}
          {purchasedItems.length > 0 && (
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Purchased ({purchasedItems.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    // onClick={() => clearPurchased.mutateAsync()}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {purchasedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-md border bg-card"
                    >
                      <button
                        // onClick={() => toggleItem.mutateAsync(item.id)}
                        className="flex-shrink-0 h-5 w-5 rounded border-2 border-primary bg-primary flex items-center justify-center"
                      >
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </button>
                      <div className="flex-1">
                        <p className="font-medium line-through text-muted-foreground">
                          {item.item_name}
                        </p>
                        {item.quantity && (
                          <p className="text-sm text-muted-foreground">{item.quantity}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        // onClick={() => deleteItem.mutateAsync(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info */}
      <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 text-base">
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            Full shopping list features are coming soon:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Check off items as you shop</li>
            <li>Organize by category (produce, dairy, etc.)</li>
            <li>Generate list from your meal plan</li>
            <li>Save frequently bought items</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListsPage;
