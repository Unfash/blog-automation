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
    
    // Determine file extension and MIME type
    let extension = 'jpg';
    let mimeType = 'image/jpeg';
    
    if (imageUrl.includes('.png')) {
      extension = 'png';
      mimeType = 'image/png';
    } else if (imageUrl.includes('.webp')) {
      extension = 'webp';
      mimeType = 'image/webp';
    } else if (imageUrl.includes('.gif')) {
      extension = 'gif';
      mimeType = 'image/gif';
    }
    
    // Create filename with proper extension
    const filename = `${postTitle.replace(/\s+/g, '-').toLowerCase()}.${extension}`;

    console.log(`[DEBUG] Image downloaded, size: ${imageBuffer.length} bytes`);
    console.log(`[DEBUG] Filename: ${filename}`);
    console.log(`[DEBUG] MIME type: ${mimeType}`);

    // Upload to WordPress
    const uploadOptions = {
      hostname: 'unfashionablemale.co.uk',
      port: 443,
      path: '/wp-json/wp/v2/media',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
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
  console.log('📊 Researching trending topics via ChatGPT...');

  // COMPREHENSIVE keyword database - ALL 50+ categories
  const keywordDatabase = {
    // BODY TYPE & FIT
    'Dressing for Slim Build': ['slim build fashion', 'clothing for slim men', 'slim frame style tips', 'how to dress slim', 'slim guy fashion guide'],
    'Dressing for Athletic Build': ['athletic build mens fashion', 'muscular build clothing', 'gym body style tips', 'athletic guy outfit ideas', 'fit man fashion'],
    'Dressing for Plus Size': ['plus size mens fashion', 'big and tall style', 'plus size menswear', 'larger frame clothing', 'plus size guy tips'],
    'Dressing for Short Men': ['short men fashion tips', 'short guy clothing style', 'height challenged fashion', 'short men outfit ideas', 'short stature styling'],
    'Dressing for Tall Men': ['tall man fashion guide', 'tall guy clothing tips', 'tall frame style', 'height advantage fashion', 'long torso outfit'],
    
    // OCCASIONS & EVENTS
    'Job Interview Outfits': ['job interview outfit men', 'interview attire mens', 'first impression outfit', 'interview style guide', 'professional interview look'],
    'First Date Outfit': ['first date outfit men', 'what to wear first date', 'dating outfit ideas', 'first date style tips', 'impressing on first date'],
    'Wedding Guest Outfit': ['wedding guest outfit men', 'mens wedding attire', 'suit for wedding', 'wedding style guide', 'guest outfit ideas'],
    'Casual Friday': ['casual friday mens outfit', 'casual friday style', 'office casual tips', 'business casual outfit', 'friday work wear'],
    'Smart Casual for Work': ['smart casual work outfit', 'office smart casual', 'work style guide', 'professional casual mens', 'office outfit ideas'],
    'Weekend Casual': ['weekend casual outfit men', 'casual weekend style', 'relaxed outfit ideas', 'weekend fashion mens', 'casual guy look'],
    
    // BUDGET & VALUE
    'Budget Fashion': ['affordable mens fashion brands', 'budget mens clothing', 'cheap quality menswear', 'budget style tips', 'affordable outfit ideas'],
    'High Street Brands': ['high street mens brands', 'high street fashion men', 'accessible mens fashion', 'high street style', 'mainstream mens brands'],
    'Designer Dupes': ['designer dupes mens', 'affordable designer alternatives', 'luxury look budget price', 'fake designer look', 'budget luxury style'],
    'Affordable Accessories': ['affordable mens accessories', 'cheap accessory quality', 'budget friendly accessories', 'affordable watch mens', 'cheap bag mens'],
    
    // COLOR & COMBINATIONS
    'Color Matching Guide': ['color matching guide men', 'how to match colors', 'color coordination mens', 'matching outfit colors', 'color theory fashion'],
    'Neutral Colors': ['neutral colors menswear', 'neutral palette style', 'neutral outfit ideas', 'neutral mens fashion', 'earthy tone clothing'],
    'Pattern Mixing': ['pattern mixing guide', 'how to mix patterns', 'pattern combination mens', 'mixing patterns outfit', 'pattern coordination'],
    'Monochrome Styling': ['monochrome styling men', 'monochrome outfit ideas', 'one color outfit', 'monochrome fashion mens', 'single color styling'],
    
    // CLOTHING
    'Casual Style': ['casual mens fashion', 'casual outfit ideas', 'casual style guide', 'everyday casual wear', 'relaxed style mens'],
    'Capsule Wardrobe': ['capsule wardrobe mens', 'minimalist mens wardrobe', 'essential clothing items', 'versatile wardrobe mens', 'wardrobe basics'],
    'Formalwear': ['formal mens clothing', 'formal outfit guide', 'black tie dress code', 'formal style mens', 'occasion dressing'],
    'Smart Casual': ['smart casual mens fashion', 'smart casual style', 'business casual outfit', 'smart casual look', 'dressed up casual'],
    'Style Mistakes': ['common style mistakes men', 'fashion faux pas mens', 'what not to wear', 'fashion mistakes mens', 'styling errors'],
    
    // SEASONAL
    'Summer Style': ['summer mens fashion', 'summer outfit ideas', 'hot weather clothing', 'summer style guide', 'warm weather mens fashion'],
    'Spring Transitions': ['spring transition outfits', 'spring fashion mens', 'spring style tips', 'spring wardrobe ideas', 'layering spring'],
    'Autumn Fashion': ['autumn mens fashion', 'fall outfit ideas', 'autumn style guide', 'fall fashion mens', 'seasonal change clothing'],
    'Winter Layering': ['winter layering guide', 'winter outfit ideas', 'cold weather style', 'layering techniques', 'winter mens fashion'],
    
    // GROOMING
    'Beard & Shaving': ['beard care tips', 'beard grooming guide', 'shaving routine mens', 'beard style ideas', 'facial hair care'],
    'Fragrance': ['mens fragrance guide', 'best mens cologne', 'cologne selection tips', 'fragrance for men', 'perfume mens 2026'],
    'Hair Care & Styles': ['mens hair care', 'hair style guide', 'haircut styles mens', 'hair product reviews', 'hairstyle ideas mens'],
    'Skincare': ['mens skincare routine', 'face care for men', 'skincare products mens', 'grooming skincare', 'skin care tips'],
    
    // ACCESSORIES
    'Bags': ['mens bags style', 'best mens bags', 'bag selection guide', 'mens backpack fashion', 'carry bag mens'],
    'Footwear': ['mens shoes style guide', 'shoe selection tips', 'footwear ideas mens', 'shoe care tips', 'shoe fashion mens'],
    'Glasses & Sunglasses': ['mens glasses style', 'sunglasses for men', 'eyewear fashion', 'glasses style guide', 'frame selection mens'],
    'Hats & Caps': ['mens hat styles', 'cap fashion tips', 'hat selection guide', 'hat style ideas', 'headwear for men'],
    'Watches': ['mens watches guide', 'watch style tips', 'watch selection', 'luxury watch mens', 'watch fashion'],
    
    // LIFESTYLE ACTIVITIES
    'Gym & Fitness Style': ['gym outfit mens', 'fitness wear style', 'gym fashion tips', 'workout clothing', 'athletic wear mens'],
    'Travel Packing': ['travel packing mens', 'packing tips for trips', 'travel wardrobe ideas', 'luggage packing guide', 'travel outfit ideas'],
    'Office Style': ['office style guide', 'work outfit ideas', 'professional style mens', 'office wear tips', 'workplace fashion'],
    'Casual Weekend': ['weekend casual outfit', 'casual weekend style', 'relax outfit ideas', 'weekend fashion', 'casual vibe clothing'],
    'Night Out': ['night out outfit men', 'going out style', 'evening outfit ideas', 'night wear mens', 'social outfit mens'],
    
    // PARENT CATEGORIES
    'Clothing': ['mens clothing guide', 'wardrobe basics', 'clothing essentials', 'outfit building', 'mens fashion'],
    'Accessories': ['mens accessories guide', 'accessory selection', 'complete your outfit', 'accessories style', 'finishing touches'],
    'Grooming': ['grooming tips men', 'personal grooming', 'mens grooming essentials', 'grooming routine', 'self care mens'],
    'Lifestyle': ['lifestyle fashion', 'everyday living style', 'lifestyle tips', 'life and fashion', 'lifestyle guide'],
    'Travel': ['travel style guide', 'traveling tips', 'destination outfit', 'travel fashion', 'packing style'],
    'Life': ['life and style', 'everyday life fashion', 'lifestyle balance', 'life philosophy', 'day to day style'],
    'Lifestyle Activities': ['activity wear style', 'event outfit ideas', 'occasion dressing', 'activity fashion', 'lifestyle activities']
  };

  // Pick 3 random different categories
  const categoryKeys = Object.keys(keywordDatabase);
  const selectedCategories = [];
  const selectedKeywords = [];
  
  while (selectedCategories.length < 3 && categoryKeys.length > 0) {
    const randomIndex = Math.floor(Math.random() * categoryKeys.length);
    const randomCat = categoryKeys[randomIndex];
    
    if (!selectedCategories.includes(randomCat)) {
      selectedCategories.push(randomCat);
      const keywords = keywordDatabase[randomCat];
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      selectedKeywords.push(`${randomCat}: ${randomKeyword}`);
    }
  }

  const prompt = `You are a men's fashion trend analyst. Create 3 DIVERSE blog topics for April 2026 targeting everyday men aged 25-55.

Use these specific categories/keywords as YOUR INSPIRATION (be creative with topics - don't copy exact titles):
1. ${selectedKeywords[0]}
2. ${selectedKeywords[1]}
3. ${selectedKeywords[2]}

For EACH topic, provide:
1. Topic title (compelling, SEO-friendly, action-oriented)
2. Category (MUST be: ${selectedCategories.join(' OR ')})
3. Primary keyword (what men actually search for, long-tail)
4. Estimated search volume (realistic: 4000-15000)
5. Trending score (1-100)

Requirements:
- Topics MUST be DIFFERENT and NEVER repetitive
- Focus on practical, actionable advice (Unfashionable Male brand - honest, no-nonsense)
- Each topic from DIFFERENT category
- High search volume keywords
- Real, valuable content for everyday men

RESPOND ONLY WITH VALID JSON (no markdown, no code blocks):
[
  {"title": "...", "category": "...", "keyword": "...", "searchVolume": 8500, "trendingScore": 85},
  {"title": "...", "category": "...", "keyword": "...", "searchVolume": 7200, "trendingScore": 78},
  {"title": "...", "category": "...", "keyword": "...", "searchVolume": 6500, "trendingScore": 82}
]`;

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
        temperature: 0.8,
        max_tokens: 1200,
      }
    );

    if (response.status === 200) {
      let content = response.body.choices[0].message.content.trim();
      
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('⚠️  Could not extract JSON, using fallback topics');
        return getFallbackTopics();
      }
      
      const topics = JSON.parse(jsonMatch[0]);
      
      // Validate topics
      if (!Array.isArray(topics) || topics.length < 3) {
        console.warn('⚠️  Invalid topics format, using fallback');
        return getFallbackTopics();
      }
      
      console.log(`✅ Found 3 trending topics via research\n`);
      return topics.slice(0, 3); // Return only top 3
    } else {
      console.error('❌ OpenAI error:', response.status);
      return getFallbackTopics();
    }
  } catch (error) {
    console.error('❌ Topic discovery failed:', error.message);
    return getFallbackTopics();
  }
}

