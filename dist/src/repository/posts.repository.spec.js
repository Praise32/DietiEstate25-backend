import { db } from "../db/index.js";
import { getPostsNearby } from "./posts.repository.js";
jest.mock("@/db", () => ({
    db: {
        select: jest.fn(),
    },
}));
describe("posts Repository - getPostsNearby", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("dovrebbe eseguire la query spaziale con i parametri corretti", async () => {
        const mockPosts = [{ id: 1, title: "Casa Bella", dist_meters: 100 }];
        const offsetMock = jest.fn().mockResolvedValue(mockPosts);
        const limitMock = jest.fn().mockReturnValue({ offset: offsetMock });
        const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
        const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
        const fromMock = jest.fn().mockReturnValue({ where: whereMock });
        db.select.mockReturnValue({ from: fromMock });
        const lat = 40.85;
        const lon = 14.26;
        const radius = 5000;
        const result = await getPostsNearby({
            latitude: lat,
            longitude: lon,
            radius,
            page: 1,
            limit: 10
        });
        expect(db.select).toHaveBeenCalled();
        expect(fromMock).toHaveBeenCalled();
        expect(whereMock).toHaveBeenCalled();
        expect(result).toEqual(mockPosts);
    });
});
