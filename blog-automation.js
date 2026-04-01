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

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Topic added to Airtable\n');
      return response.body.id || response.body.records?.[0]?.id || 'success';
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

CRITICAL REQUIREMENTS:
- Output ONLY pure HTML (no markdown code fences like \`\`\`html)
- Use UK English spelling and grammar throughout (colour, organise, realise, etc.)
- Expand each outline section into 2-3 paragraphs
- Write 1500-2000 words total
- Include practical examples and tips
- Make it SEO-friendly
- Use HTML formatting for headings and lists
- Target People Also Ask (PAA) questions naturally within sections
- DO NOT include a "Conclusion" section header
- DO NOT add meta-commentary or explanatory text at the end
- DO NOT explain what the post does
- End the post after the last content section

STRUCTURED DATA (use ONLY when relevant):
- Use <ul> or <ol> lists when presenting multiple options, steps, or items
- Use <table> with <thead>, <tbody>, <tr>, <td> ONLY when comparing features, prices, or data
- Use <strong> and <em> for emphasis on key terms
- Avoid forcing tables or lists where prose is more natural

SEO Enhancements:
1. Use long-tail keyword questions in H3 headings (e.g., "What are the best spring 2026 casual fashion trends?")
2. Naturally incorporate keyword variations (2-3 times total, not forced)
3. Add a "Frequently Asked Questions" section at the end with 4-5 PAA-style questions and answers
4. Include 2-3 relevant outbound links to authoritative sources (fashion blogs, Wikipedia, major retailers) with natural anchor text
5. Include internal link suggestions as a simple list before the FAQ section
6. Add JSON-LD schema markup at the very end for BlogPosting
7. When using lists or tables, add schema markup for them (use proper HTML structure for accessibility)

Schema Markup Format:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "${topic.title}",
  "datePublished": "2026-04-01",
  "author": {
    "@type": "Person",
    "name": "Unfashionable Male"
  }
}
</script>`;

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

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Blog post added to Airtable\n');
      return response.body.id || response.body.records?.[0]?.id || 'success';
    } else {
      console.error('❌ Airtable error:', response.status, response.body.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error adding blog post:', error.message);
    return null;
  }
}

// Add post to Publishing Schedule table
async function addToPublishingSchedule(topic, wpPostId, wpPostUrl) {
  console.log(`📅 Logging to Publishing Schedule...`);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const data = {
    fields: {
      'Publication Date': today,
      'Post Title': topic.title,
      'Status': 'Published',
      'WordPress Post ID': wpPostId,
      'Published URL': wpPostUrl,
      'Notes': 'Auto-published by automation',
    },
  };

  try {
    const response = await makeRequest(
      'api.airtable.com',
      `/v0/${CONFIG.airtable.baseId}/Publishing%20Schedule`,
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.airtable.token}`,
        'Content-Type': 'application/json',
      },
      data
    );

    if (response.status === 201 || response.status === 200) {
      console.log('✅ Added to Publishing Schedule\n');
      return true;
    } else {
      console.error('❌ Error adding to Publishing Schedule:', response.status, response.body.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error logging to Publishing Schedule:', error.message);
    return false;
  }
}

// Publish to WordPress
async function publishToWordPress(topic, article, seoMeta, image) {
  console.log(`📤 Publishing to WordPress: ${topic.title}`);

  const auth = Buffer.from(
    `${CONFIG.wordpress.username}:${CONFIG.wordpress.password}`
  ).toString('base64');

  // Category ID mapping from your WordPress setup
  const categoryMap = {
    'Clothing': 1713,
    'Casual Style': 1714,
    'Capsule Wardrobe': 1718,
    'Formalwear': 1716,
    'Smart Casual': 1715,
    'Seasonal Wardrobe': 1717,
    'Style Mistakes': 1719,
    'Accessories': 1725,
    'Bags': 1728,
    'Footwear': 1727,
    'Glasses & Sunglasses': 1730,
    'Hats & Caps': 1729,
    'Watches': 1726,
    'Grooming': 1720,
    'Beard & Shaving': 1722,
    'Fragrance': 1724,
    'Hair Care & Styles': 1721,
    'Skincare': 1723,
    'Lifestyle': 1672,
    'Travel': 1676,
    'Life': 1701,
    'Featured': 16,
    'Fashion': 1666,
  };

  const categoryId = categoryMap[topic.category] || 1713;

  const data = {
    title: topic.title,
    content: article,
    excerpt: seoMeta.metaDescription,
    meta: {
      _yoast_wpseo_title: seoMeta.metaTitle,
      _yoast_wpseo_metadesc: seoMeta.metaDescription,
    },
    categories: [categoryId],
    status: 'publish',
  };

  try {
    const response = await makeRequest(
      'unfashionablemale.co.uk',
      '/wp-json/wp/v2/posts',
      'POST',
      {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      data
    );

    if (response.status === 201) {
      const wpPostId = response.body.id;
      const wpPostUrl = response.body.link;
      console.log(`✅ Published to WordPress (ID: ${wpPostId})`);
      console.log(`📌 URL: ${wpPostUrl}\n`);
      
      // Log to Publishing Schedule
      await addToPublishingSchedule(topic, wpPostId, wpPostUrl);
      
      return { wpPostId, wpPostUrl };
    } else {
      console.error('❌ WordPress error:', response.status, response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Error publishing to WordPress:', error.message);
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

    // 9. PUBLISH TO WORDPRESS
    const wpResult = await publishToWordPress(topic, article, seoMeta, image);
    if (!wpResult) {
      console.warn('⚠️  Post added to Airtable but WordPress publishing failed');
    }

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
