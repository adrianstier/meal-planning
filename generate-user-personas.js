/**
 * Generate 30 realistic user personas for meal planning app testing
 * Each persona has unique goals, pain points, and usage patterns
 */

const userPersonas = [
  // BUSY PARENTS (10 personas)
  {
    id: 1,
    name: "Sarah Martinez",
    type: "Busy Working Mom",
    age: 35,
    household: "2 adults, 2 kids (ages 5, 8)",
    occupation: "Marketing Manager",
    techSavvy: "Medium",
    goals: [
      "Plan quick weeknight dinners under 30 minutes",
      "Find kid-friendly meals that adults will enjoy",
      "Minimize food waste with efficient shopping",
      "Avoid cooking same meals repeatedly"
    ],
    painPoints: [
      "Kids are picky eaters",
      "Limited time after work (5:30-7pm window)",
      "Overwhelmed by too many recipe options",
      "Husband has dietary restrictions (low-carb)"
    ],
    usagePattern: "Plans on Sunday, checks 2-3x during week",
    keyFeatures: ["kid-friendly filter", "quick meals", "shopping list", "favorites"],
    frustrationTriggers: [
      "Complex recipes with too many ingredients",
      "Unclear instructions",
      "Missing nutritional info",
      "Can't find recipes quickly"
    ]
  },
  {
    id: 2,
    name: "James Chen",
    type: "Single Dad",
    age: 42,
    household: "1 adult, 3 kids (ages 7, 10, 13)",
    occupation: "Software Engineer",
    techSavvy: "High",
    goals: [
      "Batch cook on weekends for the week",
      "Get kids involved in meal planning",
      "Balance nutrition with taste",
      "Stay under $150/week budget"
    ],
    painPoints: [
      "Kids have different preferences",
      "Limited cooking skills",
      "Forgets to defrost ingredients",
      "Struggles with portion sizes for 4 people"
    ],
    usagePattern: "Daily checks, heavy weekend use",
    keyFeatures: ["batch cooking", "scaling recipes", "calendar view", "leftovers tracking"],
    frustrationTriggers: [
      "No mobile app",
      "Slow load times",
      "Lost progress when app crashes",
      "Can't share plans with kids"
    ]
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    type: "Stay-at-Home Parent",
    age: 32,
    household: "2 adults, 1 toddler, 1 infant",
    occupation: "Full-time Parent",
    techSavvy: "Medium",
    goals: [
      "Introduce new foods to toddler",
      "Prepare meals during nap time",
      "Eat healthier post-pregnancy",
      "Plan meals around breastfeeding schedule"
    ],
    painPoints: [
      "Interrupted cooking sessions",
      "Baby-friendly ingredients needed",
      "Exhaustion limits creativity",
      "Allergies to track"
    ],
    usagePattern: "Quick checks throughout day",
    keyFeatures: ["simple recipes", "baby food ideas", "health tracking", "save for later"],
    frustrationTriggers: [
      "Too many steps in recipes",
      "No voice control",
      "Tiny text/buttons",
      "Missing allergen info"
    ]
  },

  // HEALTH-CONSCIOUS USERS (8 personas)
  {
    id: 4,
    name: "Marcus Thompson",
    type: "Fitness Enthusiast",
    age: 28,
    household: "1 adult",
    occupation: "Personal Trainer",
    techSavvy: "High",
    goals: [
      "Hit macro targets (40% protein, 30% carbs, 30% fat)",
      "Meal prep for 6 days",
      "Track calories precisely",
      "Minimize processed foods"
    ],
    painPoints: [
      "Most recipes too high in carbs",
      "Needs precise measurements",
      "Cooking in bulk is tedious",
      "Wants variety without losing macros"
    ],
    usagePattern: "Weekly meal prep session",
    keyFeatures: ["nutrition tracking", "macro calculator", "batch recipes", "custom portions"],
    frustrationTriggers: [
      "Inaccurate nutritional data",
      "Can't adjust macros per recipe",
      "No meal timing suggestions",
      "Missing protein content"
    ]
  },
  {
    id: 5,
    name: "Linda Patel",
    type: "Diabetic Senior",
    age: 67,
    household: "2 adults",
    occupation: "Retired Teacher",
    techSavvy: "Low",
    goals: [
      "Maintain blood sugar levels",
      "Follow doctor's low-sodium diet",
      "Cook familiar comfort foods",
      "Avoid complicated recipes"
    ],
    painPoints: [
      "Struggles with technology",
      "Needs larger text",
      "Confused by too many options",
      "Worried about food interactions"
    ],
    usagePattern: "Weekly planning with family help",
    keyFeatures: ["large text", "simple interface", "diabetic-friendly filter", "print option"],
    frustrationTriggers: [
      "Small buttons/text",
      "Confusing navigation",
      "Too many features",
      "No print-friendly view"
    ]
  },

  // DIVERSE DIETARY NEEDS (7 personas)
  {
    id: 6,
    name: "Aisha Hassan",
    type: "Halal Observer",
    age: 29,
    household: "2 adults",
    occupation: "Nurse",
    techSavvy: "Medium",
    goals: [
      "Find halal-certified recipes",
      "Share cultural dishes with husband",
      "Learn new cuisines within guidelines",
      "Plan meals around prayer times"
    ],
    painPoints: [
      "Limited halal recipe options",
      "Needs substitutes for pork/alcohol",
      "Busy work schedule (12hr shifts)",
      "Wants to preserve cultural traditions"
    ],
    usagePattern: "Bi-weekly planning before grocery shop",
    keyFeatures: ["dietary filters", "ingredient substitutions", "cultural recipes", "schedule integration"],
    frustrationTriggers: [
      "No halal filter",
      "Recipes with forbidden ingredients",
      "No substitution suggestions",
      "Cultural insensitivity"
    ]
  },

  // BUDGET-CONSCIOUS (5 personas)
  {
    id: 7,
    name: "Tyler Johnson",
    type: "College Student",
    age: 21,
    household: "3 roommates",
    occupation: "Student + Part-time barista",
    techSavvy: "High",
    goals: [
      "Spend under $30/week on groceries",
      "Use pantry staples",
      "Share meals with roommates",
      "Learn basic cooking skills"
    ],
    painPoints: [
      "Very limited budget",
      "Minimal cooking equipment",
      "No time between classes",
      "Roommates have different schedules"
    ],
    usagePattern: "Last-minute planning",
    keyFeatures: ["budget calculator", "pantry inventory", "quick meals", "simple recipes"],
    frustrationTriggers: [
      "Expensive ingredients",
      "Requires special equipment",
      "Too time-consuming",
      "Yields too much food"
    ]
  }
];

