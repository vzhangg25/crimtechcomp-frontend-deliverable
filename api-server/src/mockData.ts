/**
 * Generates mock article data for the API
 */

export interface ArticleListItem {
  id: string;
  title: string;
  dek: string;
  author: string;
  publishedAt: string;
  readingTimeMins: number;
  imageUrl: string;
  contentHtml: string; // Full article content for rendering in the feed
}

export interface ArticleDetail {
  id: string;
  title: string;
  author: string;
  publishedAt: string;
  contentHtml: string;
}

const AUTHORS = [
  'Sarah Chen',
  'Michael Rodriguez',
  'Emily Johnson',
  'David Kim',
  'Jessica Martinez',
  'James Wilson',
  'Amanda Brown',
  'Robert Taylor',
];

const TOPICS = [
  'Technology',
  'Science',
  'Business',
  'Health',
  'Culture',
  'Politics',
  'Environment',
  'Education',
];

// Curated Picsum image IDs that visually match each topic
// Each topic has multiple image IDs to provide variety
const TOPIC_IMAGES: Record<string, number[]> = {
  'Technology': [0, 1, 2, 60, 180, 366, 403, 407, 4, 48],  // Tech/computer images
  'Science': [250, 256, 292, 507, 567, 614, 688, 818, 835, 904], // Abstract/scientific
  'Business': [3, 30, 42, 158, 213, 286, 380, 453, 564, 593],  // Office/professional
  'Health': [306, 325, 434, 452, 574, 620, 628, 659, 823, 866], // Health/wellness
  'Culture': [36, 56, 96, 106, 193, 201, 244, 297, 399, 447],   // Art/culture
  'Politics': [122, 154, 164, 238, 274, 339, 357, 390, 465, 538], // Architecture/civic
  'Environment': [10, 13, 14, 15, 16, 17, 18, 28, 29, 39],      // Nature/landscape
  'Education': [20, 24, 51, 204, 367, 397, 435, 445, 490, 525], // Books/learning
};

const SAMPLE_CONTENT = [
  `<p>In recent developments, the landscape of modern technology continues to evolve at a rapid pace. This article explores the key trends shaping our digital future and their implications for businesses and consumers alike.</p>
  <p>The integration of artificial intelligence into everyday applications has become increasingly prevalent. From recommendation systems to automated customer service, AI is transforming how we interact with digital platforms.</p>
  <p>As we look ahead, it's clear that understanding these technological shifts will be crucial for staying competitive in an ever-changing market.</p>`,
  
  `<p>Scientific research has uncovered fascinating insights into the natural world. This comprehensive analysis delves into recent discoveries that challenge our understanding of fundamental processes.</p>
  <p>The implications of these findings extend far beyond the laboratory. They offer new perspectives on how we approach complex problems and develop innovative solutions.</p>
  <p>Researchers continue to push the boundaries of knowledge, opening doors to possibilities that were once considered science fiction.</p>`,
  
  `<p>The business world is experiencing unprecedented transformation. Companies that adapt quickly to changing market conditions are finding new opportunities for growth and innovation.</p>
  <p>Strategic planning and agile methodologies have become essential tools for navigating today's complex business environment. Leaders must balance short-term objectives with long-term vision.</p>
  <p>Success in the modern marketplace requires a combination of technical expertise, creative thinking, and the ability to connect with customers on a meaningful level.</p>`,
  
  `<p>Health and wellness have taken center stage in public discourse. New research is providing valuable insights into how lifestyle choices impact our overall well-being.</p>
  <p>Preventive care and early intervention strategies are proving to be more effective than reactive approaches. This shift in perspective is reshaping healthcare delivery models.</p>
  <p>As we learn more about the connections between physical and mental health, integrated approaches to wellness are gaining traction among healthcare providers and patients.</p>`,
  
  `<p>Cultural movements reflect the evolving values and priorities of society. This examination of contemporary cultural trends reveals patterns that shape our collective identity.</p>
  <p>Art, music, and literature continue to serve as powerful mediums for expression and social commentary. They provide windows into the human experience that transcend language barriers.</p>
  <p>The digital age has democratized cultural production, allowing diverse voices to reach global audiences and challenge traditional narratives.</p>`,
];

function generateTitle(topic: string, index: number): string {
  const titles = [
    `The Future of ${topic}: What to Expect in 2026`,
    `Understanding ${topic}: A Comprehensive Guide`,
    `${topic} Trends That Are Shaping Tomorrow`,
    `Breaking Down ${topic}: Key Insights and Analysis`,
    `How ${topic} Is Changing the World`,
    `Exploring ${topic}: New Perspectives and Opportunities`,
    `${topic} Innovation: What's Next?`,
    `The Impact of ${topic} on Modern Society`,
  ];
  return titles[index % titles.length];
}

function generateDek(topic: string): string {
  const deks = [
    `An in-depth look at the latest developments in ${topic.toLowerCase()} and their implications for the future.`,
    `Discover how ${topic.toLowerCase()} is transforming industries and creating new opportunities.`,
    `Exploring the key trends and innovations driving change in ${topic.toLowerCase()} today.`,
    `A comprehensive analysis of ${topic.toLowerCase()} and what it means for professionals and enthusiasts.`,
    `Understanding the forces shaping ${topic.toLowerCase()} and how to navigate the evolving landscape.`,
  ];
  return deks[Math.floor(Math.random() * deks.length)];
}

function generateDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toISOString();
}

function generateContent(topic: string): string {
  return SAMPLE_CONTENT[Math.floor(Math.random() * SAMPLE_CONTENT.length)]
    .replace(/technology|science|business|health|culture/g, topic.toLowerCase());
}

// Generate a large pool of mock articles
export function generateMockArticles(): ArticleListItem[] {
  const articles: ArticleListItem[] = [];
  const totalArticles = 150; // Generate 150 articles for pagination testing

  for (let i = 0; i < totalArticles; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const author = AUTHORS[i % AUTHORS.length];
    const id = `a_${String(i + 1).padStart(3, '0')}`;
    const content = generateContent(topic);
    
    // Get a topic-appropriate image from our curated list
    const topicImages = TOPIC_IMAGES[topic] || TOPIC_IMAGES['Technology'];
    const imageId = topicImages[i % topicImages.length];
    
    articles.push({
      id,
      title: generateTitle(topic, i),
      dek: generateDek(topic),
      author,
      publishedAt: generateDate(Math.floor(i / 2)),
      readingTimeMins: Math.floor(Math.random() * 10) + 3,
      imageUrl: `https://picsum.photos/id/${imageId}/800/400`,
      contentHtml: content,
    });
  }

  return articles;
}

// Store for article details (content)
const articleDetailsCache = new Map<string, ArticleDetail>();

export function getArticleById(id: string): ArticleDetail | null {
  // Check cache first
  if (articleDetailsCache.has(id)) {
    return articleDetailsCache.get(id)!;
  }

  // Find the article in the list
  const allArticles = generateMockArticles();
  const article = allArticles.find(a => a.id === id);

  if (!article) {
    return null;
  }

  // Extract topic from title for content generation
  const topic = TOPICS.find(t => article.title.includes(t)) || TOPICS[0];
  
  const detail: ArticleDetail = {
    id: article.id,
    title: article.title,
    author: article.author,
    publishedAt: article.publishedAt,
    contentHtml: generateContent(topic),
  };

  // Cache it
  articleDetailsCache.set(id, detail);
  return detail;
}
