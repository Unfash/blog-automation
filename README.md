# Blog Automation System

Fully automated blog content creation and publishing pipeline for WordPress sites.

## Features

- ✅ **Automated Content Generation** - Creates 1500-2000 word articles using ChatGPT
- ✅ **SEO Optimization** - Generates meta titles, descriptions, schema markup
- ✅ **Image Handling** - Fetches and uploads landscape images from Unsplash
- ✅ **WordPress Integration** - Publishes directly to WordPress with JWT authentication
- ✅ **Airtable Tracking** - Stores content and publishing history for review
- ✅ **Scheduled Publishing** - Runs automatically 3x per week via GitHub Actions
- ✅ **UK English** - Optimized for UK audience with proper spelling/grammar

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Unfash/blog-automation.git
cd blog-automation
```

### 2. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure GitHub Secrets
Add to repository Settings → Secrets and variables → Actions:
- `WORDPRESS_URL`
- `WORDPRESS_USERNAME`
- `WORDPRESS_PASSWORD`
- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`
- `OPENAI_API_KEY`
- `UNSPLASH_API_KEY`

### 5. Test Locally
```bash
npm start
```

### 6. Deploy to GitHub
```bash
git add .
git commit -m "Initial setup"
git push
```

## Project Structure

```
blog-automation/
├── blog-automation.js          # Main automation script
├── package.json                # Node.js dependencies
├── .env.example               # Environment variables template
├── README.md                  # This file
├── .github/
│   └── workflows/
│       └── schedule.yml       # GitHub Actions workflow
└── DOCUMENTATION.md           # Complete documentation
```

## Configuration

### WordPress Setup
1. Install JWT Authentication plugin
2. Add to wp-config.php:
```php
define('JWT_AUTH_SECRET_KEY', 'your-secret-key-here');
define('JWT_AUTH_CORS_ENABLE', true);
```

### Airtable Base
Create 4 tables:
- **Existing Posts** - Archive of published posts
- **Topics** - Trending topics discovered
- **Blog Posts** - Generated content ready to publish
- **Publishing Schedule** - Publishing history log

### Schedule
Default schedule (randomized times):
- Monday 7:30 AM UTC
- Wednesday 2:15 PM UTC
- Friday 10:45 AM UTC

Edit `.github/workflows/schedule.yml` to change times.

## API Keys Required

- **OpenAI** - ChatGPT API for content generation
- **Airtable** - Personal access token
- **Unsplash** - API key for images
- **WordPress** - JWT secret key

## Monitoring

Monitor automation via:
1. **GitHub Actions** - repo → Actions tab
2. **Airtable** - Blog Posts table
3. **WordPress** - Posts page
4. **Publishing Schedule** - Airtable table

## Troubleshooting

### Posts Not Publishing
- Check GitHub Actions logs
- Verify JWT token validity
- Ensure api-automation user is Administrator

### Image Upload Fails
- Check MIME types
- Verify WordPress media permissions
- Ensure file size < 10MB

### No Scheduled Runs
- GitHub account must be 24+ hours old
- Check cron expressions in schedule.yml
- Manually trigger: Actions → Blog Automation → Run workflow

## Cost

- **OpenAI:** ~$0.23/month (gpt-4o-mini)
- **Airtable:** Free tier
- **Unsplash:** Free tier
- **GitHub Actions:** Free tier
- **Total:** ~$5-20/month (mostly Cloudflare)

## Documentation

See `DOCUMENTATION.md` for:
- Complete architecture
- Setup instructions
- API integration details
- Airtable schema
- Code explanation
- Replication guide for new websites

## For New Websites

To replicate this system on a new site:

1. Read "For New Website Setup" in DOCUMENTATION.md
2. Replace domain names and credentials
3. Update WordPress category IDs
4. Customize topics and keywords
5. Test thoroughly before scheduling

## Support

For issues:
1. Check GitHub Actions logs
2. Review DOCUMENTATION.md troubleshooting section
3. Verify all credentials are correct
4. Test with manual workflow trigger

## License

MIT

## Author

Blog Automation System v1.0
Created: 2026-04-03
