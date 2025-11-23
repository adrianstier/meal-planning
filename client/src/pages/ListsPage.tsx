import React, { useState } from 'react';
import { Plus, Check, X, Trash2, Share2 } from 'lucide-react';
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

  const handleShareList = async () => {
    if (!activeItems.length) return;

    // Format shopping list as text
    let shareText = 'Shopping List\n\n';

    sortedCategories.forEach(category => {
      shareText += `${category}:\n`;
      itemsByCategory[category].forEach(item => {
        const qty = item.quantity ? ` (${item.quantity})` : '';
        shareText += `  • ${item.item_name}${qty}\n`;
      });
      shareText += '\n';
    });

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shopping List',
          text: shareText,
        });
      } catch (err) {
        // User cancelled or error - fallback to clipboard
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(shareText);
          alert('Shopping list copied to clipboard!');
        }
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareText);
      alert('Shopping list copied to clipboard!');
    }
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
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-xl sm:text-2xl">Shopping List</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Keep track of what you need to buy
              </CardDescription>
            </div>
            {activeItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareList}
                className="flex-shrink-0 h-10 min-h-[44px] w-full sm:w-auto"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Add Item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input
              placeholder="Item name"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              className="flex-1 min-w-0 h-12 text-base"
            />
            <Input
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              className="w-24 h-12 text-base"
            />
            <Button
              onClick={handleAddItem}
              disabled={!newItem.trim()}
              className="h-12 px-6"
            >
              <Plus className="h-5 w-5 mr-2" />
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
                          className="flex items-center gap-3 p-4 rounded-md border bg-card hover:bg-accent/50 transition-colors min-h-[60px]"
                        >
                          <button
                            onClick={() => toggleItem.mutateAsync(item.id)}
                            className="flex-shrink-0 h-8 w-8 rounded border-2 border-primary hover:bg-primary/10 transition-colors active:scale-95"
                            aria-label="Toggle purchased"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-base leading-relaxed">{item.item_name}</p>
                            {item.quantity && (
                              <p className="text-sm text-muted-foreground mt-1">{item.quantity}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 flex-shrink-0"
                            onClick={() => deleteItem.mutateAsync(item.id)}
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-5 w-5" />
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
                      className="flex items-center gap-3 p-4 rounded-md border bg-card min-h-[60px]"
                    >
                      <button
                        onClick={() => toggleItem.mutateAsync(item.id)}
                        className="flex-shrink-0 h-8 w-8 rounded border-2 border-primary bg-primary flex items-center justify-center active:scale-95 transition-transform"
                        aria-label="Uncheck item"
                      >
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-base line-through text-muted-foreground leading-relaxed">
                          {item.item_name}
                        </p>
                        {item.quantity && (
                          <p className="text-sm text-muted-foreground mt-1">{item.quantity}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => deleteItem.mutateAsync(item.id)}
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-5 w-5" />
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
