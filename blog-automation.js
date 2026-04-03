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

// Utility function to make HTTPS requests
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

// Download image from URL
function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    console.log(`[DEBUG] Downloading image from: ${imageUrl}`);
    
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    protocol.get(imageUrl, (res) => {
      let data = '';
      res.setEncoding('binary');
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(Buffer.from(data, 'binary'));
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Upload image to WordPress media library
async function uploadImageToWordPress(imageUrl, postTitle, token) {
  console.log(`📤 Uploading image to WordPress media library...`);

  try {
    // Download the image
    const imageBuffer = await downloadImage(imageUrl);
    
    // Extract filename from URL
    const urlObj = new URL(imageUrl);
    const filename = urlObj.pathname.split('/').pop() || `${postTitle.replace(/\s+/g, '-')}.jpg`;

    console.log(`[DEBUG] Image downloaded, size: ${imageBuffer.length} bytes`);
    console.log(`[DEBUG] Filename: ${filename}`);

    // Upload to WordPress
    const formData = imageBuffer;
    
    const uploadOptions = {
      hostname: 'unfashionablemale.co.uk',
      port: 443,
      path: '/wp-json/wp/v2/media',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': imageBuffer.length,
        'User-Agent': 'BlogAutomation/1.0',
      },
    };

    console.log(`[DEBUG] POST unfashionablemale.co.uk/wp-json/wp/v2/media`);

    const uploadResponse = await new Promise((resolve, reject) => {
      const req = https.request(uploadOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });

      req.on('error', reject);
      req.write(imageBuffer);
      req.end();
    });

    console.log(`[DEBUG] Upload response status: ${uploadResponse.status}`);

    if (uploadResponse.status === 201) {
      const mediaId = uploadResponse.body.id;
      console.log(`✅ Image uploaded to WordPress (Media ID: ${mediaId})\n`);
      return mediaId;
    } else {
      console.error('❌ Image upload failed:', uploadResponse.status, uploadResponse.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Image upload error:', error.message);
    return null;
  }
}

// Get trending topics
async function discoverTrendingTopics() {
  console.log('📊 Discovering trending topics...');
  
  const categories = [
    'Casual Style',
    'Seasonal Wardrobe',
    'Clothing',
    'Smart Casual',
    'Accessories',
    'Travel',
    'Hats & Caps',
    'Footwear',
    'Beard & Shaving',
    'Grooming',
  ];

  const topics = [
    {
      title: 'Best Spring 2026 Casual Fashion Trends',
      category: 'Casual Style',
      keyword: 'spring fashion trends 2026',
      searchVolume: 8900,
    },
    {
      title: 'How to Build a Minimalist Capsule Wardrobe',
      category: 'Capsule Wardrobe',
      keyword: 'minimalist capsule wardrobe men',
      searchVolume: 5400,
    },
    {
      title: 'Best Sustainable Fashion Brands for Men 2026',
      category: 'Clothing',
      keyword: 'sustainable men fashion brands',
      searchVolume: 4200,
    },
    {
      title: 'Smart Casual Outfits for Work: Complete Guide',
      category: 'Smart Casual',
      keyword: 'smart casual outfits men work',
      searchVolume: 6800,
    },
  ];

  console.log(`✅ Found ${topics.length} topics\n`);
  return topics;
}

// Get JWT token for authentication
async function getJWTToken() {
  console.log(`🔑 Requesting JWT token...\n`);

  const data = {
    username: CONFIG.wordpress.username,
    password: CONFIG.wordpress.password,
  };

  try {
    const response = await makeRequest(
      'unfashionablemale.co.uk',
      '/wp-json/jwt-auth/v1/token',
      'POST',
      {
        'Content-Type': 'application/json',
        'User-Agent': 'BlogAutomation/1.0',
      },
      data
    );

    console.log(`[DEBUG] JWT token request status: ${response.status}`);

    if (response.status === 200) {
      const token = response.body.token;
      console.log(`✅ JWT token acquired\n`);
      return token;
    } else {
      console.error('❌ Failed to get JWT token:', response.status, response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ JWT token request failed:', error.message);
    return null;
  }
}

// Test WordPress API connectivity with JWT
async function testWordPressAPI(token) {
  console.log(`🧪 Testing WordPress API connectivity...\n`);

  try {
    const response = await makeRequest(
      'unfashionablemale.co.uk',
      '/wp-json/wp/v2/users/me',
      'GET',
      {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'BlogAutomation/1.0',
      }
    );

    console.log(`[DEBUG] WP API test status: ${response.status}`);

    if (response.status === 200) {
      console.log('✅ WordPress API is accessible\n');
      return true;
    } else if (response.status === 401 || response.status === 403) {
      console.error('❌ Authentication failed (401/403) - JWT token invalid');
      return false;
    } else {
      console.error(`❌ Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ WordPress API test failed:', error.message);
    return false;
  }
}

// Generate article outline
async function generateOutline(topic) {
  console.log(`📋 Generating outline for: ${topic.title}`);

  const prompt = `Create a detailed blog post outline for: "${topic.title}"
Keyword: ${topic.keyword}

Provide:
1. Blog post title (engaging, SEO-friendly)
2. Meta description (160 characters max)
3. Main sections (5-7 sections with H2 headings)
4. Key points for each section
5. Internal linking opportunities (suggest 2-3 relevant topics)
6. Call-to-action ideas

Focus on UK English spelling and men's fashion/lifestyle content.
Format as structured JSON.`;

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
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }
    );

    if (response.status === 200) {
      console.log('✅ Outline generated\n');
      return response.body.choices[0].message.content;
    } else {
      console.error('❌ OpenAI error:', response.status, response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Outline generation failed:', error.message);
    return null;
  }
}

// Generate full article
async function generateArticle(topic, outline) {
  console.log(`✍️  Generating full article for: ${topic.title}`);

  const prompt = `Write a comprehensive blog post based on this outline:
${outline}

Requirements:
- 1500-2000 words
- UK English spelling and grammar (colour, organise, etc.)
- H2 and H3 headings for structure
- Long-tail keywords naturally throughout
- 2-3 outbound links to authoritative sources
- FAQ section at end with 4-5 questions
- NO "Conclusion" section
- Output ONLY pure HTML (no markdown)
- Include JSON-LD schema markup at end
- Target for Rank Math SEO

Topic: ${topic.title}
Primary keyword: ${topic.keyword}
Category: ${topic.category}`;

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
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2500,
      }
    );

    if (response.status === 200) {
      console.log('✅ Article generated\n');
      let content = response.body.choices[0].message.content;
      // Remove markdown code fences if present
      content = content.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();
      return content;
    } else {
      console.error('❌ OpenAI error:', response.status, response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Article generation failed:', error.message);
    return null;
  }
}

// Generate SEO meta tags
async function generateSEOMeta(topic, article) {
  console.log(`🔍 Generating SEO meta tags...`);

  const prompt = `Create SEO meta tags for this article:
Title: ${topic.title}
Keyword: ${topic.keyword}

Return ONLY valid JSON with these fields:
{
  "metaTitle": "SEO title (60 chars max)",
  "metaDescription": "SEO description (160 chars max)",
  "focusKeyword": "main keyword",
  "relatedKeywords": ["keyword1", "keyword2", "keyword3"]
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
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500,
      }
    );

    if (response.status === 200) {
      console.log('✅ SEO meta generated\n');
      const content = response.body.choices[0].message.content;
      try {
        return JSON.parse(content);
      } catch (e) {
        return {
          metaTitle: topic.title.substring(0, 60),
          metaDescription: `Learn about ${topic.keyword} - comprehensive guide for men`,
          focusKeyword: topic.keyword,
          relatedKeywords: [topic.keyword],
        };
      }
    } else {
      console.error('❌ OpenAI error:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ SEO generation failed:', error.message);
    return null;
  }
}

// Fetch image from Unsplash
async function fetchImage(query) {
  console.log(`🖼️  Fetching image from Unsplash: ${query}`);

  try {
    const response = await makeRequest(
      'api.unsplash.com',
      `/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${process.env.UNSPLASH_API_KEY}`,
      'GET'
    );

    if (response.status === 200 && response.body.results && response.body.results.length > 0) {
      const imageUrl = response.body.results[0].urls.regular;
      console.log('✅ Image found from Unsplash\n');
      return imageUrl;
    } else {
      console.warn('⚠️  No image found');
      return null;
    }
  } catch (error) {
    console.error('❌ Image fetch failed:', error.message);
    return null;
  }
}

// Add blog post to Airtable
async function addBlogPostToAirtable(topic, article, seoMeta, imageUrl) {
  console.log(`📚 Adding blog post to Airtable...`);

  const wordCount = Math.floor(article.length / 4.7);

  const data = {
    fields: {
      'Post Title': topic.title,
      'Category': topic.category,
      'Primary Keyword': topic.keyword,
      'Status': 'Ready to Publish',
      'Word Count': wordCount,
      'Meta Title': seoMeta.metaTitle || topic.title,
      'Meta Description': seoMeta.metaDescription || `Learn about ${topic.keyword}`,
      'Content': article.substring(0, 100000),
      'Featured Image URL': imageUrl,
      'Publishing Date': new Date().toISOString().split('T')[0],
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
      return response.body.id || response.body.records?.[0]?.id;
    } else {
      console.error('❌ Airtable error:', response.status, response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Error adding to Airtable:', error.message);
    return null;
  }
}

// Publish to WordPress using JWT with featured image
async function publishToWordPress(topic, article, seoMeta, mediaId, token) {
  console.log(`📤 Publishing to WordPress: ${topic.title}`);

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
    featured_media: mediaId || 0,
    status: 'publish',
  };

  try {
    const response = await makeRequest(
      'unfashionablemale.co.uk',
      '/wp-json/wp/v2/posts',
      'POST',
      {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BlogAutomation/1.0',
      },
      data
    );

    if (response.status === 201) {
      const wpPostId = response.body.id;
      const wpPostUrl = response.body.link;
      console.log(`✅ Published to WordPress (ID: ${wpPostId})`);
      console.log(`📌 URL: ${wpPostUrl}\n`);
      return { wpPostId, wpPostUrl };
    } else {
      console.error('❌ WordPress error:', response.status);
      console.error('Response body:', response.body);
      return null;
    }
  } catch (error) {
    console.error('❌ Error publishing to WordPress:', error.message);
    return null;
  }
}

// Add to Publishing Schedule
async function addToPublishingSchedule(topic, wpPostId, wpPostUrl) {
  console.log(`📅 Logging to Publishing Schedule...`);

  const data = {
    fields: {
      'Publication Date': new Date().toISOString().split('T')[0],
      'Post Title': topic.title,
      'Status': 'Published',
      'WordPress Post ID': wpPostId,
      'Published URL': wpPostUrl,
    },
  };

  try {
    await makeRequest(
      'api.airtable.com',
      `/v0/${CONFIG.airtable.baseId}/Publishing%20Schedule`,
      'POST',
      {
        'Authorization': `Bearer ${CONFIG.airtable.token}`,
        'Content-Type': 'application/json',
      },
      data
    );
    console.log('✅ Added to Publishing Schedule\n');
  } catch (error) {
    console.warn('⚠️  Could not log to Publishing Schedule:', error.message);
  }
}

// Main automation function
async function runBlogAutomation() {
  console.log('🚀 Starting blog automation with ChatGPT...\n');

  validateConfig();

  // Get JWT token
  const jwtToken = await getJWTToken();
  if (!jwtToken) {
    console.error('❌ Could not obtain JWT token - aborting');
    process.exit(1);
  }

  // Test API
  console.log('\n🔍 TESTING WORDPRESS API ACCESS...\n');
  const apiTestPassed = await testWordPressAPI(jwtToken);
  if (!apiTestPassed) {
    console.warn('⚠️  WordPress API test failed - publishing may not work\n');
  }

  // Discover topics
  const topics = await discoverTrendingTopics();

  // Process first topic
  const topic = topics[0];
  console.log(`📌 Processing topic: ${topic.title}\n`);

  // Generate outline
  const outline = await generateOutline(topic);
  if (!outline) {
    console.error('❌ Failed to generate outline');
    process.exit(1);
  }

  // Generate article
  const article = await generateArticle(topic, outline);
  if (!article) {
    console.error('❌ Failed to generate article');
    process.exit(1);
  }

  // Generate SEO meta
  const seoMeta = await generateSEOMeta(topic, article);

  // Fetch image
  const imageUrl = await fetchImage(topic.keyword);
  let mediaId = null;

  // Upload image to WordPress if found
  if (imageUrl) {
    mediaId = await uploadImageToWordPress(imageUrl, topic.title, jwtToken);
  }

  // Add to Airtable
  await addBlogPostToAirtable(topic, article, seoMeta, imageUrl);

  // Publish to WordPress with featured image
  console.log('\n🔄 AUTO-PUBLISHING TO WORDPRESS...\n');
  const wpResult = await publishToWordPress(topic, article, seoMeta, mediaId, jwtToken);
  if (wpResult) {
    await addToPublishingSchedule(topic, wpResult.wpPostId, wpResult.wpPostUrl);
  } else {
    console.warn('⚠️  Post added to Airtable but WordPress publishing failed');
  }

  console.log('✅ ✅ ✅ AUTOMATION COMPLETE! ✅ ✅ ✅\n');
}

// Run the automation
runBlogAutomation().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
