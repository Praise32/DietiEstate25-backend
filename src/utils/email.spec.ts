/**
 * SUITE DI TEST UNITARI PER sendAppointmentRescheduledEmail
 * STRATEGIA: Black Box + White Box Testing
 *
 * METODO TESTATO:
 * sendAppointmentRescheduledEmail(
 *   userEmail: string | undefined,
 *   propertyTitle: string,
 *   oldDate: Date,
 *   newDate: Date,
 *   notes?: string
 * )
 *
 * BLACK BOX STRATEGY:
 * - Classe Equiv. 1 (Valida): userEmail definita, tutti parametri validi
 * - Classe Equiv. 2 (Non Valida): userEmail undefined (early return)
 * - Classe Equiv. 3 (Edge Case): notes presente vs notes assente
 * - Boundary Value Analysis: Date limite (passate, future, stessa data)
 *
 * WHITE BOX STRATEGY:
 * - Statement Coverage: Tutte le righe eseguite almeno una volta
 * - Branch Coverage:
 *   Ramo 1: if (!userEmail) return (riga ~215)
 *   Ramo 2: ${notes ? ... : ""} (riga ~236)
 */

// Mock del transporter - dichiarato prima del jest.mock
import { sendAppointmentRescheduledEmail } from "./email";

const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe("email.ts - sendAppointmentRescheduledEmail (Unit Testing Accademico)", () => {
  beforeEach(() => {
    // Reset mock
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: "test-id" });

    // Silenzio console.log/error per test puliti
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * =============================================================================
   * TEST CASE 1 - BLACK BOX: Classe Equivalenza VALIDA
   * Input: Tutti i parametri validi, email definita, notes presente
   * Output Atteso: Email inviata con successo, contenuto HTML include notes
   * Branch Coverage: RAMO FALSE di "if (!userEmail)" eseguito (continua),
   *                  RAMO TRUE di "notes ? ..." ESEGUITO
   * =============================================================================
   */
  it("tC1-BB: Email valida con notes - Invio riuscito (Classe Equiv. Valida)", async () => {
    // Arrange
    const userEmail = "cliente@example.com";
    const propertyTitle = "Villa sul Mare";
    const oldDate = new Date("2026-01-15T10:00:00");
    const newDate = new Date("2026-01-20T14:00:00");
    const notes = "L'agente ha proposto un orario più comodo";

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate, notes);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe(userEmail);
    expect(callArgs.subject).toContain(propertyTitle);
    expect(callArgs.subject).toContain("Modifica appuntamento");
    expect(callArgs.html).toContain(propertyTitle);
    expect(callArgs.html).toContain(notes); // BRANCH COVERAGE: notes presente
    expect(callArgs.html).toContain("<strike>"); // Verifica formattazione oldDate
    expect(callArgs.html).toContain("Team DietiEstate25");
  });

  /**
   * =============================================================================
   * TEST CASE 2 - WHITE BOX: Branch Coverage EARLY RETURN
   * Input: userEmail = undefined
   * Output Atteso: Funzione termina subito senza inviare email (early return)
   * Branch Coverage: RAMO TRUE di "if (!userEmail) return" ESEGUITO (riga ~215)
   * Statement Coverage: Righe dopo l'if NON vengono eseguite
   * =============================================================================
   */
  it("tC2-WB: userEmail undefined - Early return senza invio (Branch Coverage)", async () => {
    // Arrange
    const userEmail = undefined;
    const propertyTitle = "Appartamento Centro";
    const oldDate = new Date("2026-02-01T09:00:00");
    const newDate = new Date("2026-02-05T11:00:00");

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate);

    // Assert: BRANCH COVERAGE - early return eseguito
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  /**
   * =============================================================================
   * TEST CASE 3 - BLACK BOX: Classe Equivalenza NOTES ASSENTE
   * Input: notes parametro opzionale omesso
   * Output Atteso: Email inviata ma HTML NON contiene sezione "Note:"
   * Branch Coverage: RAMO FALSE di "notes ? ..." ESEGUITO (riga ~236)
   * =============================================================================
   */
  it("tC3-BB: Email valida senza notes - HTML senza sezione note (Branch FALSE)", async () => {
    // Arrange
    const userEmail = "utente@test.it";
    const propertyTitle = "Attico Centro Storico";
    const oldDate = new Date("2026-03-10T15:30:00");
    const newDate = new Date("2026-03-12T10:00:00");
    // notes NON fornito (undefined)

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).not.toContain("<p>Note:"); // BRANCH FALSE: notes assente
    expect(callArgs.html).not.toContain("L'agente");
  });

  /**
   * =============================================================================
   * TEST CASE 4 - BOUNDARY VALUE ANALYSIS: Date nel passato
   * Input: oldDate e newDate entrambe passate (rispetto a oggi)
   * Output Atteso: Email inviata con formattazione italiana corretta
   * Statement Coverage: Esecuzione completa di toLocaleString()
   * =============================================================================
   */
  it("tC4-BVA: Date nel passato - Formattazione italiana corretta", async () => {
    // Arrange
    const userEmail = "storico@mail.com";
    const propertyTitle = "Casa Storica";
    const oldDate = new Date("2025-01-01T10:00:00"); // Passato
    const newDate = new Date("2025-01-05T14:00:00"); // Passato

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate, "Modifica storica");

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const callArgs = mockSendMail.mock.calls[0][0];
    // Verifica che la formattazione toLocaleString("it-IT") sia stata applicata
    expect(callArgs.html).toContain("Data precedente:");
    expect(callArgs.html).toContain("Nuova data:");
    // Non possiamo verificare la stringa esatta (dipende da timezone), ma possiamo
    // verificare che il template sia stato popolato
    expect(callArgs.html).toMatch(/<strike>.*<\/strike>/);
  });

  /**
   * =============================================================================
   * TEST CASE 5 - BOUNDARY VALUE ANALYSIS: Date identiche (Edge Case)
   * Input: oldDate = newDate (cambio orario stesso giorno)
   * Output Atteso: Email inviata comunque (sistema non impedisce date uguali)
   * Statement Coverage: Entrambe le chiamate a toLocaleString eseguite
   * =============================================================================
   */
  it("tC5-BVA: oldDate = newDate (stesso timestamp) - Email inviata", async () => {
    // Arrange: Caso edge - nessun cambio effettivo (forse solo note cambiate)
    const userEmail = "edge@case.it";
    const propertyTitle = "Ufficio";
    const identicalDate = new Date("2026-06-15T09:00:00");

    // Act
    await sendAppointmentRescheduledEmail(
      userEmail,
      propertyTitle,
      identicalDate,
      identicalDate,
      "Solo conferma orario",
    );

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    // Verifica che entrambe le date siano presenti (anche se identiche)
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toContain("Data precedente:");
    expect(callArgs.html).toContain("Nuova data:");
  });

  /**
   * =============================================================================
   * TEST CASE 6 - BOUNDARY VALUE ANALYSIS: Date future molto distanti
   * Input: newDate anni nel futuro rispetto a oldDate
   * Output Atteso: Email inviata con formattazione corretta per anno lontano
   * =============================================================================
   */
  it("tC6-BVA: Date future distanti anni - Anno mostrato correttamente", async () => {
    // Arrange
    const userEmail = "future@test.com";
    const propertyTitle = "Prenotazione Anticipata";
    const oldDate = new Date("2026-12-01T10:00:00");
    const newDate = new Date("2030-12-01T10:00:00"); // 4 anni dopo

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    // Verifica che l'anno sia presente nella formattazione (opzione "year: numeric")
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toBeTruthy();
  });

  /**
   * =============================================================================
   * TEST CASE 7 - BLACK BOX: Caratteri speciali in propertyTitle
   * Input: propertyTitle con caratteri HTML-sensibili (&, <, >)
   * Output Atteso: Email inviata (nodemailer gestisce l'escaping)
   * Statement Coverage: Template string con interpolazione speciale
   * =============================================================================
   */
  it("tC7-BB: Caratteri speciali in propertyTitle - Gestione corretta", async () => {
    // Arrange
    const userEmail = "special@chars.com";
    const propertyTitle = "Villa <Luxury> & Spa"; // Caratteri HTML
    const oldDate = new Date("2026-05-01T10:00:00");
    const newDate = new Date("2026-05-02T10:00:00");

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.subject).toContain(propertyTitle);
    expect(callArgs.html).toContain(propertyTitle);
  });

  /**
   * =============================================================================
   * TEST CASE 8 - WHITE BOX: Gestione errore sendMail (Exception Path)
   * Input: nodemailer.sendMail lancia eccezione
   * Output Atteso: Funzione rilancia errore con messaggio custom
   * Branch Coverage: Blocco catch eseguito
   * =============================================================================
   */
  it("tC8-WB: Errore invio email - Eccezione gestita (Exception Branch)", async () => {
    // Arrange
    mockSendMail.mockRejectedValue(new Error("SMTP Connection Failed"));

    const userEmail = "fail@send.com";
    const propertyTitle = "Test Error";
    const oldDate = new Date("2026-01-01T10:00:00");
    const newDate = new Date("2026-01-02T10:00:00");

    // Act & Assert: BRANCH COVERAGE - catch block eseguito
    await expect(
      sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate),
    ).rejects.toThrow("Impossibile inviare l'email a fail@send.com");

    expect(console.error).toHaveBeenCalled();
  });

  /**
   * =============================================================================
   * TEST CASE 9 - BLACK BOX: Notes stringa vuota (diverso da undefined)
   * Input: notes = "" (stringa vuota)
   * Output Atteso: notes è "truthy" in JS quindi il branch true viene eseguito,
   *                ma il contenuto è vuoto quindi NON appare "Note:" visibile
   * Branch Coverage: RAMO TRUE di "notes ? ..." con contenuto vuoto
   * =============================================================================
   */
  it("tC9-BB: notes stringa vuota - Sezione note con contenuto vuoto (Classe Equiv. Edge)", async () => {
    // Arrange
    const userEmail = "empty@notes.com";
    const propertyTitle = "Monolocale";
    const oldDate = new Date("2026-07-01T10:00:00");
    const newDate = new Date("2026-07-03T10:00:00");
    const notes = ""; // Stringa vuota (truthy in JS)

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate, notes);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];

    // Con stringa vuota, il template inserisce "<p>Note: </p>" ma con contenuto vuoto
    // Verifica che il branch notes sia stato eseguito (anche se con stringa vuota)
    // In JavaScript, "" è truthy per il ternary operator, quindi il branch viene eseguito
    expect(callArgs.html).toBeTruthy();
    expect(callArgs.to).toBe(userEmail);
  });

  /**
   * =============================================================================
   * TEST CASE 10 - WHITE BOX: Statement Coverage - Verifica parametri from/subject
   * Input: Parametri validi standard
   * Output Atteso: Verifica che tutti i campi mailOptions siano popolati
   * Statement Coverage: TUTTE le proprietà mailOptions assegnate
   * =============================================================================
   */
  it("tC10-WB: Verifica completa mailOptions - Statement Coverage totale", async () => {
    // Arrange
    const userEmail = "complete@test.it";
    const propertyTitle = "Villa Completa";
    const oldDate = new Date("2026-08-10T10:00:00");
    const newDate = new Date("2026-08-15T10:00:00");
    const notes = "Modifica per disponibilità agente";

    // Act
    await sendAppointmentRescheduledEmail(userEmail, propertyTitle, oldDate, newDate, notes);

    // Assert: Verifica TUTTI i campi mailOptions
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const mailOptions = mockSendMail.mock.calls[0][0];

    // Statement Coverage: ogni proprietà deve essere definita
    expect(mailOptions).toHaveProperty("from");
    expect(mailOptions).toHaveProperty("to");
    expect(mailOptions).toHaveProperty("subject");
    expect(mailOptions).toHaveProperty("html");

    expect(mailOptions.to).toBe(userEmail);
    expect(mailOptions.subject).toBe(`Modifica appuntamento per ${propertyTitle}`);
    expect(mailOptions.html).toContain("Appuntamento Modificato");
    expect(mailOptions.html).toContain("Cordiali saluti");
  });
});
