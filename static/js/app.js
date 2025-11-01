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
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRandomizer();
    initRecipeParser();
    initBrowse();
    initShopping();

    console.log('🍽️ Family Meal Planner initialized');
});
