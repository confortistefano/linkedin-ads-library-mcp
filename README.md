# LinkedIn Ad Library MCP Server

An MCP (Model Context Protocol) server that provides access to LinkedIn's Ad Library API. Search ads, sponsored jobs, and paid endorsement posts from any advertiser on LinkedIn.

Built for competitive intelligence, ad research, and B2B marketing analysis.

## Tools

| Tool | Description | Data returned |
|------|-------------|---------------|
| `search_ads` | Search the LinkedIn Ad Library | Advertiser, ad type, impressions, country distribution, targeting |
| `search_jobs` | Search sponsored job postings | Job title, organization, location, payer, description |
| `search_paid_endorsements` | Search paid creator/influencer posts | Post URLs |

## Prerequisites

1. A [LinkedIn Developer App](https://www.linkedin.com/developers/apps) with the **Ad Library** product enabled
2. A valid LinkedIn OAuth access token (expires every 60 days)

### Getting an access token

**Option A: Token Generator (fastest)**

1. Go to [LinkedIn Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator)
2. Select your app
3. Select any available scope (e.g., `openid`)
4. Click **Request access token**
5. Copy the token

**Option B: Manual OAuth flow**

1. Add a redirect URI in your app's **Auth** tab (e.g., `https://oauth.pstmn.io/v1/callback` for Postman)
2. Open in browser:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={YOUR_CLIENT_ID}&redirect_uri={YOUR_REDIRECT_URI}&state=random123&scope=openid
   ```
3. Authorize and copy the `code` from the redirect URL
4. Exchange for a token:
   ```bash
   curl -X POST 'https://www.linkedin.com/oauth/v2/accessToken' \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'grant_type=authorization_code' \
     -d 'code={AUTH_CODE}' \
     -d 'client_id={YOUR_CLIENT_ID}' \
     -d 'client_secret={YOUR_CLIENT_SECRET}' \
     -d 'redirect_uri={YOUR_REDIRECT_URI}'
   ```

## Installation

```bash
git clone https://github.com/confortistefano/linkedin-ads-library-mcp.git
cd linkedin-ads-library-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to your MCP settings:

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

### Claude Desktop

Add to `claude_desktop_config.json`:

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
echo "LINKEDIN_ACCESS_TOKEN=your-token-here" > .env
docker compose up -d
```

The server will be available at `http://localhost:3001/mcp`.

## Usage examples

Once connected, you can ask your AI assistant:

- "Search LinkedIn ads for Klarna"
- "Find all sponsored job postings from PayPal"
- "Show me paid endorsement posts mentioning Stripe"
- "Compare ad targeting between Klarna and Afterpay"
- "What countries is Revolut running LinkedIn ads in?"

## API details

This server wraps LinkedIn's Ad Library API (version 202503) with three endpoints:

| Endpoint | Finder | Method |
|----------|--------|--------|
| `/rest/adLibrary` | `q=criteria` | FINDER |
| `/rest/jobLibrary` | `q=criteria` | FINDER |
| `/rest/paidEndorsementPosts` | `q=searchCriteria` | FINDER |

All endpoints use the `keyword` parameter for search and support `start`/`count` for pagination.

### Rate limits

LinkedIn does not publish specific rate limits for these endpoints. What we know:

- Limits are **per-app, per-day** and reset at **midnight UTC**
- Exceeding the limit returns HTTP **429**
- You'll get an email alert at **75% usage**
- Check your actual limits in the [Developer Portal Analytics tab](https://www.linkedin.com/developers/apps) after making at least one request

### Authentication

The API requires **Application (3-legged) OAuth** tokens. No specific OAuth scopes are required for Ad Library endpoints. Tokens expire after **60 days**.

## Development

```bash
# Run in dev mode (with hot reload)
LINKEDIN_ACCESS_TOKEN=your-token npm run dev

# Build
npm run build

# Run production
LINKEDIN_ACCESS_TOKEN=your-token npm start
```

## License

MIT
