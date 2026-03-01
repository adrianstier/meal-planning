import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Package, CheckCircle, Trash2,
  Sparkles, Leaf, Clock, AlertTriangle, ChevronDown,
  ChevronUp, Box, Info, CalendarPlus, Search,
  X, Camera, FileText, Wand2, Upload, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Toast } from '../components/ui/toast';
import { cn } from '../lib/utils';
import {
  getSeasonalProduceByMonth,
  getShelfLife,
  getStorageTip,
  type ProduceItem,
  type SeasonalData
} from '../data/seasonalProduce';

// Types
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

interface ProduceItemData {
  id: number;
  ingredient_name: string;
  quantity?: number;
  unit: string;
  estimated_expiry_days: number;
  days_remaining?: number; // From backend
  is_used: boolean;
  used_in_recipe_id?: number;
  used_date?: string;
  notes: string;
  created_at: string;
  source?: string; // 'CSA', 'Store', etc.
  box_id?: number;
  box_name?: string;
  delivery_date?: string;
}

interface RecipeMatch {
  recipe_id: number;
  recipe_name: string;
  cuisine?: string;
  cook_time?: number;
  image_url?: string;
  match_score: number;
  diversity_score?: number;
  urgency_score?: number;
  total_score?: number;
  matched_ingredients: string[];
  expiring_ingredients?: string[];
  missing_ingredients: string[];
  total_matched: number;
  total_csa_ingredients?: number;
}

// AI Parsing types
interface ParsedProduceItem {
  name: string;
  quantity: number;
  unit: string;
  estimated_shelf_life_days: number;
  notes?: string;
  selected?: boolean;
}

interface ParsedResult {
  items: ParsedProduceItem[];
  source: string;
  delivery_date: string;
  confidence?: string;
  total_items: number;
}

