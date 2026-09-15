type TrendTopicForCategory = {
  topic: string;
  displayName?: string;
  description?: string;
  [key: string]: unknown;
};

type TrendCategoryRule = {
  category: string;
  keywords: readonly string[];
};

const PROVIDED_CATEGORY_KEYS = ['category', 'categoryName', 'topicCategory'];

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  ai: 'Technology',
  arts: 'Arts',
  'arts/culture': 'Arts',
  'arts culture': 'Arts',
  business: 'Business',
  entertainment: 'Entertainment',
  events: 'Events',
  feeds: 'Feeds',
  gaming: 'Gaming',
  lifestyle: 'Lifestyle',
  movies: 'Entertainment',
  music: 'Entertainment',
  news: 'News',
  politics: 'Politics',
  science: 'Science',
  sports: 'Sports',
  technology: 'Technology',
  world: 'World'
};

const TREND_CATEGORY_OVERRIDES: Record<string, string> = {
  'andy burnham': 'Politics',
  'ben palmer': 'Politics',
  'bfc registration': 'Events',
  'blue sky art show': 'Arts',
  'bluesky art show': 'Arts',
  'canadian gp': 'Sports',
  'colbert show': 'Entertainment',
  'digital art': 'Entertainment',
  desantis: 'Politics',
  'epstein files': 'Politics',
  'epstein scandals': 'Politics',
  'european cities': 'World',
  'formula 1': 'Sports',
  'gop bill delay': 'Politics',
  habs: 'Sports',
  'hull fc': 'Sports',
  'ice protests': 'Politics',
  'indie games': 'Gaming',
  knicks: 'Sports',
  'missile threat': 'World',
  'nba playoffs': 'Sports',
  royals: 'Sports',
  'stephen colbert': 'Entertainment',
  svengoolie: 'Entertainment',
  'tall photography': 'Arts',
  texier: 'Sports',
  'the mandalorian': 'Entertainment',
  'trans rights': 'Politics'
};

const TREND_CATEGORY_RULES: readonly TrendCategoryRule[] = [
  {
    category: 'World',
    keywords: [
      'conflict',
      'diplomacy',
      'foreign policy',
      'geopolitics',
      'global',
      'iran',
      'middle east',
      'missile',
      'nato',
      'nuclear',
      'palestine',
      'russia',
      'treaty',
      'ukraine',
      'war',
      'world'
    ]
  },
  {
    category: 'Politics',
    keywords: [
      'administration',
      'biden',
      'bill',
      'cabinet',
      'civil rights',
      'congress',
      'court',
      'democrat',
      'democratic',
      'election',
      'gop',
      'government',
      'governor',
      'harris',
      'human rights',
      'ice',
      'immigration',
      'lgbtq',
      'mayor',
      'minister',
      'obama',
      'parliament',
      'party',
      'policy',
      'politics',
      'president',
      'prime minister',
      'protest',
      'republican',
      'senate',
      'scandal',
      'supreme court',
      'transgender',
      'trump',
      'white house'
    ]
  },
  {
    category: 'Sports',
    keywords: [
      'baseball',
      'basketball',
      'champions league',
      'championship',
      'f1',
      'fc',
      'football',
      'grand prix',
      'hockey',
      'mlb',
      'nba',
      'nfl',
      'nhl',
      'olympics',
      'playoffs',
      'rugby',
      'soccer',
      'sports',
      'uefa',
      'uwcl',
      'wrestling',
      'wnba',
      'world cup'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'album',
      'anime',
      'art',
      'artist',
      'celebrity',
      'cinema',
      'comedian',
      'comedy',
      'film',
      'films',
      'mando',
      'movie',
      'movies',
      'music',
      'oscars',
      'pop culture',
      'review',
      'show',
      'star wars',
      'television',
      'tv'
    ]
  },
  {
    category: 'Gaming',
    keywords: [
      'game dev',
      'game development',
      'gaming',
      'indie game',
      'nintendo',
      'playstation',
      'steam',
      'video game',
      'xbox'
    ]
  },
  {
    category: 'Technology',
    keywords: [
      'ai',
      'android',
      'apple',
      'bluesky',
      'google',
      'ios',
      'openai',
      'programming',
      'software',
      'tech',
      'technology',
      'web dev'
    ]
  },
  {
    category: 'Business',
    keywords: [
      'business',
      'crypto',
      'economy',
      'market',
      'stock',
      'stocks',
      'tariff'
    ]
  },
  {
    category: 'Arts',
    keywords: [
      'art show',
      'painting',
      'photo',
      'photography',
      'pixelart',
      'watercolor'
    ]
  },
  {
    category: 'Events',
    keywords: ['conference', 'convention', 'event', 'festival', 'tickets']
  },
  {
    category: 'Science',
    keywords: ['climate', 'nasa', 'science', 'space']
  },
  {
    category: 'Lifestyle',
    keywords: ['beauty', 'fashion', 'fitness', 'food', 'gardening', 'health']
  },
  {
    category: 'News',
    keywords: ['breaking news', 'headline', 'news', 'report']
  }
] as const;

function normalizeCategoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[#_]+/g, ' ')
    .replace(/[^a-z0-9&/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatProvidedCategory(value: string): string | null {
  const normalizedCategory = normalizeCategoryText(value);

  if (!normalizedCategory) return null;

  return (CATEGORY_DISPLAY_NAMES[normalizedCategory] ?? normalizedCategory.replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function getProvidedTrendCategory(topic: TrendTopicForCategory): string | null {
  for (const key of PROVIDED_CATEGORY_KEYS) {
    const value = topic[key];

    if (typeof value === 'string') return formatProvidedCategory(value);
  }

  return null;
}

function containsCategoryKeyword(value: string, keyword: string): boolean {
  const normalizedKeyword = normalizeCategoryText(keyword);
  const escapedKeyword = normalizedKeyword.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`).test(value);
}

export function getTrendCategory(topic: TrendTopicForCategory): string | null {
  const providedCategory = getProvidedTrendCategory(topic);

  if (providedCategory) return providedCategory;

  const normalizedTopic = normalizeCategoryText(topic.topic);
  const override = TREND_CATEGORY_OVERRIDES[normalizedTopic];

  if (override) return override;

  const searchableText = normalizeCategoryText(
    `${topic.topic} ${topic.displayName ?? ''} ${topic.description ?? ''}`
  );
  const matchingRule = TREND_CATEGORY_RULES.find(({ keywords }) =>
    keywords.some((keyword) => containsCategoryKeyword(searchableText, keyword))
  );

  return matchingRule?.category ?? null;
}
