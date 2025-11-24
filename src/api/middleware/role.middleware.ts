import type { NextFunction, Request, Response } from "express";

// Controlla il nome del ruolo (es: "admin", "manager", "agent", "customer")
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Accesso negato" });
      return;
    }
    next();
  };
}