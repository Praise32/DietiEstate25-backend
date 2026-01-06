import { db } from "../db/index.js";
import { appointments } from "../db/schema/appointments.js";
import { deleteAppointment } from "./appointments.repository.js";
jest.mock("@/db", () => ({
    db: {
        delete: jest.fn(),
        insert: jest.fn(),
    },
}));
describe("appointments Repository", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe("deleteAppointment", () => {
        const mockDeleteChain = (returnValue) => {
            const returningMock = jest.fn().mockResolvedValue(returnValue);
            const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
            db.delete.mockReturnValue({ where: whereMock });
            return { whereMock, returningMock };
        };
        it("dovrebbe eliminare l'appuntamento se l'utente è admin (Scenario Successo)", async () => {
            const mockDeletedAppointment = { id: 1, status: "pending" };
            mockDeleteChain([mockDeletedAppointment]);
            const result = await deleteAppointment(1, 999, "admin");
            expect(db.delete).toHaveBeenCalledWith(appointments);
            expect(result).toEqual(mockDeletedAppointment);
        });
        it("dovrebbe applicare filtri aggiuntivi se l'utente è customer", async () => {
            const { whereMock } = mockDeleteChain([{ id: 1 }]);
            await deleteAppointment(1, 123, "customer");
            expect(db.delete).toHaveBeenCalled();
            expect(whereMock).toHaveBeenCalled();
        });
        it("dovrebbe ritornare undefined se l'appuntamento non esiste o non appartiene all'utente", async () => {
            mockDeleteChain([]);
            const result = await deleteAppointment(999, 123, "customer");
            expect(result).toBeUndefined();
        });
    });
});
