#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

// Configuration from environment variables
const CONFIG = {
  wordpress: {
    url: process.env.WORDPRESS_URL || 'https://unfashionablemale.co.uk',
    username: process.env.WORDPRESS_USERNAME,
    password: process.env.WORDPRESS_PASSWORD,
  },
  airtable: {
    token: process.env.AIRTABLE_TOKEN || '',
    baseId: process.env.AIRTABLE_BASE_ID || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
};

// Validate environment variables
function validateConfig() {
  console.log('[VALIDATION] Checking required environment variables...\n');
  
  if (!CONFIG.openai.apiKey) {
    console.error('❌ ERROR: OPENAI_API_KEY is not set');
    console.error('   Make sure OPENAI_API_KEY is added to GitHub Secrets');
    process.exit(1);
  }
  console.log('✅ OPENAI_API_KEY is set');
  
  if (!CONFIG.airtable.token) {
    console.error('❌ ERROR: AIRTABLE_TOKEN is not set');
    process.exit(1);
  }
  console.log('✅ AIRTABLE_TOKEN is set');
  
  if (!CONFIG.airtable.baseId) {
    console.error('❌ ERROR: AIRTABLE_BASE_ID is not set');
    process.exit(1);
  }
  console.log('✅ AIRTABLE_BASE_ID is set');
  console.log();
}

// Utility function to make HTTPS requests with explicit port 443
function makeRequest(hostname, path, method = 'GET', headers = {}, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    console.log(`[DEBUG] ${method} ${hostname}${path}`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[ERROR] ${hostname}: ${error.message}`);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Get trending topics
async function discoverTrendingTopics() {
  console.log('📊 Discovering trending topics...');
  
  // Actual subcategories from existing posts
  const categories = [
    'Casual Style',
    'Seasonal Wardrobe',
    'Clothing',
    'Smart Casual',
    'Accessories',
    'Travel',
    'Hats & Caps',
    'Style Mistakes',
    'Featured',
    'Grooming',
    'Beard & Shaving',
    'Hair Care & Styles',
    'Capsule Wardrobe',
    'Bags',
    'Watches',
    'Skincare',
    'Footwear',
    'Glasses & Sunglasses',
    'Formalwear',
    'Fragrance',
    'Activites',
    'Life',
  ];

  const trendingTopics = [
    {
      title: 'Best Spring 2026 Casual Fashion Trends',
      category: 'Casual Style',
      keyword: 'spring fashion trends 2026',
      searchVolume: 8900,
    },
    {
      title: 'How to Care for Leather Shoes in Summer',
      category: 'Footwear',
      keyword: 'leather shoe care summer',
      searchVolume: 3200,
    },
    {
      title: 'Beard Growth and Maintenance Guide',
      category: 'Beard & Shaving',
      keyword: 'how to grow beard faster',
      searchVolume: 12000,
    },
    {
      title: 'Budget Travel Hacks for Men 2026',
      category: 'Travel',
      keyword: 'cheap travel tips men',
      searchVolume: 5600,
    },
  ];

  console.log(`✅ Found ${trendingTopics.length} topics\n`);
  return trendingTopics;
}

// Add topic to Airtable
async function addTopicToAirtable(topic) {
  console.log(`📝 Adding topic to Airtable: ${topic.title}`);

  const data = {
    fields: {
      'Topic Title': topic.title,
      'Category': topic.category,
      'Primary Keyword': topic.keyword,
      'Search Volume': topic.searchVolume,
      'Status': 'Discovered',
      'Trending Score': Math.min(100, Math.floor((topic.searchVolume / 15000) * 100)),
    },
  };

  try {
    const response = await makeRequest(
      'api.airtable.com',
      `/v0/${CONFIG.airtable.baseId}/Topics`,
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.airtable.token}`,
        'Content-Type': 'application/json',
      },
      data
    );

    if (response.status === 201) {
      console.log('✅ Topic added to Airtable\n');
      return response.body.id;
    } else {
      console.error('❌ Airtable error:', response.status, response.body.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error adding topic:', error.message);
    return null;
  }
}

// Generate content outline with ChatGPT
async function generateOutline(topic) {
  console.log(`📋 Generating outline for: ${topic.title}`);

  const systemPrompt = `You are an expert blog writer for a men's fashion and lifestyle blog. Generate a detailed outline for a blog post that is SEO-optimized, engaging, and original.`;

  const userPrompt = `Create a detailed outline for a blog post about: "${topic.title}"
  
Target keyword: "${topic.keyword}"
Category: ${topic.category}

Requirements:
- Include 5-7 main sections with H2/H3 headings
- Make it practical and actionable
- Include a brief intro (2-3 sentences)
- Add a conclusion
- Suggest 2-3 internal link opportunities

Format as: H2 heading, followed by 2-3 bullet points for each section.`;

  try {
    const response = await makeRequest(
      'api.openai.com',
      '/v1/chat/completions',
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }
    );

    if (response.status === 200 && response.body.choices && response.body.choices.length > 0) {
      const outline = response.body.choices[0].message.content;
      console.log('✅ Outline generated\n');
      return outline;
    } else {
      console.error('❌ OpenAI error:', response.status, response.body.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error generating outline:', error.message);
    return null;
  }
}

// Generate full article content with ChatGPT
async function generateArticle(topic, outline) {
  console.log(`✍️  Generating full article for: ${topic.title}`);

  const systemPrompt = `You are an expert blog writer for unfashionablemale.co.uk, a men's fashion and lifestyle blog. 
Write engaging, well-researched, original blog posts that rank well in Google.
- Use conversational tone
- Include practical tips and advice
- Make content actionable and relevant to men
- Optimize for the target keyword naturally
- Write 1500-2000 words
- Use proper HTML formatting with <h2>, <h3>, <p>, <ul>, <li> tags`;

  const userPrompt = `Write a complete blog post based on this outline:

Topic: ${topic.title}
Target keyword: ${topic.keyword}
Category: ${topic.category}

OUTLINE:
${outline}

Requirements:
- Expand each outline section into 2-3 paragraphs
- Write 1500-2000 words total
- Include practical examples and tips
- Make it SEO-friendly
- Use HTML formatting for headings and lists
- End with a brief conclusion`;

  try {
    const response = await makeRequest(
      'api.openai.com',
      '/v1/chat/completions',
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }
    );

    if (response.status === 200 && response.body.choices && response.body.choices.length > 0) {
      const article = response.body.choices[0].message.content;
      console.log('✅ Article generated\n');
      return article;
    } else {
      console.error('❌ OpenAI error:', response.status, response.body.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error generating article:', error.message);
    return null;
  }
}

// Generate SEO meta tags with ChatGPT
async function generateSEOMeta(topic, article) {
  console.log(`🔍 Generating SEO meta tags...`);

  const systemPrompt = `You are an SEO expert. Generate compelling meta titles and descriptions.`;

  const userPrompt = `Based on this article topic, generate SEO meta tags:

Title: ${topic.title}
Keyword: ${topic.keyword}

Requirements:
- Meta title: Max 60 characters, include keyword
- Meta description: Max 160 characters, compelling call-to-action

Respond in JSON format only:
{
  "metaTitle": "...",
  "metaDescription": "..."
}`;

  try {
    const response = await makeRequest(
      'api.openai.com',
      '/v1/chat/completions',
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }
    );

    if (response.status === 200 && response.body.choices && response.body.choices.length > 0) {
      const text = response.body.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ SEO meta generated\n');
        return parsed;
      }
    }
    console.log('⚠️  Could not parse SEO meta, using defaults\n');
    return { 
      metaTitle: topic.title.substring(0, 60), 
      metaDescription: topic.title.substring(0, 160) 
    };
  } catch (error) {
    console.error('⚠️  Error generating SEO meta:', error.message);
    return { 
      metaTitle: topic.title.substring(0, 60), 
      metaDescription: topic.title.substring(0, 160) 
    };
  }
}

// Get featured image from Unsplash
async function getUnsplashImage(query) {
  console.log(`🖼️  Fetching image from Unsplash: ${query}`);

  try {
    const searchParams = new URLSearchParams({
      query: query,
      per_page: '1',
      client_id: process.env.UNSPLASH_API_KEY || 'demo',
    });

    const response = await makeRequest(
      'api.unsplash.com',
      `/search/photos?${searchParams.toString()}`,
      'GET',
      {}
    );

    if (response.status === 200 && response.body.results && response.body.results.length > 0) {
      const image = response.body.results[0];
      console.log('✅ Image found from Unsplash\n');
      return {
        url: image.urls.regular,
        altText: image.alt_description || query,
        credit: image.user.name,
      };
    }
    console.log('⚠️  No Unsplash image found, using placeholder\n');
    return {
      url: 'https://via.placeholder.com/1200x630?text=' + encodeURIComponent(query),
      altText: query,
      credit: 'Placeholder',
    };
  } catch (error) {
    console.log('⚠️  Unsplash error, using placeholder\n');
    return {
      url: 'https://via.placeholder.com/1200x630?text=' + encodeURIComponent(query),
      altText: query,
      credit: 'Placeholder',
    };
  }
}

// Add blog post to Airtable
async function addBlogPostToAirtable(topic, article, seoMeta, image) {
  console.log(`📚 Adding blog post to Airtable...`);

  const data = {
    fields: {
      'Post Title': topic.title,
      'Topic': topic.title,
      'Category': topic.category,
      'Primary Keyword': topic.keyword,
      'Status': 'Ready to Publish',
      'Word Count': article.split(' ').length,
      'Meta Title': seoMeta.metaTitle,
      'Meta Description': seoMeta.metaDescription,
      'Content': article.substring(0, 100000),
      'Featured Image URL': image.url,
    },
  };

  try {
    const response = await makeRequest(
      'api.airtable.com',
      `/v0/${CONFIG.airtable.baseId}/Blog%20Posts`,
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.airtable.token}`,
        'Content-Type': 'application/json',
      },
      data
    );

    if (response.status === 201) {
      console.log('✅ Blog post added to Airtable\n');
      return response.body.id;
    } else {
      console.error('❌ Airtable error:', response.status, response.body.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error adding blog post:', error.message);
    return null;
  }
}

// Main automation function
async function runAutomation() {
  console.log('🚀 Starting blog automation with ChatGPT...\n');
  
  // Validate all required credentials
  validateConfig();
  
  try {
    // 1. Discover trending topics
    const topics = await discoverTrendingTopics();
    if (topics.length === 0) throw new Error('No topics found');

    // 2. Process first topic
    const topic = topics[0];
    console.log(`📌 Processing topic: ${topic.title}\n`);
    
    // 3. Add to Airtable Topics (non-critical if fails)
    const topicId = await addTopicToAirtable(topic);

    // 4. Generate outline
    const outline = await generateOutline(topic);
    if (!outline) throw new Error('Failed to generate outline');

    // 5. Generate full article
    const article = await generateArticle(topic, outline);
    if (!article) throw new Error('Failed to generate article');

    // 6. Generate SEO meta
    const seoMeta = await generateSEOMeta(topic, article);

    // 7. Get featured image
    const image = await getUnsplashImage(topic.keyword);

    // 8. Add to Airtable Blog Posts
    const postId = await addBlogPostToAirtable(topic, article, seoMeta, image);
    if (!postId) throw new Error('Failed to add post to Airtable');

    console.log('✅ ✅ ✅ AUTOMATION COMPLETE! ✅ ✅ ✅\n');
  } catch (error) {
    console.error('\n❌ AUTOMATION FAILED:', error.message, '\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAutomation();
}

module.exports = { runAutomation };