// Fallback topics if ChatGPT research fails
function getFallbackTopics() {
  return [
    {
      title: 'Smart Casual Work Outfits: 5 Office Looks That Actually Work',
      category: 'Smart Casual for Work',
      keyword: 'smart casual work outfits men',
      searchVolume: 8900,
      trendingScore: 87
    },
    {
      title: 'Best Affordable Menswear Brands Under £50 in 2026',
      category: 'Budget Fashion',
      keyword: 'affordable mens fashion brands UK',
      searchVolume: 9200,
      trendingScore: 85
    },
    {
      title: 'Dressing for Your Body Type: The Tall Man\'s Guide',
      category: 'Dressing for Tall Men',
      keyword: 'tall man fashion tips clothing',
      searchVolume: 6500,
      trendingScore: 78
    }
  ];
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

  const prompt = `Write a comprehensive blog post for "Unfashionable Male" - a practical style guide for everyday men.

Blog Brand: Straightforward, honest, no-nonsense style advice. No pretentious fashion talk. Real-life clothing for real budgets.

Based on this outline:
${outline}

Requirements:
- 1500-2000 words
- UK English spelling and grammar (colour, organise, etc.)
- H2 and H3 headings for structure
- Long-tail keywords naturally throughout
- NO external links - do not include placeholder links like example.com
- FAQ section at end with 4-5 questions
- NO "Conclusion" section
- Output ONLY pure HTML (no markdown)
- Include JSON-LD schema markup at end
- Target for Rank Math SEO

TONE & VOICE:
- Conversational and friendly (like talking to a mate)
- Practical and honest - no pretentious fashion jargon
- Relatable to everyday men with real budgets
- Confident but not arrogant
- Focus on confidence building, not designer labels
- Use simple language - explain WHY something works, not just that it does
- Include practical tips readers can actually use
- Be encouraging - make style feel accessible, not intimidating

CONTENT STYLE:
- Start with a relatable problem or situation
- Explain the solution in plain English
- Include practical examples and real-world scenarios
- Mention budget-friendly options when relevant
- Avoid fashion clichés and overused phrases
- Be honest about what works and what doesn't

CRITICAL FORMATTING:
- Do NOT use &nbsp; entities
- Do NOT add empty lines between tags
- Do NOT include <style> tags or CSS
- Do NOT include <br /> tags
- Start with 1-2 paragraphs of intro content (NO H1 or H2 headers)
- After intro paragraphs, use normal H2 and H3 headers for rest of sections
- Use clean, minimal HTML only
- Paragraph tags only where needed
- No excessive spacing
- NO placeholder links to example.com or generic URLs
- ONLY use: <p>, <h2>, <h3>, <a>, <strong>, <em>, <ul>, <li> tags

Topic: ${topic.title}
Primary keyword: ${topic.keyword}
Category: ${topic.category}
Audience: Everyday men aged 25-55 who want to dress well without fuss`;

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
      // Remove <style> tags and content
      content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
      // Remove &nbsp; entities
      content = content.replace(/&nbsp;/g, ' ');
      // Remove <br /> tags
      content = content.replace(/<br\s*\/?>/gi, '');
      // Remove extra whitespace between tags
      content = content.replace(/>\s+</g, '><').trim();
      // Remove leading/trailing whitespace
      content = content.trim();
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
      `/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&client_id=${process.env.UNSPLASH_API_KEY}`,
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
    // BODY TYPE & FIT
    'Body Type & Fit': 1731,
    'Dressing for Slim Build': 1732,
    'Dressing for Athletic Build': 1733,
    'Dressing for Plus Size': 1734,
    'Dressing for Short Men': 1735,
    'Dressing for Tall Men': 1736,
    
    // OCCASIONS & EVENTS
    'Occasions & Events': 1737,
    'Job Interview Outfits': 1738,
    'First Date Outfit': 1739,
    'Wedding Guest Outfit': 1740,
    'Casual Friday': 1741,
    'Smart Casual for Work': 1742,
    'Weekend Casual': 1743,
    
    // BUDGET & VALUE
    'Budget & Value': 1744,
    'Budget Fashion': 1745,
    'High Street Brands': 1746,
    'Designer Dupes': 1747,
    'Affordable Accessories': 1748,
    
    // COLOR & COMBINATIONS
    'Color & Combinations': 1749,
    'Color Matching Guide': 1750,
    'Neutral Colors': 1751,
    'Pattern Mixing': 1752,
    'Monochrome Styling': 1753,
    
    // CLOTHING
    'Clothing': 1713,
    'Casual Style': 1714,
    'Capsule Wardrobe': 1718,
    'Formalwear': 1716,
    'Smart Casual': 1715,
    'Style Mistakes': 1719,
    
    // SEASONAL WARDROBE
    'Seasonal Wardrobe': 1717,
    'Summer Style': 1754,
    'Spring Transitions': 1756,
    'Autumn Fashion': 1757,
    'Winter Layering': 1755,
    
    // GROOMING
    'Grooming': 1720,
    'Beard & Shaving': 1722,
    'Fragrance': 1724,
    'Hair Care & Styles': 1721,
    'Skincare': 1723,
    
    // ACCESSORIES
    'Accessories': 1725,
    'Bags': 1728,
    'Footwear': 1727,
    'Glasses & Sunglasses': 1730,
    'Hats & Caps': 1729,
    'Watches': 1726,
    
    // LIFESTYLE ACTIVITIES
    'Lifestyle Activities': 1758,
    'Gym & Fitness Style': 1759,
    'Travel Packing': 1760,
    'Office Style': 1761,
    'Casual Weekend': 1762,
    'Night Out': 1763,
    
    // LIFESTYLE (Parent)
    'Lifestyle': 1672,
    'Travel': 1676,
    'Life': 1701,
    'Activites': 1707,
    
    // OTHER
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
