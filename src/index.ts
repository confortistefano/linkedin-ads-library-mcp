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

Three tools are available:

1. **search_ads** — Search the LinkedIn Ad Library by keyword. Returns advertiser info, ad type, impression stats (ranges), country distribution, and targeting facets (language, location, job, company, audience).

2. **search_jobs** — Search sponsored job postings by keyword. Returns job title, organization, location, payer, and description.

3. **search_paid_endorsements** — Search paid endorsement posts (influencer/creator partnerships) by keyword. Returns post URLs.

All tools support pagination via start/count parameters. Default page size is 10.

Rate limits are not published — they reset daily at midnight UTC. If you get HTTP 429, wait and retry.`;

// Factory: creates a new McpServer instance with all tools registered
function createServer(): McpServer {
  const server = new McpServer(
    { name: "linkedin-ads-library-mcp", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  // --- Tool: search_ads ---
  server.tool(
    "search_ads",
    `Search LinkedIn Ad Library for ads matching a keyword. Returns advertiser name/payer, ad type (SPONSORED_VIDEO, SPONSORED_STATUS_UPDATE, etc.), impression ranges, country distribution (%), targeting facets (language, location, job, company), and direct ad URL.

Example: search_ads({ keyword: "klarna", count: 20 })`,
    {
      keyword: z
        .string()
        .describe("Search keyword (company name, product, topic)"),
      start: z
        .number()
        .optional()
        .describe("Pagination offset (default 0)"),
      count: z
        .number()
        .optional()
        .describe("Results per page (default 10)"),
    },
    wrapHandler((args) => handleSearchAds(client, args))
  );

  // --- Tool: search_jobs ---
  server.tool(
    "search_jobs",
    `Search LinkedIn Job Library for sponsored job postings matching a keyword. Returns job title, organization, location, payer, and description preview.

Example: search_jobs({ keyword: "fintech", count: 10 })`,
    {
      keyword: z
        .string()
        .describe("Search keyword (company name, role, industry)"),
      start: z
        .number()
        .optional()
        .describe("Pagination offset (default 0)"),
      count: z
        .number()
        .optional()
        .describe("Results per page (default 10)"),
    },
    wrapHandler((args) => handleSearchJobs(client, args))
  );

  // --- Tool: search_paid_endorsements ---
  server.tool(
    "search_paid_endorsements",
    `Search LinkedIn for paid endorsement posts (sponsored creator/influencer content) matching a keyword. Returns post URLs.

Example: search_paid_endorsements({ keyword: "scalapay" })`,
    {
      keyword: z
        .string()
        .describe("Search keyword (brand name, topic)"),
      start: z
        .number()
        .optional()
        .describe("Pagination offset (default 0)"),
      count: z
        .number()
        .optional()
        .describe("Results per page (default 10)"),
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

  const app = express();
  app.use(express.json());

  const port = parseInt(process.env.MCP_PORT || "3000", 10);

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

  app.listen(port, "0.0.0.0", () => {
    console.log(
      `LinkedIn Ad Library MCP server running on http://0.0.0.0:${port}/mcp`
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
