import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Calendar, Package, TrendingUp, CheckCircle, XCircle, Trash2, Edit, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';

interface CSABox {
  id: number;
  name: string;
  delivery_date: string;
  source: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  stats: {
    total_items: number;
    unused_items: number;
    used_items: number;
  };
}

interface CSAItem {
  id: number;
  ingredient_name: string;
  quantity?: number;
  unit: string;
  estimated_expiry_days: number;
  is_used: boolean;
  used_in_recipe_id?: number;
  used_date?: string;
  notes: string;
  created_at: string;
}

interface RecipeMatch {
  recipe_id: number;
  recipe_name: string;
  cuisine?: string;
  cook_time?: number;
  match_score: number;
  diversity_score: number;
  matched_ingredients: string[];
  missing_ingredients: string[];
  total_matched: number;
  total_csa_ingredients: number;
}

const CSABoxPage: React.FC = () => {
  const [boxes, setBoxes] = useState<CSABox[]>([]);
  const [selectedBox, setSelectedBox] = useState<CSABox | null>(null);
  const [boxItems, setBoxItems] = useState<CSAItem[]>([]);
  const [recipeMatches, setRecipeMatches] = useState<RecipeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddBox, setShowAddBox] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRecipeMatches, setShowRecipeMatches] = useState(false);

  // Form states
  const [newBoxForm, setNewBoxForm] = useState({
    name: '',
    delivery_date: new Date().toISOString().split('T')[0],
    source: '',
    notes: ''
  });

  const [newItemForm, setNewItemForm] = useState({
    ingredient_name: '',
    quantity: '',
    unit: '',
    estimated_expiry_days: 7,
    notes: ''
  });

  // Bulk add items
  const [bulkItems, setBulkItems] = useState('');

  useEffect(() => {
    loadBoxes();
  }, []);

  useEffect(() => {
    if (selectedBox) {
      loadBoxDetails(selectedBox.id);
    }
  }, [selectedBox]);

  const loadBoxes = async () => {
    try {
      const response = await axios.get('/api/csa/boxes');
      setBoxes(response.data.boxes);
    } catch (error) {
      console.error('Error loading CSA boxes:', error);
    }
  };

  const loadBoxDetails = async (boxId: number) => {
    try {
      const response = await axios.get(`/api/csa/boxes/${boxId}`);
      setBoxItems(response.data.box.items);
    } catch (error) {
      console.error('Error loading box details:', error);
    }
  };

  const loadRecipeMatches = async (boxId: number) => {
    setLoading(true);
    setShowRecipeMatches(true);
    try {
      const response = await axios.get(`/api/csa/boxes/${boxId}/recipe-matches`);
      setRecipeMatches(response.data.matches);
    } catch (error) {
      console.error('Error loading recipe matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/csa/boxes', newBoxForm);
      setShowAddBox(false);
      setNewBoxForm({
        name: '',
        delivery_date: new Date().toISOString().split('T')[0],
        source: '',
        notes: ''
      });
      loadBoxes();
    } catch (error) {
      console.error('Error creating box:', error);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBox) return;

    try {
      await axios.post(`/api/csa/boxes/${selectedBox.id}/items`, newItemForm);
      setShowAddItem(false);
      setNewItemForm({
        ingredient_name: '',
        quantity: '',
        unit: '',
        estimated_expiry_days: 7,
        notes: ''
      });
      loadBoxDetails(selectedBox.id);
      loadBoxes(); // Refresh stats
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const addBulkItems = async () => {
    if (!selectedBox || !bulkItems.trim()) return;

    const lines = bulkItems.trim().split('\n');
    try {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Parse line (format: "ingredient" or "ingredient, quantity unit")
        const parts = trimmed.split(',').map(p => p.trim());
        const ingredient_name = parts[0];
        const quantityPart = parts[1] || '';
        const [quantity, unit] = quantityPart.split(' ').map(p => p.trim());

        await axios.post(`/api/csa/boxes/${selectedBox.id}/items`, {
          ingredient_name,
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: unit || '',
          estimated_expiry_days: 7,
          notes: ''
        });
      }

      setBulkItems('');
      loadBoxDetails(selectedBox.id);
      loadBoxes();
    } catch (error) {
      console.error('Error adding bulk items:', error);
    }
  };

  const toggleItemUsed = async (itemId: number, isUsed: boolean) => {
    if (!selectedBox) return;

    try {
      if (!isUsed) {
        await axios.post(`/api/csa/boxes/${selectedBox.id}/items/${itemId}/mark-used`, {});
      } else {
        // Unmark as used
        await axios.put(`/api/csa/boxes/${selectedBox.id}/items/${itemId}`, {
          is_used: false
        });
      }
      loadBoxDetails(selectedBox.id);
      loadBoxes();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteBox = async (boxId: number) => {
    if (!window.confirm('Delete this CSA box and all its items?')) return;

    try {
      await axios.delete(`/api/csa/boxes/${boxId}`);
      setSelectedBox(null);
      loadBoxes();
    } catch (error) {
      console.error('Error deleting box:', error);
    }
  };

  const deleteItem = async (itemId: number) => {
    if (!selectedBox) return;

    try {
      await axios.delete(`/api/csa/boxes/${selectedBox.id}/items/${itemId}`);
      loadBoxDetails(selectedBox.id);
      loadBoxes();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const unusedItems = boxItems.filter(item => !item.is_used);
  const usedItems = boxItems.filter(item => item.is_used);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CSA Box Manager</h1>
          <p className="text-muted-foreground mt-1">
            Track your CSA deliveries and find recipes that use your fresh ingredients
          </p>
        </div>
        <Button onClick={() => setShowAddBox(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New CSA Box
        </Button>
      </div>

      {/* Add New Box Modal */}
      {showAddBox && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Add New CSA Box</CardTitle>
            <CardDescription>Create a new CSA delivery to track</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBox} className="space-y-4">
              <div>
                <Label htmlFor="box-name">Box Name *</Label>
                <Input
                  id="box-name"
                  placeholder="e.g., Weekly Veggie Box"
                  value={newBoxForm.name}
                  onChange={e => setNewBoxForm({ ...newBoxForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="delivery-date">Delivery Date *</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={newBoxForm.delivery_date}
                  onChange={e => setNewBoxForm({ ...newBoxForm, delivery_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="source">Source/Farm</Label>
                <Input
                  id="source"
                  placeholder="e.g., Green Valley Farm"
                  value={newBoxForm.source}
                  onChange={e => setNewBoxForm({ ...newBoxForm, source: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any notes about this delivery..."
                  value={newBoxForm.notes}
                  onChange={e => setNewBoxForm({ ...newBoxForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Create Box</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddBox(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: CSA Boxes List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold">Your CSA Boxes</h2>

          {boxes.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No CSA boxes yet.</p>
                <p className="text-sm">Create one to get started!</p>
              </CardContent>
            </Card>
          )}

          {boxes.map(box => (
            <Card
              key={box.id}
              className={`cursor-pointer transition-all ${
                selectedBox?.id === box.id ? 'border-primary shadow-md' : 'hover:border-gray-400'
              }`}
              onClick={() => setSelectedBox(box)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{box.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {new Date(box.delivery_date).toLocaleDateString()}
                    </CardDescription>
                    {box.source && (
                      <p className="text-xs text-muted-foreground mt-1">{box.source}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBox(box.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-lg">{box.stats.total_items}</div>
                    <div className="text-xs text-muted-foreground">Total Items</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg text-orange-600">{box.stats.unused_items}</div>
                    <div className="text-xs text-muted-foreground">Unused</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg text-green-600">{box.stats.used_items}</div>
                    <div className="text-xs text-muted-foreground">Used</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Box Details */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedBox ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a CSA box to view details</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Box Actions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedBox.name}</CardTitle>
                      <CardDescription>
                        Delivered: {new Date(selectedBox.delivery_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setShowAddItem(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                      <Button
                        onClick={() => loadRecipeMatches(selectedBox.id)}
                        size="sm"
                        variant="secondary"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Find Recipes
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Bulk Add Items */}
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg">
                    <Label className="text-sm font-medium">Quick Add Items (one per line)</Label>
                    <Textarea
                      placeholder="tomatoes, 5 lbs&#10;carrots, 2 bunches&#10;kale&#10;onions, 3 lbs"
                      value={bulkItems}
                      onChange={e => setBulkItems(e.target.value)}
                      className="mt-2 font-mono text-sm"
                      rows={4}
                    />
                    <Button onClick={addBulkItems} size="sm" className="mt-2" disabled={!bulkItems.trim()}>
                      Add All Items
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Add Item Form */}
              {showAddItem && (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">Add Item to Box</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={addItem} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="ingredient">Ingredient Name *</Label>
                          <Input
                            id="ingredient"
                            placeholder="e.g., Tomatoes"
                            value={newItemForm.ingredient_name}
                            onChange={e => setNewItemForm({ ...newItemForm, ingredient_name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="quantity">Quantity</Label>
                          <Input
                            id="quantity"
                            type="number"
                            step="0.1"
                            placeholder="e.g., 5"
                            value={newItemForm.quantity}
                            onChange={e => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="unit">Unit</Label>
                          <Input
                            id="unit"
                            placeholder="e.g., lbs, bunch"
                            value={newItemForm.unit}
                            onChange={e => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit">Add Item</Button>
                        <Button type="button" variant="outline" onClick={() => setShowAddItem(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Recipe Matches */}
              {showRecipeMatches && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Recipe Recommendations</CardTitle>
                        <CardDescription>
                          Recipes that use your CSA ingredients (sorted by diversity)
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowRecipeMatches(false)}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <p className="text-center py-8 text-muted-foreground">Finding recipes...</p>
                    ) : recipeMatches.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No recipe matches found. Try adding more ingredients to your recipes!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recipeMatches.map(match => (
                          <div key={match.recipe_id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold">{match.recipe_name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {match.cuisine && `${match.cuisine} • `}
                                  {match.cook_time && `${match.cook_time} min`}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="default">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  {match.diversity_score}% Diversity
                                </Badge>
                                <Badge variant="secondary">
                                  {match.match_score}% Match
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-3 text-sm">
                              <div className="mb-2">
                                <span className="font-medium text-green-700">Uses from box: </span>
                                <span className="text-muted-foreground">
                                  {match.matched_ingredients.join(', ')}
                                </span>
                              </div>
                              {match.missing_ingredients.length > 0 && (
                                <div>
                                  <span className="font-medium text-orange-700">Also needs: </span>
                                  <span className="text-muted-foreground">
                                    {match.missing_ingredients.slice(0, 3).join(', ')}
                                    {match.missing_ingredients.length > 3 && '...'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Unused Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Available Ingredients ({unusedItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unusedItems.length === 0 ? (
                    <p className="text-center py-6 text-muted-foreground">
                      All items used! 🎉
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {unusedItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                          <div className="flex-1">
                            <div className="font-medium">{item.ingredient_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.quantity && `${item.quantity} ${item.unit}`.trim()}
                              {item.estimated_expiry_days && ` • Expires in ~${item.estimated_expiry_days} days`}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleItemUsed(item.id, item.is_used)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Used
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Used Items */}
              {usedItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Used Ingredients ({usedItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {usedItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="font-medium text-muted-foreground line-through">
                              {item.ingredient_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Used on {item.used_date && new Date(item.used_date).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleItemUsed(item.id, item.is_used)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Unmark
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSABoxPage;