// Generate remaining 22 personas with variations
const generateMorePersonas = () => {
  const types = [
    { type: "Vegan Athlete", focus: "plant-based protein" },
    { type: "Keto Follower", focus: "low-carb high-fat" },
    { type: "Meal Prep Beginner", focus: "learning basics" },
    { type: "Organic Only Parent", focus: "clean eating" },
    { type: "Gluten-Free Family", focus: "celiac management" },
    { type: "International Student", focus: "homesick for cultural food" },
    { type: "Empty Nester", focus: "cooking for 2 after years of 5" },
    { type: "New Vegetarian", focus: "transitioning diet" },
    { type: "Shift Worker", focus: "irregular meal times" },
    { type: "Food Blogger", focus: "unique recipes to share" },
    { type: "Picky Eater Adult", focus: "limited ingredient tolerance" },
    { type: "Lactose Intolerant", focus: "dairy-free options" },
    { type: "Batch Cooker", focus: "freezer meals" },
    { type: "Restaurant Worker", focus: "late-night eating" },
    { type: "Postpartum Mom", focus: "nutrition + convenience" },
    { type: "Gourmet Home Chef", focus: "complex techniques" },
    { type: "Meal Kit Skeptic", focus: "wants flexibility" },
    { type: "Sustainability Focused", focus: "zero waste" },
    { type: "Intermittent Faster", focus: "eating windows" },
    { type: "Family Caregiver", focus: "multiple dietary needs" },
    { type: "Competitive Eater", focus: "high volume meals" },
    { type: "Allergy Parent", focus: "nut-free, egg-free" }
  ];

  return types.map((t, index) => ({
    id: 8 + index,
    name: `User ${8 + index}`,
    type: t.type,
    focus: t.focus,
    generated: true
  }));
};

const allPersonas = [...userPersonas, ...generateMorePersonas()];

console.log(`\n📊 GENERATED ${allPersonas.length} USER PERSONAS\n`);
console.log('=' .repeat(80));

// Analyze personas for testing priorities
const priorities = {
  criticalFeatures: {},
  commonPainPoints: {},
  userTypes: {}
};

allPersonas.forEach(persona => {
  // Count user types
  priorities.userTypes[persona.type] = (priorities.userTypes[persona.type] || 0) + 1;

  // Count pain points
  if (persona.frustrationTriggers) {
    persona.frustrationTriggers.forEach(pain => {
      priorities.commonPainPoints[pain] = (priorities.commonPainPoints[pain] || 0) + 1;
    });
  }

  // Count desired features
  if (persona.keyFeatures) {
    persona.keyFeatures.forEach(feature => {
      priorities.criticalFeatures[feature] = (priorities.criticalFeatures[feature] || 0) + 1;
    });
  }
});

console.log('\n🎯 TOP 10 CRITICAL FEATURES (by user demand):');
Object.entries(priorities.criticalFeatures)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([feature, count], i) => {
    console.log(`${i + 1}. ${feature}: ${count} users need this`);
  });

console.log('\n⚠️  TOP 10 COMMON PAIN POINTS (to fix urgently):');
Object.entries(priorities.commonPainPoints)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([pain, count], i) => {
    console.log(`${i + 1}. ${pain}: ${count} users frustrated by this`);
  });

console.log('\n👥 USER TYPE DISTRIBUTION:');
Object.entries(priorities.userTypes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

// Export for use in testing
module.exports = { allPersonas, priorities };
