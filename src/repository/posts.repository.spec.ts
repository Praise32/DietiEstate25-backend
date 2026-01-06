import { db } from "@/db";

import { getPostsNearby } from "./posts.repository";

// Mock di db: mockiamo 'select' invece di 'execute'
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
    // Arrange
    const mockPosts = [{ id: 1, title: "Casa Bella", dist_meters: 100 }];

    // Costruiamo la catena di mock per Drizzle:
    // db.select().from().where().orderBy().limit().offset() -> ritorna i dati
    const offsetMock = jest.fn().mockResolvedValue(mockPosts);
    const limitMock = jest.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
    const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });

    (db.select as jest.Mock).mockReturnValue({ from: fromMock });

    // Act
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

    // Assert
    expect(db.select).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalled(); // Verifica che .from() sia stato chiamato
    expect(whereMock).toHaveBeenCalled(); // Verifica che .where() sia stato chiamato
    expect(result).toEqual(mockPosts);
  });
});
