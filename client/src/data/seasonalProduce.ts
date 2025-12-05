// Seasonal produce data by month (US-centric, general availability)
// Each item includes typical shelf life in days for expiry tracking

export interface ProduceItem {
  name: string;
  category: 'vegetable' | 'fruit' | 'herb';
  shelfLifeDays: number; // Typical refrigerator shelf life
  storageTip?: string;
  icon?: string; // Optional emoji for display
}

export interface SeasonalData {
  month: number; // 1-12
  name: string;
  produce: ProduceItem[];
  seasonalTips?: string;
}

// Storage tips for common produce
const STORAGE_TIPS = {
  leafyGreens: 'Store in a produce bag with a paper towel to absorb moisture',
  rootVegetables: 'Store in a cool, dark place or refrigerator crisper drawer',
  citrus: 'Store at room temperature for up to a week, or refrigerate for longer storage',
  apples: 'Store in refrigerator to maintain crispness; keep away from other produce (releases ethylene)',
  squash: 'Store whole in a cool, dry place; refrigerate once cut',
  herbs: 'Trim stems and store in a glass of water in the refrigerator',
  berries: 'Store unwashed in a single layer; wash just before eating',
  tomatoes: 'Store at room temperature until ripe, then refrigerate',
  avocado: 'Ripen at room temperature; refrigerate once ripe to slow ripening',
};

