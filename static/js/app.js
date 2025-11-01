// Family Meal Planner - Frontend JavaScript

const API_BASE = '';  // Empty since we're on same origin

// ============================================================================
// Tab Management
// ============================================================================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ============================================================================
// Meal Randomizer
// ============================================================================

function initRandomizer() {
    const randomizeBtn = document.getElementById('randomize-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const kidFriendlySlider = document.getElementById('kid-friendly');
    const kidFriendlyVal = document.getElementById('kid-friendly-val');

    // Set default date to today
    document.getElementById('start-date').valueAsDate = new Date();

    // Update slider value display
    kidFriendlySlider.addEventListener('input', (e) => {
        kidFriendlyVal.textContent = e.target.value;
    });

    randomizeBtn.addEventListener('click', generateMealPlan);
    regenerateBtn.addEventListener('click', generateMealPlan);
}

async function generateMealPlan() {
    const btn = document.getElementById('randomize-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Generating...';

    const data = {
        dietary_preference: document.getElementById('dietary-pref').value,
        time_constraint: document.getElementById('time-constraint').value,
        kid_friendly_min: parseInt(document.getElementById('kid-friendly').value),
        days: parseInt(document.getElementById('num-days').value),
        start_date: document.getElementById('start-date').value
    };

    try {
        const response = await fetch(`${API_BASE}/api/meals/randomize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            displayMealPlan(result.data);
        } else {
            showStatus('error', result.error || 'Failed to generate meal plan');
        }
    } catch (error) {
        showStatus('error', `Error: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🎲 Generate Meal Plan';
    }
}

function displayMealPlan(schedule) {
    const resultsSection = document.getElementById('meal-plan-results');
    const content = document.getElementById('meal-plan-content');

    let html = '';

    schedule.forEach(day => {
        const meal = day.meal;
        const ingredients = day.ingredients;

        // Group ingredients by type
        const byType = {};
        ingredients.forEach(ing => {
            const type = ing.component_type;
            if (!byType[type]) byType[type] = [];
            byType[type].push(ing);
        });

        html += `
            <div class="meal-day">
                <h3>${day.day} - ${new Date(day.date).toLocaleDateString()}</h3>
                <div class="meal-card">
                    <div class="meal-name">${meal.name}</div>
                    <div class="meal-meta">
                        <span class="meal-tag">⏱️ ${meal.prep_time_minutes + meal.cook_time_minutes} min</span>
                        <span class="meal-tag">⭐ Kid-Friendly: ${meal.kid_friendly_level}/10</span>
                        <span class="meal-tag">${meal.meal_type_name}</span>
                    </div>
                    ${meal.notes ? `<p><em>${meal.notes}</em></p>` : ''}
                    <div class="ingredients-list">
                        ${['protein', 'veggie', 'starch', 'fruit'].map(type => {
                            if (byType[type]) {
                                return `
                                    <div class="ingredient-group">
                                        <strong>${type}:</strong>
                                        ${byType[type].map(ing =>
                                            `<span class="ingredient-item">${ing.name}</span>`
                                        ).join(', ')}
                                    </div>
                                `;
                            }
                            return '';
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    content.innerHTML = html;
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// Recipe Parser (AI)
// ============================================================================

function initRecipeParser() {
    const parseBtn = document.getElementById('parse-recipe-btn');
    const saveBtn = document.getElementById('save-recipe-btn');
    const editBtn = document.getElementById('edit-recipe-btn');

    parseBtn.addEventListener('click', parseRecipe);
    saveBtn.addEventListener('click', saveRecipe);
    editBtn.addEventListener('click', showManualEntry);

    // Manual entry
    document.getElementById('add-ingredient-btn').addEventListener('click', addIngredientField);
    document.getElementById('manual-recipe-form').addEventListener('submit', saveManualRecipe);
}

async function parseRecipe() {
    const recipeText = document.getElementById('recipe-text').value;
    const recipeUrl = document.getElementById('recipe-url').value;

    if (!recipeText && !recipeUrl) {
        showStatus('error', 'Please provide recipe text or URL', 'ai-status');
        return;
    }

    const btn = document.getElementById('parse-recipe-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Parsing with AI...';

    try {
        const response = await fetch(`${API_BASE}/api/parse-recipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipe_text: recipeText, recipe_url: recipeUrl })
        });

        const result = await response.json();

        if (result.success) {
            displayParsedRecipe(result.data);
            showStatus('success', 'Recipe parsed successfully!', 'ai-status');
        } else {
            showStatus('error', result.error || 'Failed to parse recipe', 'ai-status');
        }
    } catch (error) {
        showStatus('error', `Error: ${error.message}`, 'ai-status');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🤖 Parse with AI';
    }
}

