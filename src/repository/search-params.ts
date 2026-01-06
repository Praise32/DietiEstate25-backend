export interface LocationSearchParams {
  latitude: number;
  longitude: number;
  radius: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface NearbySearchParams extends LocationSearchParams, PaginationParams {}

export function createSearchCenterPoint(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
