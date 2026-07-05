import { LinkedInAdsClient } from "../linkedin-client.js";

export async function handleSearchJobs(
  client: LinkedInAdsClient,
  args: { keyword: string; start?: number; count?: number }
) {
  const result = await client.searchJobs(args.keyword, args.start, args.count);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            total: result.paging.total,
            returned: result.elements.length,
            jobs: result.elements.map((el) => ({
              jobPostingUrl: el.jobPostingUrl,
              title: el.jobDetails?.jobTitle,
              organization: el.jobDetails?.organizationName,
              location: el.jobDetails?.jobLocation,
              payer: el.jobDetails?.payerName,
              description: el.jobDetails?.jobDescription
                ? el.jobDetails.jobDescription.substring(0, 500) +
                  (el.jobDetails.jobDescription.length > 500 ? "..." : "")
                : null,
              restrictionReason: el.restrictionReason || null,
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