export const SEASONAL_PRODUCE: SeasonalData[] = [
  {
    month: 1,
    name: 'January',
    seasonalTips: 'Peak season for citrus! Stock up on vitamin C.',
    produce: [
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14, storageTip: 'Wrap tightly in plastic; can last weeks' },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Store in a plastic bag in the crisper' },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14, storageTip: 'Wrap in aluminum foil for longest storage' },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10, storageTip: 'Wrap unwashed in plastic in the crisper' },
      { name: 'Parsnips', category: 'vegetable', shelfLifeDays: 21, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28, storageTip: 'Store in a cool, dark, dry place; not in the fridge' },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21, storageTip: 'Store in a cool, dark place; not in the fridge' },
      { name: 'Turnips', category: 'vegetable', shelfLifeDays: 14, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30, storageTip: STORAGE_TIPS.squash },
      { name: 'Grapefruit', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Lemons', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Oranges', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Tangerines', category: 'fruit', shelfLifeDays: 14, storageTip: STORAGE_TIPS.citrus },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28, storageTip: STORAGE_TIPS.apples },
      { name: 'Pears', category: 'fruit', shelfLifeDays: 7, storageTip: 'Ripen at room temperature, refrigerate when ripe' },
    ],
  },
  {
    month: 2,
    name: 'February',
    seasonalTips: 'Last call for winter citrus. Brussels sprouts are at their sweetest after frost.',
    produce: [
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21, storageTip: STORAGE_TIPS.rootVegetables },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Parsnips', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28 },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Turnips', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Grapefruit', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Lemons', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Oranges', category: 'fruit', shelfLifeDays: 21, storageTip: STORAGE_TIPS.citrus },
      { name: 'Tangerines', category: 'fruit', shelfLifeDays: 14 },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28 },
    ],
  },
  {
    month: 3,
    name: 'March',
    seasonalTips: 'Spring greens are starting! Look for early spinach and arugula.',
    produce: [
      { name: 'Artichokes', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Sprinkle with water and store in a plastic bag' },
      { name: 'Asparagus', category: 'vegetable', shelfLifeDays: 4, storageTip: 'Stand upright in a glass of water in the fridge' },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Store unwashed in a loose plastic bag' },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Lettuce', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Mushrooms', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Store in a paper bag; never wash until ready to use' },
      { name: 'Peas', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Use quickly; sugar converts to starch' },
      { name: 'Spinach', category: 'vegetable', shelfLifeDays: 4, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Grapefruit', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Lemons', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Oranges', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Strawberries', category: 'fruit', shelfLifeDays: 3, storageTip: STORAGE_TIPS.berries },
    ],
  },
  {
    month: 4,
    name: 'April',
    seasonalTips: 'Peak asparagus season! Also great for spring peas and early greens.',
    produce: [
      { name: 'Artichokes', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Asparagus', category: 'vegetable', shelfLifeDays: 4, storageTip: 'Stand upright in a glass of water in the fridge' },
      { name: 'Arugula', category: 'vegetable', shelfLifeDays: 3, storageTip: STORAGE_TIPS.leafyGreens },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Fava Beans', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Store in pods; shell just before using' },
      { name: 'Green Onions', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Store in a glass of water in the fridge' },
      { name: 'Lettuce', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Mushrooms', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Peas', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Radishes', category: 'vegetable', shelfLifeDays: 10, storageTip: 'Remove greens before storing; they pull moisture' },
      { name: 'Rhubarb', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Wrap in plastic; leaves are toxic - discard them' },
      { name: 'Spinach', category: 'vegetable', shelfLifeDays: 4 },
      { name: 'Strawberries', category: 'fruit', shelfLifeDays: 3 },
      { name: 'Apricots', category: 'fruit', shelfLifeDays: 5, storageTip: 'Ripen at room temperature; refrigerate when ripe' },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5, storageTip: 'Store at room temperature in water; not in fridge' },
      { name: 'Chives', category: 'herb', shelfLifeDays: 7, storageTip: STORAGE_TIPS.herbs },
      { name: 'Cilantro', category: 'herb', shelfLifeDays: 5, storageTip: STORAGE_TIPS.herbs },
      { name: 'Dill', category: 'herb', shelfLifeDays: 5, storageTip: STORAGE_TIPS.herbs },
      { name: 'Mint', category: 'herb', shelfLifeDays: 7, storageTip: STORAGE_TIPS.herbs },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10, storageTip: STORAGE_TIPS.herbs },
    ],
  },
  {
    month: 5,
    name: 'May',
    seasonalTips: 'Berry season begins! Farmers markets are bursting with variety.',
    produce: [
      { name: 'Artichokes', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Asparagus', category: 'vegetable', shelfLifeDays: 4 },
      { name: 'Arugula', category: 'vegetable', shelfLifeDays: 3 },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Cucumbers', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Wrap in plastic wrap to retain moisture' },
      { name: 'Fava Beans', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Green Beans', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Store unwashed in a plastic bag' },
      { name: 'Lettuce', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Peas', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Radishes', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Rhubarb', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Spinach', category: 'vegetable', shelfLifeDays: 4 },
      { name: 'Zucchini', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Store in a plastic bag in the crisper' },
      { name: 'Apricots', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Cherries', category: 'fruit', shelfLifeDays: 5, storageTip: 'Store unwashed; wash just before eating' },
      { name: 'Strawberries', category: 'fruit', shelfLifeDays: 3 },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5 },
      { name: 'Chives', category: 'herb', shelfLifeDays: 7 },
      { name: 'Cilantro', category: 'herb', shelfLifeDays: 5 },
      { name: 'Dill', category: 'herb', shelfLifeDays: 5 },
      { name: 'Mint', category: 'herb', shelfLifeDays: 7 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 6,
    name: 'June',
    seasonalTips: 'Summer abundance! Tomatoes, stone fruits, and berries are at their peak.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14, storageTip: 'Remove greens; they pull moisture from the beet' },
      { name: 'Bell Peppers', category: 'vegetable', shelfLifeDays: 7, storageTip: 'Store in the crisper drawer' },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Corn', category: 'vegetable', shelfLifeDays: 2, storageTip: 'Use ASAP! Sugar converts to starch quickly' },
      { name: 'Cucumbers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Eggplant', category: 'vegetable', shelfLifeDays: 5, storageTip: 'Store at room temperature; use within a few days' },
      { name: 'Garlic', category: 'vegetable', shelfLifeDays: 60, storageTip: 'Store in a cool, dry place with good air circulation' },
      { name: 'Green Beans', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Lettuce', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30, storageTip: 'Store in a cool, dry place; not near potatoes' },
      { name: 'Peas', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Summer Squash', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Tomatoes', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.tomatoes },
      { name: 'Zucchini', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Apricots', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Blackberries', category: 'fruit', shelfLifeDays: 2, storageTip: STORAGE_TIPS.berries },
      { name: 'Blueberries', category: 'fruit', shelfLifeDays: 5, storageTip: STORAGE_TIPS.berries },
      { name: 'Cherries', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Nectarines', category: 'fruit', shelfLifeDays: 5, storageTip: 'Ripen at room temperature; refrigerate when ripe' },
      { name: 'Peaches', category: 'fruit', shelfLifeDays: 5, storageTip: 'Ripen at room temperature; refrigerate when ripe' },
      { name: 'Plums', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Raspberries', category: 'fruit', shelfLifeDays: 2, storageTip: STORAGE_TIPS.berries },
      { name: 'Strawberries', category: 'fruit', shelfLifeDays: 3 },
      { name: 'Watermelon', category: 'fruit', shelfLifeDays: 7, storageTip: 'Store whole at room temp; refrigerate once cut' },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5 },
      { name: 'Cilantro', category: 'herb', shelfLifeDays: 5 },
      { name: 'Dill', category: 'herb', shelfLifeDays: 5 },
      { name: 'Mint', category: 'herb', shelfLifeDays: 7 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 7,
    name: 'July',
    seasonalTips: 'Peak summer! Corn is sweetest when eaten the same day.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Bell Peppers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Corn', category: 'vegetable', shelfLifeDays: 2 },
      { name: 'Cucumbers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Eggplant', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Garlic', category: 'vegetable', shelfLifeDays: 60 },
      { name: 'Green Beans', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Okra', category: 'vegetable', shelfLifeDays: 3, storageTip: 'Store dry in a paper bag; moisture causes slime' },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Summer Squash', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Tomatoes', category: 'vegetable', shelfLifeDays: 5, storageTip: STORAGE_TIPS.tomatoes },
      { name: 'Zucchini', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Blackberries', category: 'fruit', shelfLifeDays: 2 },
      { name: 'Blueberries', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Cantaloupe', category: 'fruit', shelfLifeDays: 5, storageTip: 'Ripen at room temperature; refrigerate when ripe' },
      { name: 'Cherries', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Grapes', category: 'fruit', shelfLifeDays: 7, storageTip: 'Store unwashed in a perforated bag' },
      { name: 'Nectarines', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Peaches', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Plums', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Raspberries', category: 'fruit', shelfLifeDays: 2 },
      { name: 'Watermelon', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5 },
      { name: 'Cilantro', category: 'herb', shelfLifeDays: 5 },
      { name: 'Dill', category: 'herb', shelfLifeDays: 5 },
      { name: 'Mint', category: 'herb', shelfLifeDays: 7 },
      { name: 'Oregano', category: 'herb', shelfLifeDays: 7 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14, storageTip: 'Wrap in damp paper towel and plastic' },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 8,
    name: 'August',
    seasonalTips: 'Tomato heaven! Great time for canning and preserving.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Bell Peppers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Corn', category: 'vegetable', shelfLifeDays: 2 },
      { name: 'Cucumbers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Eggplant', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Garlic', category: 'vegetable', shelfLifeDays: 60 },
      { name: 'Green Beans', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Hot Peppers', category: 'vegetable', shelfLifeDays: 14, storageTip: 'Store in crisper; use gloves when handling' },
      { name: 'Okra', category: 'vegetable', shelfLifeDays: 3 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Summer Squash', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Tomatoes', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Zucchini', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Blackberries', category: 'fruit', shelfLifeDays: 2 },
      { name: 'Blueberries', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Cantaloupe', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Figs', category: 'fruit', shelfLifeDays: 3, storageTip: 'Very perishable! Use within a few days' },
      { name: 'Grapes', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Honeydew', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Nectarines', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Peaches', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Plums', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Raspberries', category: 'fruit', shelfLifeDays: 2 },
      { name: 'Watermelon', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5 },
      { name: 'Cilantro', category: 'herb', shelfLifeDays: 5 },
      { name: 'Dill', category: 'herb', shelfLifeDays: 5 },
      { name: 'Oregano', category: 'herb', shelfLifeDays: 7 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14 },
      { name: 'Sage', category: 'herb', shelfLifeDays: 7 },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 9,
    name: 'September',
    seasonalTips: 'Fall harvest begins! Apples and winter squash are arriving.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Bell Peppers', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Corn', category: 'vegetable', shelfLifeDays: 2 },
      { name: 'Eggplant', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Garlic', category: 'vegetable', shelfLifeDays: 60 },
      { name: 'Green Beans', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28 },
      { name: 'Spinach', category: 'vegetable', shelfLifeDays: 4 },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Tomatoes', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28, storageTip: STORAGE_TIPS.apples },
      { name: 'Grapes', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Pears', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Plums', category: 'fruit', shelfLifeDays: 5 },
      { name: 'Raspberries', category: 'fruit', shelfLifeDays: 2 },
      { name: 'Basil', category: 'herb', shelfLifeDays: 5 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14 },
      { name: 'Sage', category: 'herb', shelfLifeDays: 7 },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 10,
    name: 'October',
    seasonalTips: 'Apple picking time! Winter squash and pumpkins are perfect for soups.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Garlic', category: 'vegetable', shelfLifeDays: 60 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Mushrooms', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Parsnips', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28 },
      { name: 'Pumpkin', category: 'vegetable', shelfLifeDays: 60, storageTip: 'Store whole in a cool, dry place' },
      { name: 'Spinach', category: 'vegetable', shelfLifeDays: 4 },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Turnips', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28 },
      { name: 'Cranberries', category: 'fruit', shelfLifeDays: 28, storageTip: 'Store in original bag; freeze for longer storage' },
      { name: 'Grapes', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Pears', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Pomegranates', category: 'fruit', shelfLifeDays: 14, storageTip: 'Store whole at room temp or refrigerate' },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14 },
      { name: 'Sage', category: 'herb', shelfLifeDays: 7 },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 11,
    name: 'November',
    seasonalTips: 'Root vegetable season! Perfect for hearty stews and roasts.',
    produce: [
      { name: 'Beets', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Broccoli', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Mushrooms', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Parsnips', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28 },
      { name: 'Pumpkin', category: 'vegetable', shelfLifeDays: 60 },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Turnips', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28 },
      { name: 'Cranberries', category: 'fruit', shelfLifeDays: 28 },
      { name: 'Grapefruit', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Oranges', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Pears', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Pomegranates', category: 'fruit', shelfLifeDays: 14 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14 },
      { name: 'Sage', category: 'herb', shelfLifeDays: 7 },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
  {
    month: 12,
    name: 'December',
    seasonalTips: 'Citrus season starts! Great for holiday baking and brightening winter meals.',
    produce: [
      { name: 'Brussels Sprouts', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Cabbage', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Carrots', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Cauliflower', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Celery', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Kale', category: 'vegetable', shelfLifeDays: 5 },
      { name: 'Leeks', category: 'vegetable', shelfLifeDays: 10 },
      { name: 'Mushrooms', category: 'vegetable', shelfLifeDays: 7 },
      { name: 'Onions', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Parsnips', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Potatoes', category: 'vegetable', shelfLifeDays: 28 },
      { name: 'Sweet Potatoes', category: 'vegetable', shelfLifeDays: 21 },
      { name: 'Turnips', category: 'vegetable', shelfLifeDays: 14 },
      { name: 'Winter Squash', category: 'vegetable', shelfLifeDays: 30 },
      { name: 'Apples', category: 'fruit', shelfLifeDays: 28 },
      { name: 'Cranberries', category: 'fruit', shelfLifeDays: 28 },
      { name: 'Grapefruit', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Lemons', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Oranges', category: 'fruit', shelfLifeDays: 21 },
      { name: 'Pears', category: 'fruit', shelfLifeDays: 7 },
      { name: 'Pomegranates', category: 'fruit', shelfLifeDays: 14 },
      { name: 'Tangerines', category: 'fruit', shelfLifeDays: 14 },
      { name: 'Parsley', category: 'herb', shelfLifeDays: 10 },
      { name: 'Rosemary', category: 'herb', shelfLifeDays: 14 },
      { name: 'Sage', category: 'herb', shelfLifeDays: 7 },
      { name: 'Thyme', category: 'herb', shelfLifeDays: 10 },
    ],
  },
];

// Helper function to get current month's produce
export const getCurrentSeasonalProduce = (): SeasonalData => {
  const currentMonth = new Date().getMonth() + 1; // getMonth() is 0-indexed
  return SEASONAL_PRODUCE.find(s => s.month === currentMonth) || SEASONAL_PRODUCE[0];
};

// Helper function to get produce by month number
export const getSeasonalProduceByMonth = (month: number): SeasonalData => {
  return SEASONAL_PRODUCE.find(s => s.month === month) || SEASONAL_PRODUCE[0];
};

// Get all unique produce items across all months (for autocomplete)
export const getAllProduceItems = (): ProduceItem[] => {
  const seen = new Set<string>();
  const items: ProduceItem[] = [];

  SEASONAL_PRODUCE.forEach(month => {
    month.produce.forEach(item => {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        items.push(item);
      }
    });
  });

  return items.sort((a, b) => a.name.localeCompare(b.name));
};

// Check if an item is in season for a given month
export const isInSeason = (itemName: string, month?: number): boolean => {
  const targetMonth = month || new Date().getMonth() + 1;
  const seasonData = SEASONAL_PRODUCE.find(s => s.month === targetMonth);
  if (!seasonData) return false;

  return seasonData.produce.some(
    p => p.name.toLowerCase() === itemName.toLowerCase()
  );
};

// Get shelf life for a produce item
export const getShelfLife = (itemName: string): number => {
  for (const month of SEASONAL_PRODUCE) {
    const item = month.produce.find(
      p => p.name.toLowerCase() === itemName.toLowerCase()
    );
    if (item) return item.shelfLifeDays;
  }
  return 7; // Default to 7 days if not found
};

// Get storage tip for a produce item
export const getStorageTip = (itemName: string): string | undefined => {
  for (const month of SEASONAL_PRODUCE) {
    const item = month.produce.find(
      p => p.name.toLowerCase() === itemName.toLowerCase()
    );
    if (item?.storageTip) return item.storageTip;
  }
  return undefined;
};
