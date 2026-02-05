# Bug Bash Feature Inventory

Generated: 2026-02-04

## Complete Feature Inventory

### Phase 1: Core Features

#### 1.1 Authentication & Profile
- Login/logout with Supabase Auth
- Profile management (ProfilePage)
- Session management with keep-alive
- Multi-tab sync (BroadcastChannel)
- OAuth support (profile auto-creation)

#### 1.2 Recipe Management (RecipesPage)
- Recipe CRUD (create, read, update, delete)
- Bulk delete recipes
- Search by name, ingredients, tags
- Filter by meal type, difficulty, cuisine
- Favorites toggle
- Recipe details view
- Leftover settings per recipe
- Tab navigation (All, Favorites, by meal type)

#### 1.3 Meal Planning (PlanPageEnhanced)
- Weekly calendar view
- Drag-and-drop meal scheduling
- Week navigation (prev/next/this week)
- Add meal to specific day/slot
- Edit/delete scheduled meals
- View meal details from plan
- Clear week functionality
- Generate random week plan
- Keyboard shortcuts (arrows, G, T, V, Cmd+Z)
- Undo/redo support
- Compact vs expanded view toggle
- Cuisine filter for generation

### Phase 2: AI Features

#### 2.1 Recipe Parsing
- Parse from URL (structured data: parse-recipe-url)
- Parse from URL (AI fallback: parse-recipe-url-ai)
- Parse from text (parse-recipe)
- Parse from image/photo (parse-recipe-image)
- Extract: name, ingredients, instructions, times, nutrition

#### 2.2 AI Suggestions
- Meal suggestions (suggest-meal)
- Restaurant type suggestions (suggest-restaurant)
- Leftover transformation ideas (leftover-suggestions)
- Lunch alternatives for school meals (lunch-alternatives)

#### 2.3 AI Agent Chat
- Multi-turn conversation
- Context-aware (loads user recipes, leftovers)
- Conversation persistence
- Rate limiting (30/min)

### Phase 3: Family Features

#### 3.1 Leftovers Management (LeftoversPage)
- Track leftover inventory
- Expiration dates
- Servings tracking
- Consume/update servings
- AI suggestions for using leftovers

#### 3.2 School Menu (SchoolMenuPage)
- Parse school menu from URL/text/image
- Calendar view of school meals
- Track feedback (liked/disliked/allergic)
- Generate lunch alternatives
- Bulk menu item creation

#### 3.3 Shopping Lists (ListsPage)
- Manual item add/edit/delete
- Toggle purchased status
- Clear purchased items
- Clear all items
- Auto-generate from meal plan
- Category organization

#### 3.4 Bento Planning (BentoPage)
- Bento items CRUD
- Bento plan creation (4 compartments)
- Date-based planning

### Phase 4: Advanced Features

#### 4.1 Restaurants (RestaurantsPage)
- Restaurant CRUD
- Filter by cuisine, price, kid-friendly
- Search restaurants
- Scrape menu from URL
- AI suggestions
- Geocode addresses

#### 4.2 Holiday Planning (HolidayPlannerPage)
- Holiday event creation
- Multi-dish meal planning
- Drag-drop recipes to events
- Course categories (appetizer, main, dessert)
- Timeline view

#### 4.3 Seasonal Cooking (SeasonalCookingPage)
- CSA box tracking
- Seasonal produce suggestions
- Recipe matching to produce

#### 4.4 Diagnostics (DiagnosticsPage)
- Error log viewer
- System health checks
- Debug information

### Phase 5: Infrastructure

#### 5.1 Error Handling
- ErrorBoundary with partial recovery
- Error logging to localStorage
- User-friendly error messages
- API error sanitization

#### 5.2 Performance
- React Query caching (5-min stale time)
- Optimistic UI updates
- Pagination (50 items default)
- Debounced operations

#### 5.3 Security
- CSRF protection (X-Requested-With header)
- Rate limiting (database-backed)
- Input validation
- SQL injection prevention
- XSS prevention
- RLS policies

---

## Bug Bash Phases

### Phase 1: Core Features
- Auth flow bugs
- Recipe CRUD edge cases
- Meal plan interactions
- Drag-drop issues

### Phase 2: AI Features
- Recipe parsing failures
- AI suggestion quality
- Rate limit handling
- Timeout behavior

### Phase 3: Family Features
- Leftovers tracking bugs
- School menu parsing
- Shopping list generation
- Data sync issues

### Phase 4: Advanced Features
- Restaurant scraping
- Holiday planning
- Seasonal features
- Cross-feature integration
