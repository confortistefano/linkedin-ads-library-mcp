import { LinkedInAdsClient } from "../linkedin-client.js";

export async function handleSearchJobs(
  client: LinkedInAdsClient,
  args: { keyword: string; start?: number; count?: number }
) {
  const result = await client.searchJobs(
    args.keyword,
    args.start ?? 0,
    args.count ?? 25
  );

  // Build summary
  const orgs = new Map<string, number>();
  for (const el of result.elements) {
    const name = el.jobDetails?.organizationName;
    if (name) orgs.set(name, (orgs.get(name) || 0) + 1);
  }

  const topOrganizations = [...orgs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, jobs: count }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            summary: {
              total: result.paging.total,
              returned: result.elements.length,
              topOrganizations,
            },
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
