# LinkedIn Ad Library MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

An MCP server that connects AI assistants to LinkedIn's Ad Library API. Search any advertiser's sponsored content, job postings, and influencer partnerships — directly from Claude or any MCP-compatible client.

## Use Cases

**Competitor Ad Analysis** — See what ads your competitors are running, where they're targeting, and how much reach they're getting. Compare messaging strategies across markets.

**Creative Benchmarking** — Discover which ad formats (video, image, document, carousel) competitors use most. Analyze copy patterns and CTAs across your industry.

**Hiring Signal Tracking** — Monitor sponsored job postings to spot competitors scaling teams, entering new markets, or launching new products based on the roles they're hiring for.

**Influencer & Thought Leader Discovery** — Find which brands are running thought leader ads (paid endorsements) and identify creator partnerships in your space.

## Tools

| Tool | What it does |
|------|-------------|
| `search_ads` | Search sponsored ads — returns advertiser, ad type, impressions, country distribution, targeting |
| `search_jobs` | Search sponsored job postings — returns title, organization, location, description |
| `search_paid_endorsements` | Search thought leader ads — returns post URLs |

## Example Prompts

Once connected, try asking your AI assistant:

```
"Show me all LinkedIn ads mentioning Klarna in the last month"

"Compare the ad targeting strategy of Stripe vs Adyen in Europe"

"What job roles is Revolut sponsoring on LinkedIn right now?"

"Find thought leader ads in the BNPL space"

"Analyze the top 50 fintech ads by impression volume and summarize the messaging patterns"

"Which countries is PayPal targeting with their LinkedIn campaigns?"
```

## Prerequisites

1. A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with the **Ad Library** product enabled
2. A LinkedIn OAuth access token (expires every 60 days)

### Getting Your Access Token

**Fastest way** — use LinkedIn's built-in token generator:

1. Go to [LinkedIn Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator)
2. Select your app
3. Select any scope (e.g., `openid`)
4. Click **Request access token**
5. Copy the token

**Alternative** — manual OAuth flow:

1. Add a redirect URI in your app's **Auth** tab
2. Visit:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=openid&state=random123
   ```
3. Authorize → copy the `code` parameter from the redirect
4. Exchange it:
   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -d grant_type=authorization_code \
     -d code=AUTH_CODE \
     -d client_id=YOUR_CLIENT_ID \
     -d client_secret=YOUR_SECRET \
     -d redirect_uri=YOUR_REDIRECT_URI
   ```

## Setup

```bash
git clone https://github.com/confortistefano/linkedin-ads-library-mcp.git
cd linkedin-ads-library-mcp
npm install
npm run build
```

### Connect to Claude Code

Add to your MCP settings (`.claude/settings.json` or project settings):

```json
{
  "mcpServers": {
    "linkedin-ads": {
      "command": "node",
      "args": ["/path/to/linkedin-ads-library-mcp/dist/index.js"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linkedin-ads": {
      "command": "node",
      "args": ["/path/to/linkedin-ads-library-mcp/dist/index.js"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Docker

```bash
echo "LINKEDIN_ACCESS_TOKEN=your-token" > .env
docker compose up -d
```

Server available at `http://localhost:3001/mcp`.

## API Reference

This server wraps LinkedIn's Ad Library API (version 202503):

| Endpoint | Method | Tool |
|----------|--------|------|
| `/rest/adLibrary` | FINDER `q=criteria` | `search_ads` |
| `/rest/jobLibrary` | FINDER `q=criteria` | `search_jobs` |
| `/rest/paidEndorsementPosts` | FINDER `q=searchCriteria` | `search_paid_endorsements` |

### Rate Limits

LinkedIn doesn't publish specific rate limits. What we know:

- Limits are **per-app, per-day**, reset at **midnight UTC**
- HTTP **429** = limit reached, wait until reset
- Email alert at **75%** usage
- Check your limits: [Developer Portal](https://www.linkedin.com/developers/apps) → your app → Analytics tab

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LINKEDIN_ACCESS_TOKEN` | required | OAuth access token |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3000` | HTTP server port |
| `HOST` | `127.0.0.1` | HTTP server bind address |
| `RATE_LIMIT` | `100` | Max requests per minute (HTTP mode) |

## Development

```bash
LINKEDIN_ACCESS_TOKEN=your-token npm run dev    # Dev mode with hot reload
npm run build                                    # Compile TypeScript
LINKEDIN_ACCESS_TOKEN=your-token npm start       # Production
```

## License

MIT
