import type { Response } from "express";

/**
 * Invia una risposta HTTP 401 (Unauthorized) standardizzata.
 *
 * @param res - L'oggetto Response di Express
 * @param message - Messaggio di errore personalizzato (default: "Utente non autenticato")
 */
export function sendUnauthorizedResponse(res: Response, message: string = "Utente non autenticato"): void {
  res.status(401).json({ message });
}

/**
 * Invia una risposta HTTP 404 (Not Found) standardizzata.
 *
 * @param res - L'oggetto Response di Express
 * @param message - Messaggio di errore personalizzato (default: "Risorsa non trovata")
 */
export function sendNotFoundResponse(res: Response, message: string = "Risorsa non trovata"): void {
  res.status(404).json({ message });
}

/**
 * Invia una risposta HTTP 403 (Forbidden) standardizzata per negare l'accesso a risorse protette.
 *
 * @param res - L'oggetto Response di Express
 * @param message - Messaggio di errore personalizzato (default: "Operazione non autorizzata")
 */
export function sendForbiddenResponse(res: Response, message: string = "Operazione non autorizzata"): void {
  res.status(403).json({ message });
}

/**
 * Invia una risposta HTTP 400 (Bad Request) per validazioni fallite o parametri non validi.
 *
 * @param res - L'oggetto Response di Express
 * @param message - Stringa di errore o oggetto complesso (es. errori di validazione Zod)
 */
export function sendBadRequestResponse(res: Response, message: string | object): void {
  res.status(400).json(typeof message === "string" ? { message } : message);
}

/**
 * Invia una risposta HTTP 500 (Internal Server Error) per errori imprevisti lato server.
 *
 * @param res - L'oggetto Response di Express
 * @param message - Messaggio di errore generico (default: "Errore interno del server")
 */
export function sendInternalErrorResponse(res: Response, message: string = "Errore interno del server"): void {
  res.status(500).json({ message });
}
