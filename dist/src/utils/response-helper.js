export function sendUnauthorizedResponse(res, message = "Utente non autenticato") {
    res.status(401).json({ message });
}
export function sendNotFoundResponse(res, message = "Risorsa non trovata") {
    res.status(404).json({ message });
}
export function sendForbiddenResponse(res, message = "Operazione non autorizzata") {
    res.status(403).json({ message });
}
export function sendBadRequestResponse(res, message) {
    res.status(400).json(typeof message === "string" ? { message } : message);
}
export function sendInternalErrorResponse(res, message = "Errore interno del server") {
    res.status(500).json({ message });
}
