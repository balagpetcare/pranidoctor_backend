export type AreaLevel = 'DIVISION' | 'DISTRICT' | 'UPAZILA' | 'UNION' | 'VILLAGE';

export type AreaLocale = 'bn' | 'en';

export type AreaNodeDto = {
  id: string;
  slug: string;
  code: string | null;
  nameBn: string;
  nameEn: string;
  label: string;
  level: AreaLevel;
  parentId: string | null;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
};

export type AreaSearchHitDto = AreaNodeDto & {
  breadcrumb?: string;
};

export type AreaListQuery = {
  page?: number;
  pageSize?: number;
  locale?: AreaLocale;
};

export type AreaSearchQuery = AreaListQuery & {
  q: string;
  level?: AreaLevel | 'ALL';
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  unionId?: string;
};

export type AreaSeedVersion = {
  version: string;
  appliedAt: string;
  divisionCount?: number;
  districtCount?: number;
};
