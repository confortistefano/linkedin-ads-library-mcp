// LinkedIn Ad Library API response types
// Based on actual API responses from version 202503

export interface PagingLink {
  type: string;
  rel: string;
  href: string;
}

export interface PagingInfo {
  start: number;
  count: number;
  total: number;
  links: PagingLink[];
}

// --- Ad Library ---

export interface AdAdvertiser {
  adPayer: string;
  advertiserName: string;
  advertiserUrl: string;
}

export interface CountryImpression {
  country: string; // URN format: "urn:li:country:IT"
  impressionPercentage: number;
}

export interface AdStatistics {
  firstImpressionAt: number;
  latestImpressionAt: number;
  totalImpressions: {
    from: number;
    to: number;
  };
  impressionsDistributionByCountry: CountryImpression[];
}

export interface AdTargetingFacet {
  facetName: string;
  includedSegments: string[];
  excludedSegments: string[];
  isIncluded: boolean;
  isExcluded: boolean;
}

export interface AdDetails {
  advertiser: AdAdvertiser;
  adStatistics?: AdStatistics;
  adTargeting?: AdTargetingFacet[];
  type: string;
}

export interface AdLibraryElement {
  isRestricted: boolean;
  adUrl: string;
  details: AdDetails;
}

export interface AdLibraryResponse {
  paging: PagingInfo;
  elements: AdLibraryElement[];
}

// --- Job Library ---

export interface JobDetails {
  organizationName: string;
  jobLocation: string;
  jobTitle: string;
  payerName: string;
  jobDescription: string;
}

export interface JobLibraryElement {
  jobPostingUrl: string;
  restrictionReason?: string;
  jobDetails: JobDetails;
}

export interface JobLibraryResponse {
  paging: PagingInfo;
  elements: JobLibraryElement[];
}

// --- Paid Endorsement Posts ---

export interface PaidEndorsementElement {
  postUrl: string;
}

export interface PaidEndorsementResponse {
  paging: PagingInfo;
  elements: PaidEndorsementElement[];
}