// Calculate days until expiry - use backend value if available
const getDaysUntilExpiry = (item: ProduceItemData): number => {
  // Use backend-calculated days_remaining if available
  if (item.days_remaining !== undefined) {
    return item.days_remaining;
  }
  // Fallback to client-side calculation
  const createdDate = new Date(item.created_at || new Date());
  const expiryDate = new Date(createdDate);
  expiryDate.setDate(expiryDate.getDate() + (item.estimated_expiry_days || 7));
  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get urgency level based on days until expiry
const getUrgencyLevel = (daysLeft: number): 'critical' | 'warning' | 'ok' => {
  if (daysLeft <= 2) return 'critical';
  if (daysLeft <= 5) return 'warning';
  return 'ok';
};

const SeasonalCookingPage: React.FC = () => {
  // Seasonal data
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [selectedSeasonalItems, setSelectedSeasonalItems] = useState<Set<string>>(new Set());

  // CSA boxes and items - reserved for future use when backend is implemented
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [boxes, setBoxes] = useState<CSABox[]>([]);
  const [selectedBox, setSelectedBox] = useState<CSABox | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [allItems, setAllItems] = useState<ProduceItemData[]>([]);

  // Recipe matching - reserved for future use when backend is implemented
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [recipeMatches, setRecipeMatches] = useState<RecipeMatch[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info' | 'warning'; message: string; description?: string }>({ show: false, type: 'info', message: '' });
  const showToast = (type: 'success' | 'error' | 'info' | 'warning', message: string, description?: string) => {
    setToast({ show: true, type, message, description });
  };

  // UI state
  const [showAddBox, setShowAddBox] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAIParser, setShowAIParser] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    seasonal: true,
    myProduce: true,
    recipes: true
  });
  const [produceSearch, setProduceSearch] = useState('');

  // AI Parsing state
  const [aiParseMode, setAIParseMode] = useState<'text' | 'photo'>('text');
  const [aiParseText, setAIParseText] = useState('');
  const [aiParseSource, setAIParseSource] = useState('CSA');
  const [aiParsing, setAIParsing] = useState(false);
  const [aiParseError, setAIParseError] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedProduceItem[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Form states
  const [newBoxForm, setNewBoxForm] = useState({
    name: '',
    delivery_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
    source: '',
    notes: ''
  });

  const [newItemForm, setNewItemForm] = useState({
    ingredient_name: '',
    quantity: '',
    unit: '',
    estimated_expiry_days: 7,
    source_type: 'store' as 'csa' | 'store'
  });

  const [bulkItems, setBulkItems] = useState('');

  // Get seasonal data for current month
  const seasonalData: SeasonalData = useMemo(() => {
    return getSeasonalProduceByMonth(currentMonth);
  }, [currentMonth]);

  // Filter unused items and sort by expiry
  const unusedItems = useMemo(() => {
    return allItems
      .filter(item => !item.is_used)
      .map(item => ({
        ...item,
        daysUntilExpiry: getDaysUntilExpiry(item),
        urgencyLevel: getUrgencyLevel(getDaysUntilExpiry(item))
      }))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [allItems]);

  // Items expiring soon (within 3 days)
  const expiringSoon = useMemo(() => {
    return unusedItems.filter(item => item.daysUntilExpiry <= 3);
  }, [unusedItems]);

  // Items expiring this week (4-7 days)
  const expiringThisWeek = useMemo(() => {
    return unusedItems.filter(item => item.daysUntilExpiry > 3 && item.daysUntilExpiry <= 7);
  }, [unusedItems]);

  // Items with more time
  const freshItems = useMemo(() => {
    return unusedItems.filter(item => item.daysUntilExpiry > 7);
  }, [unusedItems]);

  // NOTE: All data operations are disabled - the backend endpoints
  // (/api/csa/boxes, /api/csa/produce, etc.) do not exist.
  // The app uses Supabase directly. This feature needs a csaApi layer in api.ts.

  const findRecipesForProduce = async () => {
    // No-op: backend endpoint does not exist
  };

  const createBox = async (e: React.FormEvent) => {
    e.preventDefault();
    // No-op: backend endpoint does not exist
    showToast('info', 'Coming soon', 'Creating CSA boxes is under development.');
    setShowAddBox(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    // No-op: backend endpoint does not exist
    showToast('info', 'Coming soon', 'Adding produce items is under development.');
    setShowAddItem(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addSeasonalItem = async (_produceName: string) => {
    // No-op: backend endpoint does not exist
  };

  const addBulkItems = async () => {
    // No-op: backend endpoint does not exist
    setBulkItems('');
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleItemUsed = async (_itemId: number, _isUsed: boolean) => {
    // No-op: backend endpoint does not exist
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deleteItem = async (_itemId: number) => {
    // No-op: backend endpoint does not exist
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deleteBox = async (_boxId: number) => {
    // No-op: backend endpoint does not exist
  };

  const toggleSeasonalItem = (itemName: string) => {
    setSelectedSeasonalItems(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  const addSelectedSeasonalToList = async () => {
    if (selectedSeasonalItems.size === 0) return;

    const items = Array.from(selectedSeasonalItems);
    for (const itemName of items) {
      await addSeasonalItem(itemName);
    }
    setSelectedSeasonalItems(new Set());
  };

  // Filter seasonal produce by search
  const filteredSeasonalProduce = useMemo(() => {
    if (!produceSearch.trim()) return seasonalData.produce;
    const search = produceSearch.toLowerCase();
    return seasonalData.produce.filter(item =>
      item.name.toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search)
    );
  }, [seasonalData.produce, produceSearch]);

  // Group seasonal produce by category
  const groupedProduce = useMemo(() => {
    const groups: { [key: string]: ProduceItem[] } = {
      vegetable: [],
      fruit: [],
      herb: []
    };
    filteredSeasonalProduce.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredSeasonalProduce]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Month names for selector
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // AI Parsing functions
  const resetAIParser = () => {
    setAIParseText('');
    setAIParseSource('CSA');
    setAIParsing(false);
    setAIParseError('');
    setParsedResult(null);
    setParsedItems([]);
    setImagePreview(null);
    setAIParseMode('text');
  };

  const handleParseText = async () => {
    // No-op: backend endpoint /api/csa/parse/text does not exist
    setAIParseError('AI parsing is coming soon. The backend for this feature is not yet available.');
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // No-op: backend endpoint /api/csa/parse/image does not exist
    setAIParseError('AI image parsing is coming soon. The backend for this feature is not yet available.');
  };

  const toggleItemSelection = (index: number) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateParsedItem = (index: number, field: keyof ParsedProduceItem, value: ParsedProduceItem[keyof ParsedProduceItem]) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeParseItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const addParsedItems = async () => {
    // No-op: backend endpoint /api/csa/parse/add-all does not exist
    setAIParseError('Adding parsed items is coming soon. The backend for this feature is not yet available.');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Coming Soon Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-900">This feature is coming soon</h3>
          <p className="text-sm text-blue-700 mt-1">
            Produce tracking, recipe matching, and AI import are under development.
            The seasonal produce guide below is fully functional -- browse what's in season
            and use it as inspiration for your meal planning.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Leaf className="h-7 w-7 text-green-600" />
            Seasonal Cooking
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track fresh produce, discover what's in season, and find recipes to cook
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAIParser(true)} variant="default" className="h-10 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
            <Wand2 className="h-4 w-4 mr-2" />
            AI Import
          </Button>
          <Button onClick={() => setShowAddItem(true)} variant="outline" className="h-10">
            <Plus className="h-4 w-4 mr-2" />
            Add Produce
          </Button>
          <Button onClick={() => setShowAddBox(true)} variant="outline" className="h-10">
            <Box className="h-4 w-4 mr-2" />
            New CSA Box
          </Button>
        </div>
      </div>

      {/* Use Soon Alert */}
      {expiringSoon.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-800">Use Soon!</h3>
                <p className="text-sm text-red-700 mt-1">
                  {expiringSoon.length} item{expiringSoon.length > 1 ? 's' : ''} expiring in the next 3 days:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {expiringSoon.map(item => (
                    <Badge
                      key={item.id}
                      variant="destructive"
                      className="text-xs"
                    >
                      {item.ingredient_name} ({item.daysUntilExpiry <= 0 ? 'Today!' : `${item.daysUntilExpiry}d`})
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-3"
                  onClick={findRecipesForProduce}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Find Recipes to Use These
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: What's Fresh & My Produce */}
        <div className="lg:col-span-5 space-y-6">
          {/* What's Fresh Section */}
          <Card>
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('seasonal')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">What's Fresh in {seasonalData.name}</CardTitle>
                </div>
                {expandedSections.seasonal ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              {seasonalData.seasonalTips && (
                <CardDescription className="mt-1">{seasonalData.seasonalTips}</CardDescription>
              )}
            </CardHeader>

            {expandedSections.seasonal && (
              <CardContent className="space-y-4">
                {/* Month Selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Month:</Label>
                  <select
                    value={currentMonth}
                    onChange={e => setCurrentMonth(parseInt(e.target.value))}
                    className="text-sm border rounded-md px-2 py-1 bg-background"
                  >
                    {months.map((month, idx) => (
                      <option key={month} value={idx + 1}>{month}</option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search produce..."
                    value={produceSearch}
                    onChange={e => setProduceSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {produceSearch && (
                    <button
                      onClick={() => setProduceSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                {/* Selected items action */}
                {selectedSeasonalItems.size > 0 && (
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm text-green-800">
                      {selectedSeasonalItems.size} item{selectedSeasonalItems.size > 1 ? 's' : ''} selected
                    </span>
                    <Button size="sm" onClick={addSelectedSeasonalToList} className="h-8">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add to My Produce
                    </Button>
                  </div>
                )}

                {/* Vegetables */}
                {groupedProduce.vegetable.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Vegetables</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {groupedProduce.vegetable.map(item => (
                        <button
                          key={item.name}
                          onClick={() => toggleSeasonalItem(item.name)}
                          className={cn(
                            "px-2.5 py-1 text-sm rounded-full border transition-all",
                            selectedSeasonalItems.has(item.name)
                              ? "bg-green-100 border-green-400 text-green-800"
                              : "bg-white border-gray-200 hover:border-green-300 hover:bg-green-50"
                          )}
                          title={getStorageTip(item.name) || `Keeps ~${item.shelfLifeDays} days`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fruits */}
                {groupedProduce.fruit.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Fruits</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {groupedProduce.fruit.map(item => (
                        <button
                          key={item.name}
                          onClick={() => toggleSeasonalItem(item.name)}
                          className={cn(
                            "px-2.5 py-1 text-sm rounded-full border transition-all",
                            selectedSeasonalItems.has(item.name)
                              ? "bg-orange-100 border-orange-400 text-orange-800"
                              : "bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                          )}
                          title={getStorageTip(item.name) || `Keeps ~${item.shelfLifeDays} days`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Herbs */}
                {groupedProduce.herb.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Herbs</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {groupedProduce.herb.map(item => (
                        <button
                          key={item.name}
                          onClick={() => toggleSeasonalItem(item.name)}
                          className={cn(
                            "px-2.5 py-1 text-sm rounded-full border transition-all",
                            selectedSeasonalItems.has(item.name)
                              ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                              : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                          )}
                          title={getStorageTip(item.name) || `Keeps ~${item.shelfLifeDays} days`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  <Info className="h-3 w-3 inline mr-1" />
                  Click items you bought, then add them to track freshness
                </p>
              </CardContent>
            )}
          </Card>

          {/* My Produce Section */}
          <Card>
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg"
              onClick={() => toggleSection('myProduce')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">My Produce</CardTitle>
                  {unusedItems.length > 0 && (
                    <Badge variant="secondary">{unusedItems.length}</Badge>
                  )}
                </div>
                {expandedSections.myProduce ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>

            {expandedSections.myProduce && (
              <CardContent className="space-y-4">
                {/* Box Selector */}
                {boxes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Source:</Label>
                    <select
                      value={selectedBox?.id || ''}
                      onChange={e => {
                        const box = boxes.find(b => b.id === parseInt(e.target.value));
                        setSelectedBox(box || null);
                      }}
                      className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background"
                    >
                      {boxes.map(box => (
                        <option key={box.id} value={box.id}>
                          {box.name} ({box.stats.unused_items} items)
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => selectedBox && deleteBox(selectedBox.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Quick Add */}
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  <Label className="text-sm font-medium">Quick Add (one per line)</Label>
                  <Textarea
                    placeholder="tomatoes, 2 lbs&#10;spinach&#10;carrots, 1 bunch"
                    value={bulkItems}
                    onChange={e => setBulkItems(e.target.value)}
                    className="font-mono text-sm h-20"
                  />
                  <Button
                    onClick={addBulkItems}
                    size="sm"
                    disabled={!bulkItems.trim()}
                    className="w-full"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Items
                  </Button>
                </div>

                {/* Item Lists by Urgency */}
                {unusedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No produce tracked yet.</p>
                    <p className="text-sm">Add items from What's Fresh or create a CSA box.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Critical - Use Today/Tomorrow */}
                    {expiringSoon.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Use Soon ({expiringSoon.length})
                        </h4>
                        <div className="space-y-1.5">
                          {expiringSoon.map(item => (
                            <ProduceItemRow
                              key={item.id}
                              item={item}
                              onToggleUsed={toggleItemUsed}
                              onDelete={deleteItem}
                              urgencyClass="bg-red-50 border-red-200"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warning - This Week */}
                    {expiringThisWeek.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          This Week ({expiringThisWeek.length})
                        </h4>
                        <div className="space-y-1.5">
                          {expiringThisWeek.map(item => (
                            <ProduceItemRow
                              key={item.id}
                              item={item}
                              onToggleUsed={toggleItemUsed}
                              onDelete={deleteItem}
                              urgencyClass="bg-amber-50 border-amber-200"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OK - More Time */}
                    {freshItems.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Fresh ({freshItems.length})
                        </h4>
                        <div className="space-y-1.5">
                          {freshItems.map(item => (
                            <ProduceItemRow
                              key={item.id}
                              item={item}
                              onToggleUsed={toggleItemUsed}
                              onDelete={deleteItem}
                              urgencyClass="bg-green-50 border-green-200"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right Column: Recipe Suggestions */}
        <div className="lg:col-span-7">
          <Card className="sticky top-20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-teal-500" />
                  <CardTitle className="text-lg">Recipe Suggestions</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={findRecipesForProduce}
                  disabled={loadingRecipes || unusedItems.length === 0}
                >
                  {loadingRecipes ? 'Finding...' : 'Refresh'}
                </Button>
              </div>
              <CardDescription>
                Recipes that use your produce, prioritizing items expiring soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecipes ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-muted-foreground">Finding recipes...</p>
                </div>
              ) : recipeMatches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg mb-2">No recipes found yet</p>
                  <p className="text-sm">
                    Add some produce to your list, then we'll find recipes that use them!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {recipeMatches.map((match, idx) => (
                    <RecipeMatchCard
                      key={match.recipe_id}
                      match={match}
                      expiringSoon={expiringSoon}
                      rank={idx + 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Box Modal */}
      {showAddBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>New CSA Box / Produce List</CardTitle>
              <CardDescription>Track a new delivery or shopping trip</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createBox} className="space-y-4">
                <div>
                  <Label htmlFor="box-name">Name *</Label>
                  <Input
                    id="box-name"
                    placeholder="e.g., Weekly CSA Box, Farmers Market 12/5"
                    value={newBoxForm.name}
                    onChange={e => setNewBoxForm({ ...newBoxForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="delivery-date">Date *</Label>
                  <Input
                    id="delivery-date"
                    type="date"
                    value={newBoxForm.delivery_date}
                    onChange={e => setNewBoxForm({ ...newBoxForm, delivery_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="source">Source (optional)</Label>
                  <Input
                    id="source"
                    placeholder="e.g., Green Valley Farm, Whole Foods"
                    value={newBoxForm.source}
                    onChange={e => setNewBoxForm({ ...newBoxForm, source: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1">Create</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddBox(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Produce Item</CardTitle>
              <CardDescription>Add a single item to track</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <Label htmlFor="ingredient">Item Name *</Label>
                  <Input
                    id="ingredient"
                    placeholder="e.g., Tomatoes"
                    value={newItemForm.ingredient_name}
                    onChange={e => {
                      const name = e.target.value;
                      const shelfLife = getShelfLife(name);
                      setNewItemForm({
                        ...newItemForm,
                        ingredient_name: name,
                        estimated_expiry_days: shelfLife
                      });
                    }}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 2"
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
                <div>
                  <Label htmlFor="expiry">Days until expiry</Label>
                  <Input
                    id="expiry"
                    type="number"
                    value={newItemForm.estimated_expiry_days}
                    onChange={e => setNewItemForm({ ...newItemForm, estimated_expiry_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-filled based on typical shelf life
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={!selectedBox}>
                    Add Item
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddItem(false)}>
                    Cancel
                  </Button>
                </div>
                {!selectedBox && (
                  <p className="text-sm text-amber-600">
                    Create a produce list first to add items
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Parser Modal */}
      {showAIParser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl mx-auto my-8">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center">
                    <Wand2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>AI Import</CardTitle>
                    <CardDescription>Paste text or upload a photo of your CSA box</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAIParser(false); resetAIParser(); }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Tabs */}
              {!parsedResult && (
                <>
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setAIParseMode('text')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                        aiParseMode === 'text'
                          ? "bg-background shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Paste Text
                    </button>
                    <button
                      onClick={() => setAIParseMode('photo')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                        aiParseMode === 'photo'
                          ? "bg-background shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Camera className="h-4 w-4" />
                      Upload Photo
                    </button>
                  </div>

                  {/* Source Input */}
                  <div>
                    <Label htmlFor="parse-source">Source (optional)</Label>
                    <Input
                      id="parse-source"
                      placeholder="e.g., Green Valley Farm, Farmers Market"
                      value={aiParseSource}
                      onChange={e => setAIParseSource(e.target.value)}
                    />
                  </div>

                  {/* Text Mode */}
                  {aiParseMode === 'text' && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="parse-text">CSA Box Contents</Label>
                        <Textarea
                          id="parse-text"
                          placeholder={`Paste your CSA box list, email, or newsletter here...

Example:
- 2 bunches kale
- 1 lb carrots
- 4 tomatoes
- 1 head lettuce
- Fresh basil`}
                          value={aiParseText}
                          onChange={e => setAIParseText(e.target.value)}
                          className="h-40 font-mono text-sm"
                        />
                      </div>
                      <Button
                        onClick={handleParseText}
                        disabled={aiParsing || !aiParseText.trim()}
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                      >
                        {aiParsing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Parse with AI
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Photo Mode */}
                  {aiParseMode === 'photo' && (
                    <div className="space-y-3">
                      {imagePreview ? (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="CSA box preview"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setImagePreview(null); setParsedResult(null); }}
                            className="absolute top-2 right-2"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                          {aiParsing && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <div className="text-white text-center">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                <p className="text-sm">Analyzing image...</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              JPEG, PNG, WebP or GIF (max 10MB)
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Parsed Results */}
              {parsedResult && parsedItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Found {parsedItems.length} items</h3>
                      <p className="text-sm text-muted-foreground">
                        From: {parsedResult.source} ({parsedResult.delivery_date})
                        {parsedResult.confidence && ` • ${parsedResult.confidence} confidence`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAIParser}
                    >
                      Start Over
                    </Button>
                  </div>

                  {/* Items List */}
                  <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                    {parsedItems.map((item, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-colors",
                          item.selected ? "bg-green-50 border-green-200" : "bg-muted/30"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItemSelection(index)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Input
                              value={item.name}
                              onChange={e => updateParsedItem(index, 'name', e.target.value)}
                              className="h-7 text-sm font-medium"
                            />
                            <Input
                              value={item.quantity}
                              onChange={e => updateParsedItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                              type="number"
                              step="0.1"
                              className="h-7 w-16 text-sm"
                            />
                            <Input
                              value={item.unit}
                              onChange={e => updateParsedItem(index, 'unit', e.target.value)}
                              className="h-7 w-20 text-sm"
                              placeholder="unit"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Shelf life: {item.estimated_shelf_life_days} days</span>
                            {item.notes && <span>• {item.notes}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParseItem(index)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Button */}
                  <Button
                    onClick={addParsedItems}
                    disabled={aiParsing || parsedItems.filter(i => i.selected).length === 0}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {aiParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Add {parsedItems.filter(i => i.selected).length} Items to My Produce
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Error Message */}
              {aiParseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {aiParseError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast notification */}
      {toast.show && (
        <Toast
          type={toast.type}
          message={toast.message}
          description={toast.description}
          duration={3000}
          onDismiss={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
};

// Sub-components
interface ProduceItemRowProps {
  item: ProduceItemData & { daysUntilExpiry: number; urgencyLevel: string };
  onToggleUsed: (id: number, isUsed: boolean) => void;
  onDelete: (id: number) => void;
  urgencyClass: string;
}

const ProduceItemRow: React.FC<ProduceItemRowProps> = ({ item, onToggleUsed, onDelete, urgencyClass }) => {
  const storageTip = getStorageTip(item.ingredient_name);

  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-lg border text-sm",
      urgencyClass
    )}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.ingredient_name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {item.quantity && <span>{item.quantity} {item.unit}</span>}
          <span className={cn(
            item.daysUntilExpiry <= 2 ? "text-red-600 font-medium" :
            item.daysUntilExpiry <= 5 ? "text-amber-600" : "text-green-600"
          )}>
            {item.daysUntilExpiry <= 0 ? 'Expires today!' : `${item.daysUntilExpiry}d left`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2">
        {storageTip && (
          <span title={storageTip} className="cursor-help">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleUsed(item.id, item.is_used)}
          className="h-7 w-7 p-0"
          title="Mark as used"
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(item.id)}
          className="h-7 w-7 p-0"
          title="Remove"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
        </Button>
      </div>
    </div>
  );
};

interface RecipeMatchCardProps {
  match: RecipeMatch;
  expiringSoon: Array<ProduceItemData & { daysUntilExpiry: number }>;
  rank: number;
}

const RecipeMatchCard: React.FC<RecipeMatchCardProps> = ({ match, expiringSoon, rank }) => {
  const navigate = useNavigate();

  // Use backend-provided expiring_ingredients, or fall back to client-side calculation
  const expiringMatches = match.expiring_ingredients || match.matched_ingredients.filter(ingredient =>
    expiringSoon.some(item =>
      item.ingredient_name.toLowerCase().includes(ingredient.toLowerCase())
    )
  );

  const hasUrgency = (match.urgency_score || 0) > 0 || expiringMatches.length > 0;

  return (
    <div className={cn(
      "border rounded-lg p-4 hover:bg-accent/30 transition-colors",
      hasUrgency && "border-red-200 bg-red-50/30"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold px-1.5 py-0.5 rounded",
              rank === 1 ? "bg-amber-100 text-amber-700" :
              rank <= 3 ? "bg-slate-100 text-slate-600" :
              "text-muted-foreground"
            )}>#{rank}</span>
            <h4 className="font-semibold truncate">{match.recipe_name}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {match.cuisine && <span>{match.cuisine}</span>}
            {match.cook_time && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {match.cook_time} min
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasUrgency && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Uses {expiringMatches.length} expiring!
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {match.total_score || match.diversity_score || match.match_score}% match
          </Badge>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div>
          <span className="font-medium text-green-700">Uses: </span>
          <span className="text-muted-foreground">
            {match.matched_ingredients.map((ing, idx) => (
              <span key={ing}>
                {idx > 0 && ', '}
                <span className={expiringMatches.includes(ing) ? 'text-red-600 font-medium' : ''}>
                  {ing}
                  {expiringMatches.includes(ing) && ' ⚠️'}
                </span>
              </span>
            ))}
          </span>
        </div>
        {match.missing_ingredients.length > 0 && (
          <div>
            <span className="font-medium text-amber-700">Need: </span>
            <span className="text-muted-foreground">
              {match.missing_ingredients.slice(0, 4).join(', ')}
              {match.missing_ingredients.length > 4 && ` +${match.missing_ingredients.length - 4} more`}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/recipes?highlight=${match.recipe_id}`)}
          className="flex-1 h-8"
        >
          View Recipe
        </Button>
        <Button
          size="sm"
          onClick={() => navigate('/plan')}
          className="flex-1 h-8"
        >
          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
          Add to Plan
        </Button>
      </div>
    </div>
  );
};

export default SeasonalCookingPage;