let parsedRecipeData = null;

function displayParsedRecipe(data) {
    parsedRecipeData = data;
    const section = document.getElementById('parsed-recipe');
    const content = document.getElementById('parsed-content');

    let html = `
        <div class="meal-card">
            <h3>${data.name}</h3>
            <div class="meal-meta">
                <span class="meal-tag">${data.meal_type}</span>
                <span class="meal-tag">⭐ ${data.kid_friendly_level}/10</span>
                <span class="meal-tag">⏱️ ${data.prep_time_minutes + data.cook_time_minutes} min</span>
                <span class="meal-tag">${data.dietary_category || 'omnivore'}</span>
            </div>
            ${data.notes ? `<p><em>${data.notes}</em></p>` : ''}
            <h4>Ingredients:</h4>
            <ul>
                ${data.ingredients.map(ing =>
                    `<li>${ing.name} (${ing.component_type}) - ${ing.quantity || 'to taste'}</li>`
                ).join('')}
            </ul>
        </div>
    `;

    content.innerHTML = html;
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

async function saveRecipe() {
    if (!parsedRecipeData) return;

    const btn = document.getElementById('save-recipe-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Saving...';

    try {
        const response = await fetch(`${API_BASE}/api/meals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedRecipeData)
        });

        const result = await response.json();

        if (result.success) {
            showStatus('success', 'Recipe saved successfully!', 'ai-status');

            // Clear form
            document.getElementById('recipe-text').value = '';
            document.getElementById('recipe-url').value = '';
            document.getElementById('parsed-recipe').style.display = 'none';
            parsedRecipeData = null;
        } else {
            showStatus('error', result.error || 'Failed to save recipe', 'ai-status');
        }
    } catch (error) {
        showStatus('error', `Error: ${error.message}`, 'ai-status');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾 Save to Database';
    }
}

function showManualEntry() {
    // Pre-fill with parsed data if available
    if (parsedRecipeData) {
        document.getElementById('meal-name').value = parsedRecipeData.name;
        document.getElementById('meal-type').value = parsedRecipeData.meal_type;
        document.getElementById('kid-level').value = parsedRecipeData.kid_friendly_level;
        document.getElementById('prep-time').value = parsedRecipeData.prep_time_minutes;
        document.getElementById('cook-time').value = parsedRecipeData.cook_time_minutes;
        document.getElementById('adult-friendly').checked = parsedRecipeData.adult_friendly;
        document.getElementById('notes').value = parsedRecipeData.notes || '';

        // Add ingredients
        const ingredientsList = document.getElementById('ingredients-list');
        ingredientsList.innerHTML = '';
        parsedRecipeData.ingredients.forEach(ing => {
            addIngredientField(ing);
        });
    }

    document.getElementById('manual-entry').style.display = 'block';
    document.getElementById('manual-entry').scrollIntoView({ behavior: 'smooth' });
}

function addIngredientField(data = null) {
    const list = document.getElementById('ingredients-list');
    const entry = document.createElement('div');
    entry.className = 'ingredient-entry';

    entry.innerHTML = `
        <input type="text" placeholder="Ingredient name" class="ing-name" value="${data?.name || ''}" required>
        <select class="ing-type" required>
            <option value="protein" ${data?.component_type === 'protein' ? 'selected' : ''}>Protein</option>
            <option value="veggie" ${data?.component_type === 'veggie' ? 'selected' : ''}>Veggie</option>
            <option value="starch" ${data?.component_type === 'starch' ? 'selected' : ''}>Starch</option>
            <option value="fruit" ${data?.component_type === 'fruit' ? 'selected' : ''}>Fruit</option>
            <option value="condiment" ${data?.component_type === 'condiment' ? 'selected' : ''}>Condiment</option>
            <option value="side" ${data?.component_type === 'side' ? 'selected' : ''}>Side</option>
        </select>
        <input type="text" placeholder="Quantity" class="ing-quantity" value="${data?.quantity || ''}">
        <button type="button" class="remove-ingredient">✕</button>
    `;

    entry.querySelector('.remove-ingredient').addEventListener('click', () => {
        entry.remove();
    });

    list.appendChild(entry);
}

async function saveManualRecipe(e) {
    e.preventDefault();

    const ingredients = [];
    document.querySelectorAll('.ingredient-entry').forEach(entry => {
        ingredients.push({
            name: entry.querySelector('.ing-name').value,
            component_type: entry.querySelector('.ing-type').value,
            quantity: entry.querySelector('.ing-quantity').value,
            is_optional: false
        });
    });

    const data = {
        name: document.getElementById('meal-name').value,
        meal_type: document.getElementById('meal-type').value,
        kid_friendly_level: parseInt(document.getElementById('kid-level').value),
        prep_time_minutes: parseInt(document.getElementById('prep-time').value),
        cook_time_minutes: parseInt(document.getElementById('cook-time').value),
        adult_friendly: document.getElementById('adult-friendly').checked,
        notes: document.getElementById('notes').value || null,
        ingredients: ingredients
    };

    try {
        const response = await fetch(`${API_BASE}/api/meals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showStatus('success', 'Meal saved successfully!', 'ai-status');
            document.getElementById('manual-recipe-form').reset();
            document.getElementById('ingredients-list').innerHTML = '';
            document.getElementById('manual-entry').style.display = 'none';
        } else {
            showStatus('error', result.error || 'Failed to save meal', 'ai-status');
        }
    } catch (error) {
        showStatus('error', `Error: ${error.message}`, 'ai-status');
    }
}

// ============================================================================
// Browse Meals
// ============================================================================

function initBrowse() {
    document.getElementById('search-btn').addEventListener('click', searchMeals);
    document.getElementById('search-query').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchMeals();
    });

    // Load all meals initially
    searchMeals();
}

