import React, { useState, useMemo } from 'react';
import { Plus, MapPin, Phone, Globe, Star, Trash2, Pencil, Sparkles, Filter, X, Utensils, Clock, Map, List, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  useRestaurants,
  useCreateRestaurant,
  useUpdateRestaurant,
  useDeleteRestaurant,
  useSuggestRestaurants,
} from '../hooks/useRestaurants';
import type { Restaurant, RestaurantFilters } from '../types/api';
import RestaurantMap from '../components/RestaurantMap';
import { sbRestaurants } from '../data/sbRestaurants';
import { restaurantsApi } from '../lib/api';

const RestaurantsPage: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [suggestedRestaurants, setSuggestedRestaurants] = useState<Restaurant[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filters
  const [filters, setFilters] = useState<RestaurantFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Restaurant>>({
    name: '',
    address: '',
    phone: '',
    website: '',
    cuisine_type: '',
    price_range: '$$',
    outdoor_seating: false,
    has_bar: false,
    takes_reservations: false,
    good_for_groups: false,
    kid_friendly: false,
    rating: undefined,
    notes: '',
    tags: '',
  });

  const [importStatus, setImportStatus] = useState<{ importing: boolean; progress: number; total: number }>({
    importing: false,
    progress: 0,
    total: 0,
  });

  const { data: restaurants, isLoading } = useRestaurants(filters);
  const createRestaurant = useCreateRestaurant();
  const updateRestaurant = useUpdateRestaurant();
  const deleteRestaurant = useDeleteRestaurant();
  const suggestRestaurants = useSuggestRestaurants();

  // Filter restaurants by search term
  const filteredRestaurants = useMemo(() => {
    if (!restaurants) return [];
    if (!searchTerm) return restaurants;

    const term = searchTerm.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.cuisine_type?.toLowerCase().includes(term) ||
        r.address?.toLowerCase().includes(term)
    );
  }, [restaurants, searchTerm]);

  const handleAdd = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      website: '',
      cuisine_type: '',
      price_range: '$$',
      outdoor_seating: false,
      has_bar: false,
      takes_reservations: false,
      good_for_groups: false,
      kid_friendly: false,
      rating: undefined,
      notes: '',
      tags: '',
    });
    setAddDialogOpen(true);
  };

  const handleEdit = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setFormData(restaurant);
    setEditDialogOpen(true);
  };

  const handleDelete = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setDeleteDialogOpen(true);
  };

  const handleSubmitAdd = async () => {
    try {
      await createRestaurant.mutateAsync(formData);
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Error creating restaurant:', error);
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedRestaurant) return;
    try {
      await updateRestaurant.mutateAsync({ id: selectedRestaurant.id, restaurant: formData });
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating restaurant:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRestaurant) return;
    try {
      await deleteRestaurant.mutateAsync(selectedRestaurant.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting restaurant:', error);
    }
  };

  const handleSuggest = async () => {
    try {
      const result = await suggestRestaurants.mutateAsync(filters);
      setSuggestedRestaurants(result.data || []);
      setSuggestDialogOpen(true);
    } catch (error) {
      console.error('Error getting suggestions:', error);
    }
  };

  const handleImportSBGuide = async () => {
    // Fetch ALL restaurants in pages to get complete list
    const allRestaurants: Restaurant[] = [];
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const result = await restaurantsApi.getAll(undefined, { limit: pageSize, offset });
      const page = ('data' in result && Array.isArray(result.data)) ? result.data as Restaurant[] : [];
      allRestaurants.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    // Remove duplicates: keep the first occurrence of each name, delete extras
    const seenNames: Record<string, Restaurant> = {};
    const duplicateIds: number[] = [];
    for (const r of allRestaurants) {
      const key = r.name.toLowerCase();
      if (seenNames[key]) {
        duplicateIds.push(r.id);
      } else {
        seenNames[key] = r;
      }
    }

    const toInsert = sbRestaurants.filter((r) => !seenNames[r.name!.toLowerCase()]);
    const toUpdate = sbRestaurants.filter((r) => {
      const existing = seenNames[r.name!.toLowerCase()];
      return existing && (!existing.image_url || existing.image_url !== r.image_url);
    });

    const totalWork = toInsert.length + toUpdate.length + duplicateIds.length;

    if (totalWork === 0) {
      alert('All SB restaurants are imported with photos, no duplicates!');
      return;
    }

    const parts = [
      toInsert.length > 0 ? `${toInsert.length} new` : '',
      toUpdate.length > 0 ? `${toUpdate.length} to update with photos` : '',
      duplicateIds.length > 0 ? `${duplicateIds.length} duplicates to remove` : '',
    ].filter(Boolean).join(', ');

    if (!window.confirm(`${parts}. Proceed?`)) {
      return;
    }

    setImportStatus({ importing: true, progress: 0, total: totalWork });
    let completed = 0;

    // 1. Delete duplicates first
    for (const id of duplicateIds) {
      try {
        await deleteRestaurant.mutateAsync(id);
        completed++;
        setImportStatus((prev) => ({ ...prev, progress: completed }));
      } catch (error) {
        console.error(`Failed to delete duplicate id ${id}:`, error);
      }
    }

    // 2. Insert new restaurants
    for (const restaurant of toInsert) {
      try {
        await createRestaurant.mutateAsync(restaurant);
        completed++;
        setImportStatus((prev) => ({ ...prev, progress: completed }));
      } catch (error) {
        console.error(`Failed to import ${restaurant.name}:`, error);
      }
    }

    // 3. Update existing restaurants with photos
    for (const restaurant of toUpdate) {
      const existing = seenNames[restaurant.name!.toLowerCase()];
      if (existing) {
        try {
          await updateRestaurant.mutateAsync({
            id: existing.id,
            restaurant: { image_url: restaurant.image_url },
          });
          completed++;
          setImportStatus((prev) => ({ ...prev, progress: completed }));
        } catch (error) {
          console.error(`Failed to update ${restaurant.name}:`, error);
        }
      }
    }

    setImportStatus({ importing: false, progress: 0, total: 0 });
    alert(`Done! ${duplicateIds.length} dupes removed, ${toInsert.length} added, ${toUpdate.length} updated.`);
  };

  const uniqueCuisines = useMemo(() => {
    if (!restaurants) return [];
    const cuisines = new Set(restaurants.map((r) => r.cuisine_type).filter(Boolean));
    return Array.from(cuisines).sort();
  }, [restaurants]);

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Restaurants & Bars</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your favorite local spots</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="min-w-[60px]"
            >
              <List className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className="min-w-[60px]"
            >
              <Map className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Map</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportSBGuide}
            disabled={importStatus.importing}
            className="flex-shrink-0"
          >
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              {importStatus.importing
                ? `Importing ${importStatus.progress}/${importStatus.total}...`
                : 'Import SB Guide'}
            </span>
            <span className="sm:hidden">
              {importStatus.importing ? `${importStatus.progress}/${importStatus.total}` : 'Import'}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSuggest} className="flex-shrink-0">
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Suggest 3 Places</span>
            <span className="sm:hidden">Suggest</span>
          </Button>
          <Button size="sm" onClick={handleAdd} className="flex-shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Restaurant</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Search</Label>
              <Input
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cuisine Type</Label>
              <Select
                value={filters.cuisine_type || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, cuisine_type: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger className="h-11 min-h-[44px]">
                  <SelectValue placeholder="All Cuisines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cuisines</SelectItem>
                  {uniqueCuisines.map((cuisine) => (
                    <SelectItem key={cuisine} value={cuisine || ''}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Switch
                checked={filters.outdoor_seating || false}
                onCheckedChange={(checked) => setFilters({ ...filters, outdoor_seating: checked || undefined })}
              />
              <Label className="cursor-pointer">Outdoor Seating</Label>
            </div>
            <div className="flex items-center gap-3 min-h-[44px]">
              <Switch
                checked={filters.has_bar || false}
                onCheckedChange={(checked) => setFilters({ ...filters, has_bar: checked || undefined })}
              />
              <Label className="cursor-pointer">Has Bar</Label>
            </div>
          </div>
          {Object.keys(filters).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Restaurant List or Map */}
      {viewMode === 'map' ? (
        <Card>
          <CardContent className="p-0">
            <RestaurantMap restaurants={filteredRestaurants} height="600px" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Utensils className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No restaurants found. Add your first one!</p>
            </div>
          ) : (
            filteredRestaurants.map((restaurant) => (
            <Card key={restaurant.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              {restaurant.image_url && (
                <div className="w-full h-48 overflow-hidden">
                  <img
                    src={restaurant.image_url}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{restaurant.name}</CardTitle>
                    {restaurant.cuisine_type && (
                      <Badge variant="secondary" className="mt-1">
                        {restaurant.cuisine_type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(restaurant)} aria-label="Edit restaurant">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(restaurant)} aria-label="Delete restaurant">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {restaurant.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{restaurant.address}</span>
                  </div>
                )}
                {restaurant.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{restaurant.phone}</span>
                  </div>
                )}
                {restaurant.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Website
                    </a>
                  </div>
                )}
                {restaurant.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{restaurant.rating}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {restaurant.price_range && (
                    <Badge variant="outline">{restaurant.price_range}</Badge>
                  )}
                  {restaurant.outdoor_seating && <Badge variant="outline">Outdoor</Badge>}
                  {restaurant.has_bar && <Badge variant="outline">Bar</Badge>}
                  {restaurant.kid_friendly && <Badge variant="outline">Kid Friendly</Badge>}
                  {restaurant.takes_reservations && <Badge variant="outline">Reservations</Badge>}
                </div>
                {restaurant.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{restaurant.notes}</p>
                )}
                {restaurant.hours_data && (() => {
                  try {
                    // JSONB columns are returned as parsed objects by Supabase
                    const hours = typeof restaurant.hours_data === 'string'
                      ? JSON.parse(restaurant.hours_data)
                      : restaurant.hours_data;
                    if (!hours || typeof hours !== 'object') return null;
                    return (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1 text-xs font-medium mb-1">
                          <Clock className="h-3 w-3" />
                          Hours
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {Object.entries(hours).slice(0, 3).map(([day, time]) => (
                            <div key={day}>{day}: {time as string}</div>
                          ))}
                          {Object.keys(hours).length > 3 && (
                            <div className="italic">+ {Object.keys(hours).length - 3} more days</div>
                          )}
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
                {restaurant.happy_hour_info && (() => {
                  try {
                    // JSONB columns are returned as parsed objects by Supabase
                    const happyHour = typeof restaurant.happy_hour_info === 'string'
                      ? JSON.parse(restaurant.happy_hour_info)
                      : restaurant.happy_hour_info;
                    if (!happyHour || typeof happyHour !== 'object') return null;
                    return (
                      <div className="mt-2 text-xs">
                        <Badge variant="secondary" className="text-xs">
                          Happy Hour: {(happyHour as Record<string, unknown>).time as string}
                        </Badge>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </CardContent>
            </Card>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen || editDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open && addDialogOpen);
        setEditDialogOpen(open && editDialogOpen);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? 'Edit Restaurant' : 'Add Restaurant'}</DialogTitle>
            <DialogDescription>
              {editDialogOpen ? 'Update restaurant information' : 'Add a new restaurant to your list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Restaurant name"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St, City"
                />
              </div>
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude || ''}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || undefined })}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude || ''}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || undefined })}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="cuisine">Cuisine Type</Label>
                <Input
                  id="cuisine"
                  value={formData.cuisine_type || ''}
                  onChange={(e) => setFormData({ ...formData, cuisine_type: e.target.value })}
                  placeholder="Italian, Mexican, etc."
                />
              </div>
              <div>
                <Label htmlFor="price">Price Range</Label>
                <Select
                  value={formData.price_range || '$$'}
                  onValueChange={(value) => setFormData({ ...formData, price_range: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="$">$ - Budget</SelectItem>
                    <SelectItem value="$$">$$ - Moderate</SelectItem>
                    <SelectItem value="$$$">$$$ - Upscale</SelectItem>
                    <SelectItem value="$$$$">$$$$ - Fine Dining</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={formData.rating || ''}
                  onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || undefined })}
                  placeholder="4.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.outdoor_seating || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, outdoor_seating: checked })}
                  />
                  <Label>Outdoor Seating</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.has_bar || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, has_bar: checked })}
                  />
                  <Label>Has Bar</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.takes_reservations || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, takes_reservations: checked })}
                  />
                  <Label>Takes Reservations</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.good_for_groups || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, good_for_groups: checked })}
                  />
                  <Label>Good for Groups</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.kid_friendly || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, kid_friendly: checked })}
                  />
                  <Label>Kid Friendly</Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags || ''}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="date-night, brunch, happy-hour"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setEditDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editDialogOpen ? handleSubmitEdit : handleSubmitAdd}
            >
              {editDialogOpen ? 'Save Changes' : 'Add Restaurant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Restaurant?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRestaurant?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestions Dialog */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restaurant Suggestions</DialogTitle>
            <DialogDescription>
              Here are 3 random restaurant suggestions based on your filters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {suggestedRestaurants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No restaurants match your criteria. Try adjusting your filters!
              </p>
            ) : (
              suggestedRestaurants.map((restaurant) => (
                <Card key={restaurant.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      {restaurant.name}
                      {restaurant.cuisine_type && (
                        <Badge variant="secondary">{restaurant.cuisine_type}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {restaurant.address && <p className="text-sm text-muted-foreground">{restaurant.address}</p>}
                    {restaurant.notes && <p className="text-sm mt-2">{restaurant.notes}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {restaurant.price_range && <Badge variant="outline">{restaurant.price_range}</Badge>}
                      {restaurant.outdoor_seating && <Badge variant="outline">Outdoor</Badge>}
                      {restaurant.has_bar && <Badge variant="outline">Bar</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSuggestDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RestaurantsPage;
