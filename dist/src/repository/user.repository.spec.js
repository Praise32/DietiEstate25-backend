import { db } from "../db/index.js";
import user from "../db/schema/user.js";
import { updatePassword } from "./user.repository.js";
jest.mock("@/db", () => ({
    db: {
        update: jest.fn(),
    },
}));
describe("user Repository - updatePassword", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("dovrebbe aggiornare la password per l'utente specificato (Scenario Successo)", async () => {
        const userId = 1;
        const mockHashedValue = "test_hashed_value";
        const whereMock = jest.fn().mockResolvedValue(undefined);
        const setMock = jest.fn().mockReturnValue({ where: whereMock });
        db.update.mockReturnValue({ set: setMock });
        await updatePassword(userId, mockHashedValue);
        expect(db.update).toHaveBeenCalledWith(user);
        expect(setMock).toHaveBeenCalledWith({ password: mockHashedValue });
        expect(whereMock).toHaveBeenCalled();
    });
});
