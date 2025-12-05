import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Calendar, Users, Clock, ChefHat, Trash2,
  CalendarDays, Sparkles, ShoppingCart, CheckCircle,
  PartyPopper, Gift, Egg, GripVertical, Copy
} from 'lucide-react';
import { useDragDrop } from '../contexts/DragDropContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
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
import { Toast } from '../components/ui/toast';

interface ToastState {
  show: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  description?: string;
}

interface HolidayEvent {
  id: number;
  name: string;
  event_type: string;
  event_date: string;
  serving_time: string;
  guest_count: number;
  notes: string;
  dish_count: number;
  guest_count_actual: number;
}

interface Dish {
  id: number;
  meal_id: number | null;
  custom_name: string;
  category: string;
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  can_make_ahead: boolean;
  make_ahead_days: number;
  assigned_to: string | null;
  is_confirmed: boolean;
  meal_name: string | null;
}

interface Guest {
  id: number;
  name: string;
  email: string;
  dietary_restrictions: string;
  bringing_dish: boolean;
  rsvp_status: string;
}

interface TimelineItem {
  dish_id: number;
  dish_name: string;
  category: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  prep_time?: number;
  cook_time?: number;
  type: string;
  when?: string;
}

const HolidayPlannerPage: React.FC = () => {
  const [events, setEvents] = useState<HolidayEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<HolidayEvent | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [timeline, setTimeline] = useState<{
    make_ahead_items: TimelineItem[];
    day_of_schedule: TimelineItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'info', message: '' });

  // Drag and drop context
  const { draggedRecipe, setDraggedRecipe } = useDragDrop();

  // Helper to show toast
  const showToast = (type: ToastState['type'], message: string, description?: string) => {
    setToast({ show: true, type, message, description });
  };

  // Dialogs
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAddDish, setShowAddDish] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Form states
  const [newEvent, setNewEvent] = useState({
    name: '',
    event_type: 'thanksgiving',
    event_date: '',
    serving_time: '17:00',
    guest_count: 8,
    notes: ''
  });

  const [newDish, setNewDish] = useState({
    custom_name: '',
    category: 'main',
    servings: 8,
    prep_time_minutes: 30,
    cook_time_minutes: 60,
    can_make_ahead: false,
    make_ahead_days: 0,
    assigned_to: '',
    notes: ''
  });

  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    dietary_restrictions: '',
    bringing_dish: false,
    rsvp_status: 'pending'
  });

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadEventDetails(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const response = await axios.get('/api/holiday/events');
      setEvents(response.data.events);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadEventDetails = async (eventId: number) => {
    try {
      const [detailsRes, timelineRes] = await Promise.all([
        axios.get(`/api/holiday/events/${eventId}`),
        axios.get(`/api/holiday/events/${eventId}/timeline`)
      ]);

      setDishes(detailsRes.data.dishes);
      setGuests(detailsRes.data.guests);
      setTimeline({
        make_ahead_items: timelineRes.data.make_ahead_items,
        day_of_schedule: timelineRes.data.day_of_schedule
      });
    } catch (error) {
      console.error('Error loading event details:', error);
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/holiday/events', newEvent);
      setShowCreateEvent(false);
      setNewEvent({
        name: '',
        event_type: 'thanksgiving',
        event_date: '',
        serving_time: '17:00',
        guest_count: 8,
        notes: ''
      });
      loadEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const deleteEvent = async (eventId: number) => {
    if (!window.confirm('Delete this holiday event and all its dishes?')) return;
    try {
      await axios.delete(`/api/holiday/events/${eventId}`);
      setSelectedEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const addDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      await axios.post(`/api/holiday/events/${selectedEvent.id}/dishes`, newDish);
      setShowAddDish(false);
      setNewDish({
        custom_name: '',
        category: 'main',
        servings: 8,
        prep_time_minutes: 30,
        cook_time_minutes: 60,
        can_make_ahead: false,
        make_ahead_days: 0,
        assigned_to: '',
        notes: ''
      });
      loadEventDetails(selectedEvent.id);
      loadEvents();
    } catch (error) {
      console.error('Error adding dish:', error);
    }
  };

  const deleteDish = async (dishId: number) => {
    if (!selectedEvent) return;
    try {
      await axios.delete(`/api/holiday/dishes/${dishId}`);
      loadEventDetails(selectedEvent.id);
      loadEvents();
    } catch (error) {
      console.error('Error deleting dish:', error);
    }
  };

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      await axios.post(`/api/holiday/events/${selectedEvent.id}/guests`, newGuest);
      setShowAddGuest(false);
      setNewGuest({
        name: '',
        email: '',
        dietary_restrictions: '',
        bringing_dish: false,
        rsvp_status: 'pending'
      });
      loadEventDetails(selectedEvent.id);
    } catch (error) {
      console.error('Error adding guest:', error);
    }
  };

  const deleteGuest = async (guestId: number) => {
    if (!selectedEvent) return;
    try {
      await axios.delete(`/api/holiday/guests/${guestId}`);
      loadEventDetails(selectedEvent.id);
    } catch (error) {
      console.error('Error deleting guest:', error);
    }
  };

  const applyTemplate = async (templateName: string) => {
    if (!selectedEvent) return;
    try {
      setLoading(true);
      await axios.post(`/api/holiday/events/${selectedEvent.id}/apply-template`, {
        template: templateName
      });
      setShowTemplates(false);
      loadEventDetails(selectedEvent.id);
      loadEvents();
    } catch (error) {
      console.error('Error applying template:', error);
    } finally {
      setLoading(false);
    }
  };

  const duplicateEvent = async (eventId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the event
    try {
      const response = await axios.post(`/api/holiday/events/${eventId}/duplicate`);
      showToast('success', 'Event duplicated', 'All dishes and guests have been copied');
      loadEvents();
      // Select the new event
      if (response.data.event_id) {
        const newEventResponse = await axios.get(`/api/holiday/events/${response.data.event_id}`);
        setSelectedEvent(newEventResponse.data.event);
      }
    } catch (error) {
      console.error('Error duplicating event:', error);
      showToast('error', 'Failed to duplicate event', 'Please try again');
    }
  };

  // Handle dropping a recipe from the Recipes page
  const handleDropRecipe = async (category: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!selectedEvent) return;

    try {
      // Get recipe data from drag event or context
      let recipeData;
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        recipeData = JSON.parse(jsonData);
      } else if (draggedRecipe) {
        recipeData = draggedRecipe.meal;
      }

      if (!recipeData) return;

      // Map meal_type to holiday category
      let dishCategory = category;
      if (category === 'drop-zone') {
        // Default category based on meal type
        switch (recipeData.meal_type) {
          case 'breakfast':
          case 'snack':
            dishCategory = 'appetizer';
            break;
          case 'dinner':
          case 'lunch':
          default:
            dishCategory = 'main';
        }
      }

      // Add the recipe as a dish to the holiday event
      await axios.post(`/api/holiday/events/${selectedEvent.id}/dishes`, {
        meal_id: recipeData.id,
        custom_name: recipeData.name,
        category: dishCategory,
        servings: recipeData.servings || selectedEvent.guest_count,
        prep_time_minutes: Math.floor((recipeData.cook_time_minutes || 60) * 0.3),
        cook_time_minutes: Math.floor((recipeData.cook_time_minutes || 60) * 0.7),
        can_make_ahead: false,
        make_ahead_days: 0,
        notes: recipeData.ingredients ? `From recipe: ${recipeData.name}` : ''
      });

      // Clear the dragged recipe
      setDraggedRecipe(null);

      // Show success toast
      showToast('success', `Added "${recipeData.name}"`, `Added to ${dishCategory}s in your holiday menu`);

      // Reload event details
      loadEventDetails(selectedEvent.id);
      loadEvents();

    } catch (error) {
      console.error('Error adding dropped recipe:', error);
      showToast('error', 'Failed to add recipe', 'Please try again');
    }
  };

  const handleDragOver = (category: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'thanksgiving': return <PartyPopper className="h-5 w-5 text-orange-500" />;
      case 'christmas': return <Gift className="h-5 w-5 text-red-500" />;
      case 'easter': return <Egg className="h-5 w-5 text-purple-500" />;
      default: return <CalendarDays className="h-5 w-5 text-blue-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'main': return 'bg-red-100 text-red-800';
      case 'side': return 'bg-green-100 text-green-800';
      case 'appetizer': return 'bg-blue-100 text-blue-800';
      case 'dessert': return 'bg-purple-100 text-purple-800';
      case 'drink': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Holiday Meal Planner</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Plan your Thanksgiving, Christmas, and other holiday feasts
          </p>
        </div>
        <Button onClick={() => setShowCreateEvent(true)} className="w-full sm:w-auto h-11 min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" />
          New Holiday Event
        </Button>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Holiday Event</DialogTitle>
            <DialogDescription>
              Plan a new holiday meal gathering
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createEvent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                name="name"
                placeholder="e.g., Thanksgiving 2024"
                value={newEvent.name}
                onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-type">Holiday Type</Label>
                <Select
                  name="event_type"
                  value={newEvent.event_type}
                  onValueChange={value => setNewEvent({ ...newEvent, event_type: value })}
                >
                  <SelectTrigger id="event-type" name="event_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thanksgiving">Thanksgiving</SelectItem>
                    <SelectItem value="christmas">Christmas</SelectItem>
                    <SelectItem value="easter">Easter</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  name="event_date"
                  type="date"
                  value={newEvent.event_date}
                  onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serving-time">Serving Time</Label>
                <Input
                  id="serving-time"
                  name="serving_time"
                  type="time"
                  value={newEvent.serving_time}
                  onChange={e => setNewEvent({ ...newEvent, serving_time: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-count">Expected Guests</Label>
                <Input
                  id="guest-count"
                  name="guest_count"
                  type="number"
                  min="1"
                  max="100"
                  value={newEvent.guest_count}
                  onChange={e => setNewEvent({ ...newEvent, guest_count: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any special notes for this event..."
                value={newEvent.notes}
                onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateEvent(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Event</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Events List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold">Your Events</h2>

          {events.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No holiday events yet.</p>
                <p className="text-sm">Create one to get started!</p>
              </CardContent>
            </Card>
          ) : (
            events.map(event => (
              <Card
                key={event.id}
                className={`cursor-pointer transition-all ${
                  selectedEvent?.id === event.id ? 'border-primary shadow-md' : 'hover:border-gray-400'
                }`}
                onClick={() => setSelectedEvent(event)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.event_type)}
                      <div>
                        <CardTitle className="text-lg">{event.name}</CardTitle>
                        <CardDescription>
                          {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })} at {event.serving_time}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => duplicateEvent(event.id, e)}
                        title="Duplicate event"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-lg">{event.dish_count}</div>
                      <div className="text-xs text-muted-foreground">Dishes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{event.guest_count}</div>
                      <div className="text-xs text-muted-foreground">Guests</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Event Details */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedEvent ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an event to view details</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="dishes">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dishes">
                  <ChefHat className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Dishes</span>
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Timeline</span>
                </TabsTrigger>
                <TabsTrigger value="guests">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Guests</span>
                </TabsTrigger>
              </TabsList>

              {/* Dishes Tab */}
              <TabsContent value="dishes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle>Menu</CardTitle>
                        <CardDescription>
                          {dishes.length} dishes planned • Drag recipes here from the Recipes page
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Templates
                        </Button>
                        <Button size="sm" onClick={() => setShowAddDish(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Dish
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Main drop zone when empty or to add to any category */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 mb-4 transition-all ${
                        dragOverCategory === 'drop-zone'
                          ? 'border-primary bg-primary/10 scale-[1.02]'
                          : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                      }`}
                      onDrop={(e) => handleDropRecipe('drop-zone', e)}
                      onDragOver={(e) => handleDragOver('drop-zone', e)}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <GripVertical className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          {dragOverCategory === 'drop-zone' ? 'Drop recipe here!' : 'Drag & drop recipes from your Recipe Book'}
                        </span>
                      </div>
                    </div>

                    {dishes.length === 0 ? (
                      <p className="text-center py-6 text-muted-foreground">
                        No dishes yet. Add one, apply a template, or drag recipes from your Recipe Book!
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {['main', 'side', 'appetizer', 'dessert', 'drink'].map(category => {
                          const categoryDishes = dishes.filter(d => d.category === category);

                          return (
                            <div
                              key={category}
                              className={`rounded-lg transition-all ${
                                dragOverCategory === category
                                  ? 'bg-primary/5 ring-2 ring-primary/50'
                                  : ''
                              }`}
                              onDrop={(e) => handleDropRecipe(category, e)}
                              onDragOver={(e) => handleDragOver(category, e)}
                              onDragLeave={handleDragLeave}
                            >
                              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                                {category}s
                                <span className="text-xs font-normal normal-case text-muted-foreground/60">
                                  ({categoryDishes.length})
                                </span>
                                {dragOverCategory === category && (
                                  <span className="text-xs text-primary animate-pulse">
                                    Drop to add as {category}
                                  </span>
                                )}
                              </h4>
                              {categoryDishes.length > 0 ? (
                                <div className="space-y-2">
                                  {categoryDishes.map(dish => (
                                    <div
                                      key={dish.id}
                                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 bg-background"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">
                                            {dish.custom_name || dish.meal_name}
                                          </span>
                                          {dish.can_make_ahead && (
                                            <Badge variant="secondary" className="text-xs">
                                              Make ahead
                                            </Badge>
                                          )}
                                          {dish.meal_id && (
                                            <Badge variant="outline" className="text-xs">
                                              From recipes
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {dish.prep_time_minutes}m prep + {dish.cook_time_minutes}m cook
                                          {dish.assigned_to && ` • ${dish.assigned_to}`}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteDish(dish.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="border border-dashed rounded-lg p-3 text-center text-muted-foreground/50 text-sm">
                                  Drop recipes here to add as {category}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cooking Timeline</CardTitle>
                    <CardDescription>
                      Work backwards from {selectedEvent.serving_time} serving time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!timeline || (timeline.make_ahead_items.length === 0 && timeline.day_of_schedule.length === 0) ? (
                      <p className="text-center py-6 text-muted-foreground">
                        Add dishes to see your cooking timeline
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {/* Make Ahead Items */}
                        {timeline.make_ahead_items.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-orange-700 mb-3">
                              Make Ahead
                            </h4>
                            <div className="space-y-2">
                              {timeline.make_ahead_items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50 rounded-lg"
                                >
                                  <div>
                                    <div className="font-medium">{item.dish_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {item.when}
                                    </div>
                                  </div>
                                  <Badge className={getCategoryColor(item.category)}>
                                    {item.category}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Day Of Schedule */}
                        {timeline.day_of_schedule.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-green-700 mb-3">
                              Day Of - {selectedEvent.event_date}
                            </h4>
                            <div className="space-y-2">
                              {timeline.day_of_schedule.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg gap-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="text-center min-w-[60px]">
                                      <div className="font-mono font-bold text-green-800">
                                        {item.start_time}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium">{item.dish_name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {item.prep_time}m prep + {item.cook_time}m cook
                                      </div>
                                    </div>
                                  </div>
                                  <Badge className={getCategoryColor(item.category)}>
                                    {item.category}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Serving Time */}
                        <div className="text-center p-4 bg-primary/10 rounded-lg">
                          <div className="text-2xl font-bold text-primary">
                            {selectedEvent.serving_time}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Dinner is served!
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Guests Tab */}
              <TabsContent value="guests" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle>Guest List</CardTitle>
                        <CardDescription>
                          {guests.length} guests invited
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setShowAddGuest(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Guest
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {guests.length === 0 ? (
                      <p className="text-center py-6 text-muted-foreground">
                        No guests added yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {guests.map(guest => (
                          <div
                            key={guest.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{guest.name}</span>
                                {guest.rsvp_status === 'confirmed' && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                                {guest.bringing_dish && (
                                  <Badge variant="secondary" className="text-xs">
                                    Bringing dish
                                  </Badge>
                                )}
                              </div>
                              {guest.dietary_restrictions && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {guest.dietary_restrictions}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteGuest(guest.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Add Dish Dialog */}
      <Dialog open={showAddDish} onOpenChange={setShowAddDish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Dish</DialogTitle>
            <DialogDescription>Add a dish to your holiday menu</DialogDescription>
          </DialogHeader>
          <form onSubmit={addDish} className="space-y-4">
            <div className="space-y-2">
              <Label>Dish Name</Label>
              <Input
                placeholder="e.g., Mashed Potatoes"
                value={newDish.custom_name}
                onChange={e => setNewDish({ ...newDish, custom_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newDish.category}
                  onValueChange={value => setNewDish({ ...newDish, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main</SelectItem>
                    <SelectItem value="side">Side</SelectItem>
                    <SelectItem value="appetizer">Appetizer</SelectItem>
                    <SelectItem value="dessert">Dessert</SelectItem>
                    <SelectItem value="drink">Drink</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Servings</Label>
                <Input
                  type="number"
                  min="1"
                  value={newDish.servings}
                  onChange={e => setNewDish({ ...newDish, servings: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prep Time (min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newDish.prep_time_minutes}
                  onChange={e => setNewDish({ ...newDish, prep_time_minutes: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cook Time (min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newDish.cook_time_minutes}
                  onChange={e => setNewDish({ ...newDish, cook_time_minutes: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assigned To (guest bringing this)</Label>
              <Input
                placeholder="Leave empty if you're making it"
                value={newDish.assigned_to}
                onChange={e => setNewDish({ ...newDish, assigned_to: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDish(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Dish</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Guest Dialog */}
      <Dialog open={showAddGuest} onOpenChange={setShowAddGuest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
            <DialogDescription>Add a guest to your event</DialogDescription>
          </DialogHeader>
          <form onSubmit={addGuest} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Guest name"
                value={newGuest.name}
                onChange={e => setNewGuest({ ...newGuest, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Optional"
                value={newGuest.email}
                onChange={e => setNewGuest({ ...newGuest, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Dietary Restrictions</Label>
              <Input
                placeholder="e.g., Vegetarian, Gluten-free"
                value={newGuest.dietary_restrictions}
                onChange={e => setNewGuest({ ...newGuest, dietary_restrictions: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddGuest(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Guest</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Holiday Templates</DialogTitle>
            <DialogDescription>
              Apply a traditional menu template to get started quickly
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => applyTemplate('thanksgiving')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg">Traditional Thanksgiving</CardTitle>
                </div>
                <CardDescription>
                  Turkey, stuffing, mashed potatoes, cranberry sauce, pumpkin pie, and more
                </CardDescription>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => applyTemplate('christmas')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-red-500" />
                  <CardTitle className="text-lg">Traditional Christmas</CardTitle>
                </div>
                <CardDescription>
                  Prime rib, ham, Yorkshire pudding, roasted vegetables, yule log
                </CardDescription>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => applyTemplate('easter')}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Egg className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-lg">Traditional Easter</CardTitle>
                </div>
                <CardDescription>
                  Glazed ham, lamb, scalloped potatoes, deviled eggs, carrot cake
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

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

export default HolidayPlannerPage;
