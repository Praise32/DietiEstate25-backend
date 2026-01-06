import type { Response } from "express";

export function sendUnauthorizedResponse(res: Response, message: string = "Utente non autenticato"): void {
  res.status(401).json({ message });
}

export function sendNotFoundResponse(res: Response, message: string = "Risorsa non trovata"): void {
  res.status(404).json({ message });
}

export function sendForbiddenResponse(res: Response, message: string = "Operazione non autorizzata"): void {
  res.status(403).json({ message });
}

export function sendBadRequestResponse(res: Response, message: string | object): void {
  res.status(400).json(typeof message === "string" ? { message } : message);
}

export function sendInternalErrorResponse(res: Response, message: string = "Errore interno del server"): void {
  res.status(500).json({ message });
}
