import type {
  AdLibraryResponse,
  JobLibraryResponse,
  PaidEndorsementResponse,
} from "./types.js";

export class LinkedInAdsClient {
  private baseUrl = "https://api.linkedin.com";
  private version = "202503";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const searchParams = new URLSearchParams(params);
    const url = `${this.baseUrl}${path}?${searchParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "LinkedIn-Version": this.version,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    const responseBody = await response.text();

    if (!response.ok) {
      // Log full details server-side for debugging
      let debugMessage = `LinkedIn API error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(responseBody);
        if (errorJson.message) debugMessage += ` — ${errorJson.message}`;
        if (errorJson.errorDetails) debugMessage += `\n${JSON.stringify(errorJson.errorDetails)}`;
      } catch {
        if (responseBody) debugMessage += `\n${responseBody}`;
      }
      console.error(debugMessage);

      // Return sanitized error to client
      throw new Error(
        `LinkedIn API returned ${response.status}. Check server logs for details.`
      );
    }

    if (!responseBody) {
      return {} as T;
    }
    return JSON.parse(responseBody) as T;
  }

  async searchAds(
    keyword: string,
    start?: number,
    count?: number
  ): Promise<AdLibraryResponse> {
    const params: Record<string, string> = {
      q: "criteria",
      keyword,
    };
    if (start !== undefined) params.start = String(start);
    if (count !== undefined) params.count = String(count);

    return this.request<AdLibraryResponse>("/rest/adLibrary", params);
  }

  async searchJobs(
    keyword: string,
    start?: number,
    count?: number
  ): Promise<JobLibraryResponse> {
    const params: Record<string, string> = {
      q: "criteria",
      keyword,
    };
    if (start !== undefined) params.start = String(start);
    if (count !== undefined) params.count = String(count);

    return this.request<JobLibraryResponse>("/rest/jobLibrary", params);
  }

  async searchPaidEndorsements(
    keyword: string,
    start?: number,
    count?: number
  ): Promise<PaidEndorsementResponse> {
    const params: Record<string, string> = {
      q: "searchCriteria",
      keyword,
    };
    if (start !== undefined) params.start = String(start);
    if (count !== undefined) params.count = String(count);

    return this.request<PaidEndorsementResponse>(
      "/rest/paidEndorsementPosts",
      params
    );
  }
}
