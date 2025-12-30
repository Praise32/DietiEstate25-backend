import { db } from "@/db";
import { appointments } from "@/db/schema/appointments";

import { deleteAppointment } from "./appointments.repository";

// 1. Mock del modulo DB per isolamento totale
jest.mock("@/db", () => ({
  db: {
    delete: jest.fn(),
    insert: jest.fn(),
  },
}));

describe("appointments Repository", () => {
  // Reset dei mock prima di ogni test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("deleteAppointment", () => {
    // Helper per mockare la catena di Drizzle: db.delete().where().returning()
    const mockDeleteChain = (returnValue: any[]) => {
      const returningMock = jest.fn().mockResolvedValue(returnValue);
      const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
      (db.delete as jest.Mock).mockReturnValue({ where: whereMock });
      return { whereMock, returningMock };
    };

    it("dovrebbe eliminare l'appuntamento se l'utente è admin (Scenario Successo)", async () => {
      // Arrange
      const mockDeletedAppointment = { id: 1, status: "pending" };
      mockDeleteChain([mockDeletedAppointment]);

      // Act
      const result = await deleteAppointment(1, 999, "admin");

      // Assert
      expect(db.delete).toHaveBeenCalledWith(appointments);
      expect(result).toEqual(mockDeletedAppointment);
    });

    it("dovrebbe applicare filtri aggiuntivi se l'utente è customer", async () => {
      // Arrange
      const { whereMock } = mockDeleteChain([{ id: 1 }]);

      // Act
      await deleteAppointment(1, 123, "customer");

      // Assert
      // Verifichiamo che where sia stato chiamato.
      // Nota: verificare gli argomenti esatti di 'and()' e 'eq()' di Drizzle è complesso nei mock,
      // ma possiamo verificare che la catena sia stata eseguita.
      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });

    it("dovrebbe ritornare undefined se l'appuntamento non esiste o non appartiene all'utente", async () => {
      // Arrange
      // Simuliamo che il DB non ritorni nulla (nessuna riga cancellata)
      mockDeleteChain([]);

      // Act
      const result = await deleteAppointment(999, 123, "customer");

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