async function searchMeals() {
    const query = document.getElementById('search-query').value;
    const type = document.getElementById('filter-type').value;
    const results = document.getElementById('browse-results');

    results.innerHTML = '<p>Loading...</p>';

    try {
        let url = `${API_BASE}/api/meals`;
        if (type) url += `?type=${type}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            displayMeals(result.data, query);
        } else {
            results.innerHTML = `<p class="error">${result.error}</p>`;
        }
    } catch (error) {
        results.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

function displayMeals(meals, query = '') {
    const results = document.getElementById('browse-results');

    // Filter by query if provided
    if (query) {
        meals = meals.filter(m =>
            m.name.toLowerCase().includes(query.toLowerCase()) ||
            m.ingredients.some(ing => ing.name.toLowerCase().includes(query.toLowerCase()))
        );
    }

    if (meals.length === 0) {
        results.innerHTML = '<p>No meals found.</p>';
        return;
    }

    let html = meals.map(meal => {
        const totalTime = meal.prep_time_minutes + meal.cook_time_minutes;
        return `
            <div class="meal-card-browse">
                <div class="meal-name">${meal.name}</div>
                <div class="meal-meta">
                    <span class="meal-tag">${meal.meal_type_name}</span>
                    <span class="meal-tag">⭐ ${meal.kid_friendly_level}/10</span>
                    <span class="meal-tag">⏱️ ${totalTime} min</span>
                </div>
                ${meal.notes ? `<p><em>${meal.notes}</em></p>` : ''}
                <details>
                    <summary>View Ingredients</summary>
                    <ul>
                        ${meal.ingredients.map(ing =>
                            `<li>${ing.name} <small>(${ing.component_type})</small></li>`
                        ).join('')}
                    </ul>
                </details>
            </div>
        `;
    }).join('');

    results.innerHTML = html;
}

// ============================================================================
// Shopping List
// ============================================================================

function initShopping() {
    document.getElementById('generate-shopping-btn').addEventListener('click', generateShoppingList);
}

async function generateShoppingList() {
    const content = document.getElementById('shopping-list-content');
    content.innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch(`${API_BASE}/api/shopping-list?plan_id=1`);
        const result = await response.json();

        if (result.success) {
            displayShoppingList(result.data);
        } else {
            content.innerHTML = `<p class="error">${result.error}</p>`;
        }
    } catch (error) {
        content.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

function displayShoppingList(data) {
    const content = document.getElementById('shopping-list-content');

    const categoryEmojis = {
        'Protein': '🍗',
        'Veggie': '🥦',
        'Starch': '🍞',
        'Fruit': '🍎',
        'Dairy': '🥛',
        'Pantry': '🧂',
        'Snack': '🍪'
    };

    let html = '';

    Object.keys(data).sort().forEach(category => {
        const emoji = categoryEmojis[category] || '📦';
        html += `
            <div class="shopping-category">
                <h3>${emoji} ${category}</h3>
                ${data[category].map(item => `
                    <div class="shopping-item">
                        <input type="checkbox" onchange="this.parentElement.classList.toggle('checked')">
                        <span>${item.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    });

    content.innerHTML = html || '<p>No items in shopping list.</p>';
}

// ============================================================================
// Utilities
// ============================================================================

function showStatus(type, message, elementId = 'status-msg') {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;

    statusEl.className = `status-msg ${type}`;
    statusEl.textContent = message;

    setTimeout(() => {
        statusEl.className = 'status-msg';
    }, 5000);
}

// ============================================================================
// FAVORITES & HISTORY
// ============================================================================

function initHistory() {
    // Load data when tab is clicked
    const historyTab = document.querySelector('[data-tab="history"]');
    if (historyTab) {
        historyTab.addEventListener('click', () => {
            loadFavorites();
            loadRecentlyCooked();
            loadHaventMade();
            loadHistory();
        });
    }
}

async function toggleFavorite(mealId, button) {
    try {
        const response = await fetch(`/api/meals/${mealId}/toggle-favorite`, {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            button.classList.toggle('favorited');
            button.textContent = data.is_favorite ? '⭐' : '☆';
            showMessage(data.is_favorite ? 'Added to favorites!' : 'Removed from favorites', 'success');

            // Refresh favorites if on history tab
            if (document.getElementById('history').classList.contains('active')) {
                loadFavorites();
            }
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showMessage('Error updating favorite', 'error');
    }
}

async function markAsCooked(mealId) {
    const rating = prompt('How was it? (1-5 stars, or leave blank)');
    const notes = prompt('Any notes? (optional)');

    try {
        const response = await fetch(`/api/meals/${mealId}/mark-cooked`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rating: rating ? parseInt(rating) : null,
                notes: notes || null
            })
        });

        const data = await response.json();
        if (data.success) {
            showMessage('Meal marked as cooked!', 'success');

            // Refresh history if on history tab
            if (document.getElementById('history').classList.contains('active')) {
                loadRecentlyCooked();
                loadHistory();
            }
        }
    } catch (error) {
        console.error('Error marking meal as cooked:', error);
        showMessage('Error saving', 'error');
    }
}

async function loadFavorites() {
    const container = document.getElementById('favorites-content');
    try {
        const response = await fetch('/api/favorites');
        const data = await response.json();

        if (data.meals && data.meals.length > 0) {
            container.innerHTML = '<div class="meals-grid">' +
                data.meals.map(meal => createMealCard(meal, true)).join('') +
                '</div>';
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⭐</div>
                    <p>No favorites yet! Star your favorite meals to see them here.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
        container.innerHTML = '<p class="status-msg error">Error loading favorites</p>';
    }
}

async function loadRecentlyCooked() {
    const container = document.getElementById('recently-cooked-content');
    try {
        const response = await fetch('/api/recently-cooked?limit=5');
        const data = await response.json();

        if (data.meals && data.meals.length > 0) {
            container.innerHTML = data.meals.map(meal => `
                <div class="meal-card">
                    <div class="meal-name">${meal.name}</div>
                    <div class="meal-stats">
                        <span class="meal-stat">📅 Last: ${formatDate(meal.last_cooked)}</span>
                        <span class="meal-stat">🔢 Made ${meal.times_cooked}x</span>
                        ${meal.rating ? `<span class="meal-stat history-rating">${'⭐'.repeat(meal.rating)}</span>` : ''}
                    </div>
                    ${meal.last_notes ? `<div class="history-notes">${meal.last_notes}</div>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🕐</div>
                    <p>No cooking history yet! Mark meals as cooked to see them here.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recent meals:', error);
        container.innerHTML = '<p class="status-msg error">Error loading recent meals</p>';
    }
}

async function loadHaventMade() {
    const container = document.getElementById('havent-made-content');
    try {
        const response = await fetch('/api/havent-made?days=30&limit=5');
        const data = await response.json();

        if (data.meals && data.meals.length > 0) {
            container.innerHTML = '<div class="meals-grid">' +
                data.meals.map(meal => createMealCard(meal, true)).join('') +
                '</div>';
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💡</div>
                    <p>You've been cooking variety! All meals made recently.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        container.innerHTML = '<p class="status-msg error">Error loading suggestions</p>';
    }
}

async function loadHistory() {
    const container = document.getElementById('history-content');
    try {
        const response = await fetch('/api/history?limit=20');
        const data = await response.json();

        if (data.history && data.history.length > 0) {
            container.innerHTML = data.history.map(entry => `
                <div class="history-entry">
                    <div class="history-date">${formatDate(entry.cooked_date)} - ${entry.meal_name}</div>
                    ${entry.rating ? `<div class="history-rating">${'⭐'.repeat(entry.rating)}</div>` : ''}
                    ${entry.notes ? `<div class="history-notes">"${entry.notes}"</div>` : ''}
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <p>No cooking history yet! Start tracking your meals.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading history:', error);
        container.innerHTML = '<p class="status-msg error">Error loading history</p>';
    }
}

function createMealCard(meal, withActions = false) {
    const totalTime = (meal.prep_time_minutes || 0) + (meal.cook_time_minutes || 0);
    const isFavorite = meal.is_favorite || false;

    return `
        <div class="meal-card-browse">
            <div class="meal-name">${meal.name}</div>
            <div class="meal-meta">
                <span class="meal-tag">${meal.meal_type_name || 'meal'}</span>
                <span class="meal-tag kid-friendly">Kid: ${meal.kid_friendly_level}/10</span>
                <span class="meal-tag">⏱️ ${totalTime} min</span>
            </div>
            ${withActions ? `
                <div class="meal-actions">
                    <button class="btn-favorite ${isFavorite ? 'favorited' : ''}"
                            onclick="toggleFavorite(${meal.id}, this)">
                        ${isFavorite ? '⭐' : '☆'}
                    </button>
                    <button class="btn-cooked" onclick="markAsCooked(${meal.id})">
                        ✓ Mark as Cooked
                    </button>
                </div>
            ` : ''}
            ${meal.last_cooked ? `
                <div class="meal-stats">
                    <span class="meal-stat">Last: ${formatDate(meal.last_cooked)}</span>
                    <span class="meal-stat">Made ${meal.times_cooked || 0}x</span>
                </div>
            ` : ''}
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString();
}

// ============================================================================
// Leftovers Management
// ============================================================================

function initLeftovers() {
    const addLeftoverBtn = document.getElementById('add-leftover-btn');
    const refreshSuggestionsBtn = document.getElementById('refresh-suggestions-btn');
    const cookedDateInput = document.getElementById('leftover-cooked-date');

    // Set default cooked date to today
    cookedDateInput.valueAsDate = new Date();

    // Load meals into dropdown
    loadMealsForLeftovers();

    // Load initial data
    loadActiveLeftovers();
    loadLeftoverSuggestions();

    addLeftoverBtn.addEventListener('click', addLeftover);
    refreshSuggestionsBtn.addEventListener('click', loadLeftoverSuggestions);

    // Listen for tab changes to refresh when viewing leftovers tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.getAttribute('data-tab') === 'leftovers') {
                loadActiveLeftovers();
                loadLeftoverSuggestions();
            }
        });
    });
}

async function loadMealsForLeftovers() {
    try {
        const response = await fetch(`${API_BASE}/api/meals`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('leftover-meal-select');
            select.innerHTML = '<option value="">Choose a meal...</option>';

            data.data.forEach(meal => {
                const option = document.createElement('option');
                option.value = meal.id;
                option.textContent = meal.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading meals:', error);
    }
}

async function loadActiveLeftovers() {
    try {
        const response = await fetch(`${API_BASE}/api/leftovers`);
        const data = await response.json();

        const content = document.getElementById('active-leftovers-content');

        if (data.success && data.leftovers && data.leftovers.length > 0) {
            content.innerHTML = data.leftovers.map(leftover => {
                const expiresIn = getDaysUntil(leftover.expires_date);
                const statusClass = expiresIn <= 1 ? 'expiring' : expiresIn <= 2 ? 'soon' : 'fresh';

                return `
                    <div class="leftover-card ${statusClass}">
                        <div class="leftover-header">
                            <h3>${leftover.meal_name}</h3>
                            <span class="leftover-status">${formatExpirationStatus(expiresIn)}</span>
                        </div>
                        <div class="leftover-details">
                            <p><strong>Servings:</strong> ${leftover.servings_remaining}</p>
                            <p><strong>Cooked:</strong> ${formatDate(leftover.cooked_date)}</p>
                            <p><strong>Expires:</strong> ${new Date(leftover.expires_date).toLocaleDateString()}</p>
                        </div>
                        <div class="leftover-actions">
                            <button class="btn btn-sm btn-secondary" onclick="updateServings(${leftover.id}, ${leftover.servings_remaining})">
                                Edit Servings
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="consumeLeftover(${leftover.id})">
                                ✓ Consumed
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            content.innerHTML = `
                <div class="empty-state">
                    <p class="empty-icon">🥡</p>
                    <h3>No leftovers tracked</h3>
                    <p>Add leftovers below to track what's in your fridge</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading leftovers:', error);
        document.getElementById('active-leftovers-content').innerHTML =
            '<p class="status-msg error">Failed to load leftovers</p>';
    }
}

async function loadLeftoverSuggestions() {
    try {
        const response = await fetch(`${API_BASE}/api/leftovers/suggestions`);
        const data = await response.json();

        const content = document.getElementById('leftover-suggestions-content');

        if (data.success && data.suggestions && data.suggestions.length > 0) {
            content.innerHTML = `
                <div class="suggestions-list">
                    ${data.suggestions.map(suggestion => `
                        <div class="suggestion-card">
                            <h4>💡 ${suggestion.suggestion}</h4>
                            <p><strong>${suggestion.meal_name}</strong></p>
                            <p class="suggestion-details">
                                ${suggestion.servings_remaining} servings left •
                                Expires ${formatExpirationStatus(getDaysUntil(suggestion.expires_date))}
                            </p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="empty-state">
                    <p class="empty-icon">💡</p>
                    <h3>No suggestions yet</h3>
                    <p>Add some leftovers to get smart lunch suggestions</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        document.getElementById('leftover-suggestions-content').innerHTML =
            '<p class="status-msg error">Failed to load suggestions</p>';
    }
}

async function addLeftover() {
    const mealId = document.getElementById('leftover-meal-select').value;
    const servings = document.getElementById('leftover-servings').value;
    const days = document.getElementById('leftover-days').value;
    const cookedDate = document.getElementById('leftover-cooked-date').value;

    if (!mealId) {
        alert('Please select a meal');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/leftovers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                meal_id: parseInt(mealId),
                servings: parseInt(servings),
                days_good: parseInt(days),
                cooked_date: cookedDate
            })
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Leftovers added successfully!', 'success');
            // Reset form
            document.getElementById('leftover-meal-select').value = '';
            document.getElementById('leftover-servings').value = '2';
            document.getElementById('leftover-days').value = '3';
            document.getElementById('leftover-cooked-date').valueAsDate = new Date();
            // Reload leftovers
            loadActiveLeftovers();
            loadLeftoverSuggestions();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error adding leftover:', error);
        showStatus('Failed to add leftover', 'error');
    }
}

async function consumeLeftover(leftoverId) {
    if (!confirm('Mark these leftovers as consumed?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/leftovers/${leftoverId}/consume`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Leftovers marked as consumed!', 'success');
            loadActiveLeftovers();
            loadLeftoverSuggestions();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error consuming leftover:', error);
        showStatus('Failed to update', 'error');
    }
}

async function updateServings(leftoverId, currentServings) {
    const newServings = prompt(`Update servings (current: ${currentServings}):`, currentServings);

    if (newServings === null) return;

    const servings = parseInt(newServings);
    if (isNaN(servings) || servings < 0) {
        alert('Please enter a valid number');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/leftovers/${leftoverId}/servings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servings })
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Servings updated!', 'success');
            loadActiveLeftovers();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error updating servings:', error);
        showStatus('Failed to update', 'error');
    }
}

function getDaysUntil(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function formatExpirationStatus(daysUntil) {
    if (daysUntil < 0) return '⚠️ Expired';
    if (daysUntil === 0) return '⚠️ Expires today';
    if (daysUntil === 1) return '🔴 Expires tomorrow';
    if (daysUntil === 2) return '🟡 2 days left';
    return `🟢 ${daysUntil} days left`;
}

// ============================================================================
// School Menu Management
// ============================================================================

function initSchoolMenu() {
    const addMenuItemBtn = document.getElementById('add-school-menu-item-btn');
    const bulkUploadBtn = document.getElementById('bulk-upload-menu-btn');
    const menuDateInput = document.getElementById('school-menu-date');

    // Set default date to today
    menuDateInput.valueAsDate = new Date();

    // Load initial data
    loadTodayLunchPlan();
    loadUpcomingSchoolMenu();

    addMenuItemBtn.addEventListener('click', addSchoolMenuItem);
    bulkUploadBtn.addEventListener('click', bulkUploadSchoolMenu);

    // Listen for tab changes to refresh when viewing school menu tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.getAttribute('data-tab') === 'school-menu') {
                loadTodayLunchPlan();
                loadUpcomingSchoolMenu();
            }
        });
    });
}

