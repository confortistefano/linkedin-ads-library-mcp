import { LinkedInAdsClient } from "../linkedin-client.js";

export async function handleSearchAds(
  client: LinkedInAdsClient,
  args: { keyword: string; start?: number; count?: number }
) {
  const result = await client.searchAds(args.keyword, args.start, args.count);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            total: result.paging.total,
            returned: result.elements.length,
            ads: result.elements.map((el) => ({
              adUrl: el.adUrl,
              isRestricted: el.isRestricted,
              advertiser: el.details.advertiser,
              type: el.details.type,
              impressions: el.details.adStatistics?.totalImpressions,
              firstSeen: el.details.adStatistics?.firstImpressionAt
                ? new Date(el.details.adStatistics.firstImpressionAt).toISOString()
                : null,
              lastSeen: el.details.adStatistics?.latestImpressionAt
                ? new Date(el.details.adStatistics.latestImpressionAt).toISOString()
                : null,
              topCountries: el.details.adStatistics?.impressionsDistributionByCountry
                ?.filter((c) => c.impressionPercentage > 1)
                .sort((a, b) => b.impressionPercentage - a.impressionPercentage)
                .map((c) => ({
                  country: c.country.replace("urn:li:country:", ""),
                  percentage: Math.round(c.impressionPercentage * 100) / 100,
                })),
              targeting: el.details.adTargeting?.map((t) => ({
                facet: t.facetName,
                included: t.includedSegments,
                excluded: t.excludedSegments,
              })),
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
