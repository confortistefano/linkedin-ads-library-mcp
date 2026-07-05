#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { LinkedInAdsClient } from "./linkedin-client.js";
import { handleSearchAds } from "./tools/ads.js";
import { handleSearchJobs } from "./tools/jobs.js";
import { handleSearchPaidEndorsements } from "./tools/endorsements.js";

// Validate token
const token = process.env.LINKEDIN_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Error: LINKEDIN_ACCESS_TOKEN environment variable is required.\n" +
      "Get one from https://www.linkedin.com/developers/tools/oauth/token-generator"
  );
  process.exit(1);
}

const client = new LinkedInAdsClient(token);

// Helper to wrap tool handlers with error handling
function wrapHandler<T>(
  handler: (args: T) => Promise<{ content: { type: "text"; text: string }[] }>
): (
  args: T
) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  return async (args: T) => {
    try {
      return await handler(args);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

const SERVER_INSTRUCTIONS = `LinkedIn Ad Library MCP Server — provides access to LinkedIn's public Ad Library API (version 202503).

Three tools are available for B2B competitive intelligence:

1. **search_ads** — Search sponsored ads by keyword. Returns advertiser, ad format, impressions, country distribution, and targeting. Use for competitor ad analysis, creative benchmarking, and market positioning research.

2. **search_jobs** — Search sponsored job postings by keyword. Returns job title, organization, location, and description. Use for hiring signal tracking and competitor team expansion analysis.

3. **search_paid_endorsements** — Search thought leader ads (paid endorsements) by keyword. Returns post URLs. Use for influencer partnership discovery and executive branding analysis.

All tools support pagination via start/count. Default page size is 25.
Rate limits reset daily at midnight UTC. HTTP 429 means you've hit the limit.`;

// Shared Zod schemas for tool parameters
const keywordSchema = z.string().min(1).max(256).describe("Search keyword (company name, product, topic, or industry)");
const startSchema = z.number().min(0).optional().describe("Pagination offset (default 0)");
const countSchema = z.number().min(1).max(100).optional().describe("Results per page (default 25, max 100)");

// Factory: creates a new McpServer instance with all tools registered
function createServer(): McpServer {
  const server = new McpServer(
    { name: "linkedin-ads-library-mcp", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  // --- Tool: search_ads ---
  server.tool(
    "search_ads",
    `Search LinkedIn sponsored ads by keyword, company, or topic. Use to analyze competitor ad copy, messaging strategy, creative formats, geo-targeting, and audience segmentation.

Returns: advertiser name and payer, ad type (video, image, document, status update), impression ranges, country distribution (%), targeting facets (language, location, job title, company, audience), and direct link to the ad.

Example: search_ads({ keyword: "klarna", count: 25 })`,
    {
      keyword: keywordSchema,
      start: startSchema,
      count: countSchema,
    },
    wrapHandler((args) => handleSearchAds(client, args))
  );

  // --- Tool: search_jobs ---
  server.tool(
    "search_jobs",
    `Search LinkedIn sponsored job postings. Use to track competitor hiring patterns, team expansion signals, and market positioning through the roles they're investing in.

Returns: job title, organization, location, payer (who's paying for the sponsorship), and description preview.

Example: search_jobs({ keyword: "fintech product manager", count: 25 })`,
    {
      keyword: keywordSchema,
      start: startSchema,
      count: countSchema,
    },
    wrapHandler((args) => handleSearchJobs(client, args))
  );

  // --- Tool: search_paid_endorsements ---
  server.tool(
    "search_paid_endorsements",
    `Search LinkedIn thought leader ads (paid endorsements). Use to identify influencer partnerships, executive branding strategies, and creator-driven campaigns by competitors.

Returns: direct URLs to the sponsored posts.

Example: search_paid_endorsements({ keyword: "scalapay" })`,
    {
      keyword: keywordSchema,
      start: startSchema,
      count: countSchema,
    },
    wrapHandler((args) => handleSearchPaidEndorsements(client, args))
  );

  return server;
}

// --- Stdio transport (default) ---
async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinkedIn Ad Library MCP server running on stdio");
}

// --- Streamable HTTP transport (for Docker / remote) ---
async function startHttp() {
  const { default: express } = await import("express");
  const { default: rateLimit } = await import("express-rate-limit");

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT || "100", 10),
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  const port = parseInt(process.env.MCP_PORT || "3000", 10);
  const host = process.env.HOST || "127.0.0.1";

  // Map session ID → transport
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "linkedin-ads-library-mcp",
      transport: "streamable-http",
    });
  });

  // MCP POST — handles init + subsequent requests
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
            console.log(`Session initialized: ${sid}`);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            console.log(`Session closed: ${sid}`);
          }
        };

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
      }
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // MCP GET — SSE stream
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // MCP DELETE — session termination
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.listen(port, host, () => {
    console.log(
      `LinkedIn Ad Library MCP server running on http://${host}:${port}/mcp`
    );
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    for (const sid of Object.keys(transports)) {
      await transports[sid].close();
      delete transports[sid];
    }
    process.exit(0);
  });
}

// --- Main ---
const transportMode = process.env.MCP_TRANSPORT || "stdio";

if (transportMode === "http") {
  startHttp().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
} else {
  startStdio().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
