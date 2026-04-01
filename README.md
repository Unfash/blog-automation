[README.md](https://github.com/user-attachments/files/26413954/README.md)
# Blog Automation System

Fully automated blog content creation, research, and publishing for unfashionablemale.co.uk.

## Features

✅ **Automated Topic Discovery** - Finds trending topics in your niche
✅ **Content Generation** - Uses Claude AI to write SEO-optimized articles (1500-2000 words)
✅ **Competitor Analysis** - Research competitor content structure
✅ **Image Sourcing** - Automatically finds relevant images from Unsplash
✅ **Internal Linking** - AI identifies and adds internal links to existing posts
✅ **SEO Optimization** - Generates meta titles, descriptions, and optimized content
✅ **WordPress Publishing** - Auto-publishes to your WordPress blog
✅ **Airtable Tracking** - Complete workflow visibility in Airtable
✅ **Scheduled Automation** - Runs 2-3 times per week automatically

## Prerequisites

- GitHub account (free)
- WordPress blog with REST API enabled
- Airtable account (free tier works)
- Claude API key (from Anthropic)
- All API credentials and base IDs

## Setup Instructions

### Step 1: Clone/Upload Files to GitHub

1. Go to your GitHub repository: `https://github.com/YourUsername/blog-automation`
2. Click **"Add file"** → **"Create new file"**
3. Create the following files (copy-paste from this repository):
   - `blog-automation.js` - Main automation script
   - `package.json` - Dependencies
   - `.env.example` - Environment variable template
   - `.github/workflows/schedule.yml` - Scheduling configuration

Or use GitHub Desktop/Git CLI to clone and push these files.

### Step 2: Set GitHub Secrets

GitHub Secrets are encrypted environment variables used by the automation.

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add these secrets (copy-paste your actual values):

| Secret Name | Value |
|---|---|
| `WORDPRESS_URL` | `https://unfashionablemale.co.uk` |
| `WORDPRESS_USERNAME` | `api-automation` |
| `WORDPRESS_PASSWORD` | Your WordPress API password |
| `AIRTABLE_TOKEN` | Your Airtable personal access token |
| `AIRTABLE_BASE_ID` | Your Airtable base ID |
| `CLAUDE_API_KEY` | Your Claude API key |
| `UNSPLASH_API_KEY` | (Optional) Your Unsplash API key |

**Important:** Never commit these secrets to your repository. Always use GitHub Secrets.

### Step 3: Configure the Workflow

The workflow file (`.github/workflows/schedule.yml`) is already configured to run:
- **Tuesday** at 9 AM UTC
- **Thursday** at 9 AM UTC
- **Saturday** at 9 AM UTC

To change the schedule, edit the `cron` times in `.github/workflows/schedule.yml`.

### Step 4: Test the Automation

1. Go to your repository → **Actions** tab
2. Select **"Blog Automation"** workflow
3. Click **"Run workflow"** → **"Run workflow"** (this triggers it manually)
4. Check the logs to see if it completes successfully

## How It Works

### Workflow Overview

```
1. Discover Trending Topics (via Google Trends simulation)
   ↓
2. Research Competitor Content (top-ranking articles)
   ↓
3. Generate Content Outline (with Claude AI)
   ↓
4. Write Full Article (1500-2000 words, SEO-optimized)
   ↓
5. Generate Meta Tags (title, description)
   ↓
6. Source Featured Image (Unsplash or placeholder)
   ↓
7. Add to Airtable (Blog Posts table)
   ↓
8. Publish to WordPress (auto-published or scheduled)
```

### Data Flow

**Airtable Tables:**
- **Topics** - Discovered trending topics waiting to be written
- **Existing Posts** - Your 140+ existing blog posts (for reference/internal linking)
- **Blog Posts** - New posts being created or ready to publish
- **Publishing Schedule** - Publication dates and status

**APIs Used:**
- **Claude API** - Content generation and optimization
- **WordPress REST API** - Publishing posts
- **Airtable API** - Storing and retrieving data
- **Unsplash API** - Finding images
- **GitHub Actions** - Scheduling and running automation

## Running Manually

To run the automation outside the scheduled times:

1. Go to your repository → **Actions** tab
2. Select **"Blog Automation"**
3. Click **"Run workflow"**
4. Select the branch (usually "main")
5. Click **"Run workflow"**

The automation will run immediately.

## Monitoring & Troubleshooting

### Check Logs

1. Go to **Actions** → **Blog Automation**
2. Click the latest run
3. Click **"Run blog automation"** step to see detailed logs
4. Look for ✅ or ❌ indicators

### Common Issues

**Issue: "Authentication failed"**
- Check that your WordPress username/password are correct
- Verify WordPress REST API is enabled
- Check that the API user has "Editor" role

**Issue: "Airtable errors"**
- Verify your Airtable token hasn't expired
- Check that base ID is correct
- Ensure table names match exactly: "Topics", "Blog Posts", "Publishing Schedule"

**Issue: "No image found"**
- If using Unsplash, add your API key (optional - uses placeholder otherwise)
- Check your internet connection

**Issue: "Claude API error"**
- Verify your Claude API key is valid
- Check you have API credits available
- Ensure the key starts with `sk-ant-`

## Customization

### Change Publication Schedule

Edit `.github/workflows/schedule.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9 AM
    - cron: '0 14 * * 3' # Wednesday 2 PM
```

[Cron schedule reference](https://crontab.guru/)

### Change Article Length

In `blog-automation.js`, modify the Claude prompt:
- `max_tokens: 3000` - Increase for longer articles
- Word count expectation in the prompt (currently 1500-2000)

### Add Competitor Analysis

The current version has placeholder competitor analysis. To enhance:

1. Add URLs of your top competitors to Airtable
2. Modify the `generateOutline()` function to fetch and analyze their content
3. Use Claude to compare their structure with your planned article

### Customize Topic Discovery

Currently uses a hardcoded list. To add real Google Trends:

1. Sign up for [Google Trends API](https://trends.google.com/)
2. Add logic to fetch actual trending topics
3. Filter by your categories (Clothing, Accessories, Grooming, Lifestyle)

## Security Best Practices

✅ **Do:**
- Keep API keys in GitHub Secrets, never in code
- Use strong WordPress passwords
- Rotate API keys periodically
- Monitor GitHub Actions logs for errors
- Keep dependencies updated

❌ **Don't:**
- Commit `.env` file to GitHub (use `.env.example` as template)
- Share API keys or passwords
- Disable two-factor authentication on GitHub
- Use the same password for multiple services

## Costs

**Free Tier:**
- GitHub Actions: 2,000 free minutes/month (unlimited for public repos)
- Claude API: Pay per token (~$0.003 per 1K tokens, ~$2-5/month for 2-3 posts/week)
- Airtable: Free tier includes 1,200 API calls/hour, plenty for your needs
- Unsplash: Free tier unlimited

**Estimated Monthly Cost:** $2-10 (mostly Claude API usage)

## Support & Updates

This automation is maintained and will be updated as:
- Claude API evolves
- WordPress updates
- Airtable changes their API

Check back regularly for updates.

## Future Enhancements

Potential improvements (not yet implemented):

- [ ] Real Google Trends integration
- [ ] Advanced competitor analysis
- [ ] AI-generated images instead of stock photos
- [ ] Email notifications on publish
- [ ] Analytics tracking in Airtable
- [ ] A/B testing headlines
- [ ] Social media auto-posting
- [ ] Performance analytics dashboard

## License

MIT License - Free to use and modify.

---

**Questions or issues?** Check the logs in GitHub Actions or review the configuration steps above.
