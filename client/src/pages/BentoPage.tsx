import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Sparkles, Calendar as CalendarIcon, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import axios from 'axios';
import type { BentoItem, BentoPlan } from '../types/api';

const BentoPage: React.FC = () => {
  const [items, setItems] = useState<BentoItem[]>([]);
  const [plans, setPlans] = useState<BentoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BentoItem | null>(null);
  const [weekStart, setWeekStart] = useState('');

  const [itemFormData, setItemFormData] = useState({
    name: '',
    category: 'protein',
    is_favorite: false,
    allergens: '',
    notes: '',
    prep_time_minutes: ''
  });

  const categories = [
    { value: 'protein', label: 'Protein', color: 'bg-red-100 border-red-300', emoji: '🍖' },
    { value: 'fruit', label: 'Fruit', color: 'bg-yellow-100 border-yellow-300', emoji: '🍎' },
    { value: 'vegetable', label: 'Vegetable', color: 'bg-green-100 border-green-300', emoji: '🥕' },
    { value: 'grain', label: 'Grain/Carb', color: 'bg-amber-100 border-amber-300', emoji: '🍞' },
    { value: 'dairy', label: 'Dairy', color: 'bg-blue-100 border-blue-300', emoji: '🧀' },
    { value: 'snack', label: 'Snack', color: 'bg-purple-100 border-purple-300', emoji: '🍪' },
  ];

  useEffect(() => {
    fetchItems();
    fetchPlans();
    // Set default week start to next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7));
    setWeekStart(nextMonday.toISOString().split('T')[0]);
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get('/api/bento-items');
      setItems(response.data.items);
    } catch (error) {
      console.error('Error fetching bento items:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/bento-plans');
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching bento plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      if (editingItem) {
        await axios.put(`/api/bento-items/${editingItem.id}`, {
          ...itemFormData,
          prep_time_minutes: itemFormData.prep_time_minutes ? parseInt(itemFormData.prep_time_minutes) : null
        });
      } else {
        await axios.post('/api/bento-items', {
          ...itemFormData,
          prep_time_minutes: itemFormData.prep_time_minutes ? parseInt(itemFormData.prep_time_minutes) : null
        });
      }
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemFormData({
        name: '',
        category: 'protein',
        is_favorite: false,
        allergens: '',
        notes: '',
        prep_time_minutes: ''
      });
      fetchItems();
    } catch (error) {
      console.error('Error saving bento item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await axios.delete(`/api/bento-items/${id}`);
      fetchItems();
    } catch (error) {
      console.error('Error deleting bento item:', error);
      alert('Failed to delete item. Please try again.');
    }
  };

  const handleGenerateWeek = async () => {
    if (!weekStart) {
      alert('Please select a start date for the week');
      return;
    }

    try {
      await axios.post('/api/bento-plans/generate-week', {
        start_date: weekStart,
        child_name: ''
      });
      fetchPlans();
      alert('Week of bento boxes generated successfully!');
    } catch (error) {
      console.error('Error generating week:', error);
      alert('Failed to generate week. Make sure you have enough bento items in different categories.');
    }
  };

  const openEditDialog = (item: BentoItem) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      category: item.category,
      is_favorite: item.is_favorite,
      allergens: item.allergens || '',
      notes: item.notes || '',
      prep_time_minutes: item.prep_time_minutes?.toString() || ''
    });
    setItemDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setItemFormData({
      name: '',
      category: 'protein',
      is_favorite: false,
      allergens: '',
      notes: '',
      prep_time_minutes: ''
    });
    setItemDialogOpen(true);
  };

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[0];
  };

  const itemsByCategory = categories.map(cat => ({
    ...cat,
    items: items.filter(item => item.category === cat.value)
  }));

  // Group plans by date
  const plansByDate = plans.reduce((acc, plan) => {
    if (!acc[plan.date]) {
      acc[plan.date] = [];
    }
    acc[plan.date].push(plan);
    return acc;
  }, {} as Record<string, BentoPlan[]>);

  const sortedDates = Object.keys(plansByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-6 w-6" />
                Bento Box Planner
              </CardTitle>
              <CardDescription>
                Plan varied, kid-friendly lunches for the week
              </CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Bento Item
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="items">Bento Items ({items.length})</TabsTrigger>
          <TabsTrigger value="plans">Weekly Plans</TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Food Items by Category</CardTitle>
              <CardDescription>
                Manage foods your kids like, organized by type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {itemsByCategory.map(category => (
                  <div key={category.value} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{category.emoji}</span>
                      <h3 className="font-semibold text-lg">{category.label}</h3>
                      <span className="text-sm text-muted-foreground">
                        ({category.items.length})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {category.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No items yet
                        </p>
                      ) : (
                        category.items.map(item => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border-2 ${category.color} flex items-start justify-between`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.name}</span>
                                {item.is_favorite && (
                                  <span className="text-xs">⭐</span>
                                )}
                              </div>
                              {item.allergens && (
                                <p className="text-xs text-red-600 mt-1">
                                  ⚠️ {item.allergens}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(item)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Bento Plans</CardTitle>
                  <CardDescription>
                    Generate and view bento box plans for the week
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-40"
                  />
                  <Button onClick={handleGenerateWeek} disabled={items.length < 4}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Week
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading plans...
                </div>
              ) : sortedDates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bento plans yet.</p>
                  <p className="text-sm mt-2">
                    Add at least 4 bento items, then click Generate Week to create plans.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedDates.map(date => (
                    <div key={date} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon className="h-4 w-4" />
                        <h3 className="font-semibold">
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h3>
                      </div>

                      {plansByDate[date].map(plan => (
                        <div key={plan.id} className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[plan.compartment1, plan.compartment2, plan.compartment3, plan.compartment4].map((compartment, idx) => {
                              const catInfo = compartment ? getCategoryInfo(compartment.category) : null;
                              return (
                                <div
                                  key={idx}
                                  className={`p-4 rounded-lg border-2 ${
                                    catInfo ? catInfo.color : 'bg-gray-100 border-gray-300'
                                  } text-center`}
                                >
                                  <div className="text-2xl mb-2">
                                    {catInfo ? catInfo.emoji : '📦'}
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    Compartment {idx + 1}
                                  </div>
                                  <div className="font-medium text-sm">
                                    {compartment ? compartment.name : 'Empty'}
                                  </div>
                                  {compartment && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {catInfo?.label}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Bento Item' : 'Add Bento Item'}
            </DialogTitle>
            <DialogDescription>
              Add foods your kids enjoy for their bento box lunches
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={itemFormData.name}
                onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                placeholder="e.g., Turkey roll-ups, Apple slices, Cheese cubes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={itemFormData.category}
                onValueChange={(value) => setItemFormData({ ...itemFormData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergens">Allergens (if any)</Label>
              <Input
                id="allergens"
                value={itemFormData.allergens}
                onChange={(e) => setItemFormData({ ...itemFormData, allergens: e.target.value })}
                placeholder="e.g., Contains nuts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={itemFormData.notes}
                onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                placeholder="Prep tips or preferences"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prep_time">Prep Time (minutes)</Label>
              <Input
                id="prep_time"
                type="number"
                value={itemFormData.prep_time_minutes}
                onChange={(e) => setItemFormData({ ...itemFormData, prep_time_minutes: e.target.value })}
                placeholder="5"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_favorite"
                checked={itemFormData.is_favorite}
                onChange={(e) => setItemFormData({ ...itemFormData, is_favorite: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_favorite" className="cursor-pointer">
                Mark as favorite (prioritize in planning)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={!itemFormData.name}>
              {editingItem ? 'Update' : 'Add'} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BentoPage;
