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

/**
 * Costruisce una stringa WKT (Well-Known Text) per rappresentare un punto geografico PostGIS.
 *
 * @param longitude - Coordinata di longitudine (formato decimale)
 * @param latitude - Coordinata di latitudine (formato decimale)
 * @returns Stringa formattata per query PostGIS con sistema di riferimento WGS84 (SRID 4326)
 */
export function createSearchCenterPoint(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

/**
 * Calcola l'offset per query paginate SQL/ORM.
 *
 * @param page - Numero di pagina corrente (base 1)
 * @param limit - Numero massimo di risultati per pagina
 * @returns Offset numerico da utilizzare nelle clausole SQL OFFSET
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
