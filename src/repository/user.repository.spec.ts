import { db } from "@/db";
import user from "@/db/schema/user";
import { updatePassword } from "./user.repository";

// Mock di db
jest.mock("@/db", () => ({
  db: {
    update: jest.fn(),
  },
}));

describe("User Repository - updatePassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dovrebbe aggiornare la password per l'utente specificato (Scenario Successo)", async () => {
    // Arrange
    const userId = 1;
    const newPassword = "hashed_password_123";

    // Mock della catena: db.update().set().where()
    const whereMock = jest.fn().mockResolvedValue(undefined); // update non ritorna nulla di solito se non richiesto
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    (db.update as jest.Mock).mockReturnValue({ set: setMock });

    // Act
    await updatePassword(userId, newPassword);

    // Assert
    expect(db.update).toHaveBeenCalledWith(user);
    expect(setMock).toHaveBeenCalledWith({ password: newPassword });
    expect(whereMock).toHaveBeenCalled();
  });
});