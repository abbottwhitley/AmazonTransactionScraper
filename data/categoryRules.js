(function() {
  'use strict';

  /**
   * Category classification rules
   * Maps keywords to budget categories for automatic item categorization
   */
  const CATEGORY_RULES = {
    'Going Out': [
      'movie', 'theater', 'cinema', 'concert', 'event ticket', 'admission', 'entertainment ticket'
    ],
    
    'Baby Supplies': [
      'diaper', 'diapers', 'wipes', 'baby wipes', 'baby food', 'formula', 'infant formula',
      'baby bottle', 'bottle', 'pacifier', 'soother', 'bib', 'onesie', 'baby clothes',
      'stroller', 'car seat', 'baby carrier', 'crib', 'bassinet', 'changing pad',
      'baby monitor', 'baby gate', 'high chair', 'booster seat', 'toy', 'baby toy',
      'baby gear', 'infant', 'toddler', 'gerber', 'enfamil', 'similac', 'pampers', 'huggies'
    ],
    
    'Auto & Transport': [
      'car', 'vehicle', 'automotive', 'tire', 'tires', 'auto parts', 'car parts',
      'motor oil', 'oil filter', 'air filter', 'battery', 'car battery', 'brake',
      'transmission', 'exhaust', 'muffler', 'radiator', 'windscreen', 'windshield',
      'wiper', 'blade', 'gas cap', 'fuse', 'bulb', 'headlight', 'taillight',
      'car wash', 'detailing', 'gas', 'fuel', 'gasoline', 'diesel'
    ],
    
    'Babysitter & Daycare': [
      'daycare', 'day care', 'childcare', 'child care', 'babysitter', 'nanny',
      'preschool', 'pre-school', 'after school', 'camp', 'summer camp'
    ],
    
    'Entertainment': [
      'game', 'video game', 'console', 'playstation', 'xbox', 'nintendo',
      'book', 'ebook', 'kindle', 'magazine', 'subscription', 'netflix', 'spotify',
      'music', 'song', 'album', 'cd', 'dvd', 'blu-ray', 'streaming'
    ],
    
    'Gifts & Donations': [
      'gift', 'present', 'card', 'gift card', 'gift wrap', 'wrapping paper',
      'donation', 'charity', 'fundraising', 'fundraiser'
    ],
    
    'Groceries': [
      'grocery', 'food', 'fresh', 'produce', 'vegetable', 'fruit', 'meat', 'poultry',
      'beef', 'chicken', 'pork', 'fish', 'seafood', 'dairy', 'milk', 'cheese', 'yogurt',
      'eggs', 'bread', 'bakery', 'cereal', 'pasta', 'rice', 'grains', 'snack',
      'organic', '365', 'whole foods', 'fresh foods', 'frozen food', 'frozen foods',
      'beverage', 'drink', 'juice', 'soda', 'water', 'sparkling water'
    ],
    
    'HealthCare': [
      'medicine', 'medication', 'prescription', 'pharmacy', 'drug', 'vitamin',
      'supplement', 'bandage', 'band-aid', 'first aid', 'thermometer', 'pain reliever',
      'aspirin', 'ibuprofen', 'tylenol', 'cold medicine', 'cough', 'allergy',
      'medical', 'health', 'wellness', 'fitness', 'exercise', 'gym', 'yoga',
      'doctor', 'physician', 'clinic', 'hospital', 'dental', 'dentist', 'eye exam',
      'glasses', 'contacts', 'contact lenses', 'hearing aid', 'cpap'
    ],
    
    'Home Improvement': [
      'paint', 'brush', 'roller', 'tool', 'power tool', 'drill', 'saw', 'hammer',
      'screwdriver', 'wrench', 'pliers', 'ladder', 'scaffold', 'lumber', 'wood',
      'plywood', 'drywall', 'insulation', 'roofing', 'siding', 'flooring', 'tile',
      'hardware', 'screw', 'nail', 'bolt', 'nut', 'washer', 'hinge', 'lock',
      'door', 'window', 'cabinet', 'countertop', 'faucet', 'sink', 'toilet',
      'shower', 'bathtub', 'vanity', 'mirror', 'light fixture', 'ceiling fan',
      'electrical', 'wiring', 'outlet', 'switch', 'breaker', 'panel', 'pipe',
      'plumbing', 'hvac', 'heating', 'cooling', 'furnace', 'air conditioner'
    ],
    
    'Home Suppies': [
      'home supply', 'household', 'cleaning', 'cleaner', 'detergent', 'soap',
      'dish soap', 'laundry', 'fabric softener', 'bleach', 'paper towel', 'toilet paper',
      'tissue', 'napkin', 'trash bag', 'garbage bag', 'ziploc', 'aluminum foil',
      'plastic wrap', 'saran wrap', 'wax paper', 'parchment paper', 'sponge',
      'scrub', 'brush', 'mop', 'broom', 'vacuum', 'vacuum bag', 'filter',
      'air freshener', 'candle', 'battery', 'light bulb', 'bulb', 'extension cord',
      'storage', 'container', 'bin', 'basket', 'organizer', 'hanger', 'clothes hanger',
      'mattress', 'pillow', 'sheet', 'blanket', 'comforter', 'duvet', 'curtain',
      'drapes', 'blind', 'shade', 'rug', 'carpet', 'towel', 'bath towel', 'hand towel',
      'washcloth', 'bathmat', 'shower curtain', 'toilet brush', 'plunger'
    ],
    
    'Pets': [
      'pet', 'dog', 'cat', 'puppy', 'kitten', 'pet food', 'dog food', 'cat food',
      'pet supply', 'pet toy', 'treat', 'pet treat', 'leash', 'collar', 'harness',
      'cage', 'crate', 'kennel', 'bed', 'pet bed', 'litter', 'litter box',
      'scratching post', 'cat tree', 'grooming', 'brush', 'pet brush', 'shampoo',
      'flea', 'tick', 'medication', 'pet medication', 'vet', 'veterinary'
    ],
    
    'Resturants': [
      'restaurant', 'restaurants', 'dining', 'takeout', 'take-out', 'delivery',
      'fast food', 'pizza', 'burger', 'sandwich', 'coffee', 'cafe', 'starbucks',
      'subway', 'mcdonald', 'kfc', 'taco bell', 'chipotle', 'panera', 'grubhub',
      'doordash', 'ubereats', 'uber eats', 'postmates', 'seamless'
    ],
    
    'Shopping': [
      // Default category - intentionally left mostly empty
      // Items that don't match other categories will fall back to Shopping
    ],
    
    'Travel': [
      'hotel', 'reservation', 'booking', 'flight', 'airline', 'airfare', 'ticket',
      'luggage', 'suitcase', 'bag', 'travel bag', 'passport', 'visa', 'travel',
      'vacation', 'trip', 'cruise', 'car rental', 'rental car', 'uber', 'lyft',
      'taxi', 'train', 'rail', 'amtrak', 'bus', 'greyhound', 'airport', 'parking',
      'resort', 'spa', 'tour', 'excursion'
    ]
  };

  /**
   * Gets all available category names
   * @returns {Array<string>} Array of category names
   */
  function getCategories() {
    return Object.keys(CATEGORY_RULES);
  }

  /**
   * Categorizes an item name based on keyword matching
   * @param {string} itemName - The item name to categorize
   * @param {Object} customRules - Optional custom rules to override defaults
   * @returns {string} Category name (defaults to 'Shopping')
   */
  function categorizeItem(itemName, customRules = null) {
    if (!itemName || typeof itemName !== 'string') {
      return 'Shopping';
    }

    const rules = customRules || CATEGORY_RULES;
    const normalizedItem = itemName.toLowerCase().trim();

    // Check each category (except Shopping, which is the default)
    for (const [category, keywords] of Object.entries(rules)) {
      if (category === 'Shopping') continue; // Skip default category
      
      if (keywords && keywords.length > 0) {
        for (const keyword of keywords) {
          if (normalizedItem.includes(keyword.toLowerCase())) {
            return category;
          }
        }
      }
    }

    // Default to Shopping if no match found
    return 'Shopping';
  }

  /**
   * Categorizes multiple items and returns the primary category
   * For orders with multiple items, returns the first non-Shopping category found,
   * or Shopping if all items are categorized as Shopping
   * @param {Array<string>|string} items - Array of item names or semicolon-separated string
   * @param {Object} customRules - Optional custom rules to override defaults
   * @returns {string} Primary category for the order
   */
  function categorizeOrder(items, customRules = null) {
    if (!items) {
      return 'Shopping';
    }

    // Convert string to array if needed
    const itemArray = typeof items === 'string' 
      ? items.split(';').map(item => item.trim()).filter(item => item.length > 0)
      : (Array.isArray(items) ? items : []);

    if (itemArray.length === 0) {
      return 'Shopping';
    }

    // Categorize each item
    const categories = itemArray.map(item => categorizeItem(item, customRules));

    // Find first non-Shopping category (prioritize specific categories)
    const nonShoppingCategory = categories.find(cat => cat !== 'Shopping');
    if (nonShoppingCategory) {
      return nonShoppingCategory;
    }

    // If all items are Shopping, return Shopping
    return 'Shopping';
  }

  // Expose globally
  window.AmazonExporterCategoryRules = {
    getCategories,
    categorizeItem,
    categorizeOrder,
    CATEGORY_RULES // Expose for customization/extension
  };

})();

