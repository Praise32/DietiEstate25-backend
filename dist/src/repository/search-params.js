export function createSearchCenterPoint(longitude, latitude) {
    return `SRID=4326;POINT(${longitude} ${latitude})`;
}
export function calculateOffset(page, limit) {
    return (page - 1) * limit;
}
