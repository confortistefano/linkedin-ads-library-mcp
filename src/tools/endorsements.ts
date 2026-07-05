import { LinkedInAdsClient } from "../linkedin-client.js";

export async function handleSearchPaidEndorsements(
  client: LinkedInAdsClient,
  args: { keyword: string; start?: number; count?: number }
) {
  const result = await client.searchPaidEndorsements(
    args.keyword,
    args.start,
    args.count
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            total: result.paging.total,
            returned: result.elements.length,
            posts: result.elements.map((el) => ({
              postUrl: el.postUrl,
            })),
            paging: {
              start: result.paging.start,
              count: result.paging.count,
              total: result.paging.total,
              hasMore: result.paging.links.some((l) => l.rel === "next"),
            },
          },
          null,
          2
        ),
      },
    ],
  };
}