async function loadTodayLunchPlan() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_BASE}/api/school-menu/lunch-alternatives/${today}`);
        const data = await response.json();

        const content = document.getElementById('today-lunch-plan');

        if (data.success) {
            const alt = data.data;
            content.innerHTML = `
                <div class="lunch-plan-card">
                    <div class="recommendation-box">
                        <h3>${alt.recommendation}</h3>
                    </div>

                    ${alt.school_menu && alt.school_menu.length > 0 ? `
                        <div class="school-menu-today">
                            <h4>School is serving:</h4>
                            ${alt.school_menu.map(item => `
                                <div class="menu-item ${item.dislike_count > 0 ? 'disliked' : ''}">
                                    <span>${item.meal_name}</span>
                                    ${item.dislike_count > 0 ? '<span class="dislike-badge">👎 Marked as disliked</span>' : ''}
                                    ${item.dislike_count === 0 ? `
                                        <button class="btn-sm btn-secondary" onclick="markDisliked(${item.id}, '${item.meal_name}')">
                                            👎 Kid won't eat this
                                        </button>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>No school menu for today</p>'}

                    ${alt.available_leftovers && alt.available_leftovers.length > 0 ? `
                        <div class="leftovers-available">
                            <h4>🥡 Leftovers available:</h4>
                            ${alt.available_leftovers.map(l => `
                                <div class="leftover-option">
                                    ${l.meal_name} (${l.servings_remaining} servings, ${l.days_until_expiry} days left)
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${alt.quick_lunch_options && alt.quick_lunch_options.length > 0 ? `
                        <div class="quick-options">
                            <h4>🍱 Quick lunch options:</h4>
                            ${alt.quick_lunch_options.map(meal => `
                                <div class="quick-lunch-option">
                                    ${meal.name} (${meal.prep_time_minutes + meal.cook_time_minutes} min)
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            content.innerHTML = '<p class="status-msg error">Failed to load lunch plan</p>';
        }
    } catch (error) {
        console.error('Error loading lunch plan:', error);
        document.getElementById('today-lunch-plan').innerHTML =
            '<p class="status-msg error">Failed to load lunch plan</p>';
    }
}

async function loadUpcomingSchoolMenu() {
    try {
        const response = await fetch(`${API_BASE}/api/school-menu?days=7`);
        const data = await response.json();

        const content = document.getElementById('upcoming-school-menu');

        if (data.success && data.menu_items && data.menu_items.length > 0) {
            // Group by date
            const byDate = {};
            data.menu_items.forEach(item => {
                if (!byDate[item.menu_date]) {
                    byDate[item.menu_date] = [];
                }
                byDate[item.menu_date].push(item);
            });

            content.innerHTML = Object.keys(byDate).sort().map(date => {
                const items = byDate[date];
                const dateObj = new Date(date + 'T00:00:00');
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return `
                    <div class="school-menu-day">
                        <div class="menu-day-header">
                            <strong>${dayName}, ${dateStr}</strong>
                        </div>
                        <div class="menu-items">
                            ${items.map(item => `
                                <div class="menu-item-card ${item.dislike_count > 0 ? 'disliked' : ''}">
                                    <span class="meal-name">${item.meal_name}</span>
                                    ${item.description ? `<span class="meal-description">${item.description}</span>` : ''}
                                    ${item.dislike_count > 0 ? '<span class="dislike-badge">👎 Disliked</span>' : ''}
                                    <button class="btn-delete" onclick="deleteSchoolMenuItem(${item.id})">×</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            content.innerHTML = `
                <div class="empty-state">
                    <p class="empty-icon">📅</p>
                    <h3>No school menu items</h3>
                    <p>Add menu items below to track what's being served at school</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading school menu:', error);
        document.getElementById('upcoming-school-menu').innerHTML =
            '<p class="status-msg error">Failed to load school menu</p>';
    }
}

async function addSchoolMenuItem() {
    const menuDate = document.getElementById('school-menu-date').value;
    const mealName = document.getElementById('school-meal-name').value;
    const mealType = document.getElementById('school-meal-type').value;
    const description = document.getElementById('school-meal-description').value;

    if (!menuDate || !mealName) {
        alert('Please enter date and meal name');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/school-menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                menu_date: menuDate,
                meal_name: mealName,
                meal_type: mealType,
                description: description || null
            })
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Menu item added!', 'success');
            // Reset form
            document.getElementById('school-meal-name').value = '';
            document.getElementById('school-meal-description').value = '';
            document.getElementById('school-menu-date').valueAsDate = new Date();
            // Reload
            loadUpcomingSchoolMenu();
            loadTodayLunchPlan();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error adding menu item:', error);
        showStatus('Failed to add menu item', 'error');
    }
}

async function bulkUploadSchoolMenu() {
    const bulkInput = document.getElementById('school-menu-bulk-input').value;

    if (!bulkInput.trim()) {
        alert('Please paste menu text');
        return;
    }

    // Parse the input (format: "YYYY-MM-DD: Meal Name" or "MM/DD: Meal Name")
    const lines = bulkInput.split('\n').filter(line => line.trim());
    const menuItems = [];
    const currentYear = new Date().getFullYear();

    for (const line of lines) {
        const match = line.match(/(\d{4}-\d{2}-\d{2}|(\d{1,2})\/(\d{1,2})):\s*(.+)/);
        if (match) {
            let menuDate;
            if (match[1].includes('-')) {
                // Full date format
                menuDate = match[1];
            } else {
                // MM/DD format, add current year
                const month = match[2].padStart(2, '0');
                const day = match[3].padStart(2, '0');
                menuDate = `${currentYear}-${month}-${day}`;
            }

            const mealName = match[4].trim();
            menuItems.push({
                menu_date: menuDate,
                meal_name: mealName,
                meal_type: 'lunch'
            });
        }
    }

    if (menuItems.length === 0) {
        alert('No valid menu items found. Format should be "YYYY-MM-DD: Meal Name" or "MM/DD: Meal Name"');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/school-menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(menuItems)
        });

        const data = await response.json();

        if (data.success) {
            showStatus(`Added ${data.added_count} menu items!`, 'success');
            document.getElementById('school-menu-bulk-input').value = '';
            loadUpcomingSchoolMenu();
            loadTodayLunchPlan();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error bulk uploading:', error);
        showStatus('Failed to upload menu', 'error');
    }
}

async function deleteSchoolMenuItem(menuId) {
    if (!confirm('Delete this menu item?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/school-menu/${menuId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Menu item deleted', 'success');
            loadUpcomingSchoolMenu();
            loadTodayLunchPlan();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting menu item:', error);
        showStatus('Failed to delete', 'error');
    }
}

async function markDisliked(menuItemId, mealName) {
    if (!confirm(`Mark "${mealName}" as a meal your kid won't eat?`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/school-menu/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                menu_item_id: menuItemId,
                feedback_type: 'wont_eat',
                notes: 'Marked by parent'
            })
        });

        const data = await response.json();

        if (data.success) {
            showStatus('Feedback recorded', 'success');
            loadTodayLunchPlan();
            loadUpcomingSchoolMenu();
        } else {
            showStatus(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error recording feedback:', error);
        showStatus('Failed to record feedback', 'error');
    }
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRandomizer();
    initRecipeParser();
    initBrowse();
    initShopping();
    initHistory();
    initLeftovers();
    initSchoolMenu();

    console.log('🍽️ Family Meal Planner initialized');
});
