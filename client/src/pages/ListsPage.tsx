import React, { useState } from 'react';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { useShoppingItems, useAddShoppingItem, useToggleShoppingItem, useDeleteShoppingItem, useClearPurchased } from '../hooks/useShopping';

const ListsPage: React.FC = () => {
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  // Shopping hooks
  const { data: shoppingItems, isLoading } = useShoppingItems();
  const addShoppingItem = useAddShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearPurchased = useClearPurchased();

  const handleAddItem = async () => {
    if (!newItem.trim()) return;

    await addShoppingItem.mutateAsync({
      item_name: newItem,
      quantity: newQuantity || undefined,
    });

    setNewItem('');
    setNewQuantity('');
  };

  // Group items by purchased status and category
  const activeItems = shoppingItems?.filter(item => !item.is_purchased) || [];
  const purchasedItems = shoppingItems?.filter(item => item.is_purchased) || [];

  // Group active items by category
  const itemsByCategory = activeItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof activeItems>);

  // Define category order for grocery stores
  const categoryOrder = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Beverages', 'Other'];
  const sortedCategories = categoryOrder.filter(cat => itemsByCategory[cat] && itemsByCategory[cat].length > 0);

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
          {/* Active Items - Organized by Category */}
          {activeItems.length > 0 && (
            <div className="space-y-3">
              {sortedCategories.map((category) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {category} ({itemsByCategory[category].length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {itemsByCategory[category].map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <button
                            onClick={() => toggleItem.mutateAsync(item.id)}
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
                            onClick={() => deleteItem.mutateAsync(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                    onClick={() => clearPurchased.mutateAsync()}
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
                        onClick={() => toggleItem.mutateAsync(item.id)}
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
                        onClick={() => deleteItem.mutateAsync(item.id)}
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

      {/* Tips */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Shopping List Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Get the most out of your shopping list:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong>Auto-generate:</strong> Go to the Plan page and click "Shopping List" to automatically generate from your meal plan</li>
            <li><strong>AI-organized:</strong> Items are automatically organized by store category (Produce, Dairy, Meat, etc.)</li>
            <li><strong>Smart combining:</strong> Duplicate ingredients are combined (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour")</li>
            <li><strong>Check off as you shop:</strong> Tap the checkbox to mark items as purchased</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListsPage;
