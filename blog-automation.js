#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration from environment variables
const CONFIG = {
  wordpress: {
    url: process.env.WORDPRESS_URL || 'https://unfashionablemale.co.uk',
    username: process.env.WORDPRESS_USERNAME,
    password: process.env.WORDPRESS_PASSWORD,
  },
  airtable: {
    token: process.env.AIRTABLE_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID,
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
  },
};

// Utility function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
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

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Get trending topics from Google Trends (via web search simulation)
async function discoverTrendingTopics() {
  console.log('📊 Discovering trending topics...');
  
  // For now, return predefined trending topics based on your categories
  // In production, this would integrate with Google Trends API
  const trendingTopics = [
    {
      title: 'Best Spring 2026 Casual Fashion Trends',
      category: 'Clothing',
      keyword: 'spring fashion trends 2026',
      searchVolume: 8900,
    },
    {
      title: 'How to Care for Leather Shoes in Summer',
      category: 'Accessories',
      keyword: 'leather shoe care summer',
      searchVolume: 3200,
    },
    {
      title: 'Beard Growth and Maintenance Guide',
      category: 'Grooming',
      keyword: 'how to grow beard faster',
      searchVolume: 12000,
    },
    {
      title: 'Budget Travel Hacks for Men 2026',
      category: 'Lifestyle',
      keyword: 'cheap travel tips men',
      searchVolume: 5600,
    },
  ];

  return trendingTopics;
}

// Add topic to Airtable
async function addTopicToAirtable(topic) {
  console.log(`📝 Adding topic to Airtable: ${topic.title}`);

  const url = new URL(`https://api.airtable.com/v0/${CONFIG.airtable.baseId}/Topics`);
  
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.airtable.token}`,
      'Content-Type': 'application/json',
    },
  };

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
    const response = await makeRequest(options, data);
    if (response.status === 201) {
      console.log('✅ Topic added to Airtable');
      return response.body.id;
    } else {
      console.error('❌ Failed to add topic:', response.body);
      return null;
    }
  } catch (error) {
    console.error('Error adding topic to Airtable:', error);
    return null;
  }
}

// Generate content outline with Claude
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
    const response = await makeRequest({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.claude.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }, {
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (response.status === 200 && response.body.content) {
      const outline = response.body.content[0].text;
      console.log('✅ Outline generated');
      return outline;
    } else {
      console.error('❌ Failed to generate outline:', response.body);
      return null;
    }
  } catch (error) {
    console.error('Error generating outline:', error);
    return null;
  }
}

// Generate full article content with Claude
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
    const response = await makeRequest({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.claude.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }, {
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (response.status === 200 && response.body.content) {
      const article = response.body.content[0].text;
      console.log('✅ Article generated');
      return article;
    } else {
      console.error('❌ Failed to generate article:', response.body);
      return null;
    }
  } catch (error) {
    console.error('Error generating article:', error);
    return null;
  }
}

// Generate SEO meta tags with Claude
async function generateSEOMeta(topic, article) {
  console.log(`🔍 Generating SEO meta tags...`);

  const systemPrompt = `You are an SEO expert. Generate compelling meta titles and descriptions.`;

  const userPrompt = `Based on this article topic and content, generate SEO meta tags:

Title: ${topic.title}
Keyword: ${topic.keyword}

Requirements:
- Meta title: Max 60 characters, include keyword
- Meta description: Max 160 characters, compelling call-to-action

Respond in JSON format:
{
  "metaTitle": "...",
  "metaDescription": "..."
}`;

  try {
    const response = await makeRequest({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.claude.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }, {
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    if (response.status === 200 && response.body.content) {
      const text = response.body.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    console.error('❌ Failed to generate SEO meta');
    return { metaTitle: topic.title.substring(0, 60), metaDescription: topic.title.substring(0, 160) };
  } catch (error) {
    console.error('Error generating SEO meta:', error);
    return { metaTitle: topic.title.substring(0, 60), metaDescription: topic.title.substring(0, 160) };
  }
}

// Get featured image from Unsplash
async function getUnsplashImage(query) {
  console.log(`🖼️  Fetching image from Unsplash: ${query}`);

  try {
    const searchUrl = new URL('https://api.unsplash.com/search/photos');
    searchUrl.searchParams.append('query', query);
    searchUrl.searchParams.append('per_page', '1');
    searchUrl.searchParams.append('client_id', process.env.UNSPLASH_API_KEY || 'demo');

    const response = await makeRequest({
      hostname: searchUrl.hostname,
      path: searchUrl.pathname + searchUrl.search,
      method: 'GET',
    });

    if (response.status === 200 && response.body.results && response.body.results.length > 0) {
      const image = response.body.results[0];
      console.log('✅ Image found');
      return {
        url: image.urls.regular,
        altText: image.alt_description || query,
        credit: image.user.name,
      };
    }
    console.log('⚠️  No image found, using placeholder');
    return {
      url: 'https://via.placeholder.com/1200x630?text=' + encodeURIComponent(query),
      altText: query,
      credit: 'Placeholder',
    };
  } catch (error) {
    console.log('⚠️  Error fetching image, using placeholder');
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

  const url = new URL(`https://api.airtable.com/v0/${CONFIG.airtable.baseId}/Blog%20Posts`);
  
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.airtable.token}`,
      'Content-Type': 'application/json',
    },
  };

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
      'Content': article,
      'Featured Image URL': image.url,
    },
  };

  try {
    const response = await makeRequest(options, data);
    if (response.status === 201) {
      console.log('✅ Blog post added to Airtable');
      return response.body.id;
    } else {
      console.error('❌ Failed to add blog post:', response.body);
      return null;
    }
  } catch (error) {
    console.error('Error adding blog post to Airtable:', error);
    return null;
  }
}

// Publish to WordPress
async function publishToWordPress(post) {
  console.log(`📰 Publishing to WordPress...`);

  const auth = Buffer.from(`${CONFIG.wordpress.username}:${CONFIG.wordpress.password}`).toString('base64');
  
  const wpContent = `<h2>Introduction</h2><p>${post.Content.substring(0, 100)}...</p>${post.Content}`;

  const options = {
    hostname: new URL(CONFIG.wordpress.url).hostname,
    path: '/wp-json/wp/v2/posts',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };

  const data = {
    title: post['Post Title'],
    content: wpContent,
    status: 'publish',
    meta: {
      _yoast_wpseo_title: post['Meta Title'],
      _yoast_wpseo_metadesc: post['Meta Description'],
    },
  };

  try {
    const response = await makeRequest(options, data);
    if (response.status === 201) {
      console.log('✅ Published to WordPress');
      return response.body.id;
    } else {
      console.error('❌ Failed to publish to WordPress:', response.body);
      return null;
    }
  } catch (error) {
    console.error('Error publishing to WordPress:', error);
    return null;
  }
}

// Main automation function
async function runAutomation() {
  console.log('🚀 Starting blog automation...');
  
  try {
    // 1. Discover trending topics
    const topics = await discoverTrendingTopics();
    console.log(`Found ${topics.length} trending topics`);

    // 2. Process first topic
    const topic = topics[0];
    
    // 3. Add to Airtable Topics
    await addTopicToAirtable(topic);

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

    // 9. Publish to WordPress
    // Uncomment when ready:
    // const wpPostId = await publishToWordPress({ ...topic, Content: article, ...seoMeta });

    console.log('✅ Automation complete!');
  } catch (error) {
    console.error('❌ Automation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAutomation();
}

module.exports = { runAutomation };
