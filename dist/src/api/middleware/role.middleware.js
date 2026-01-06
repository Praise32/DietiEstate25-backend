export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user?.role || !roles.includes(req.user.role)) {
            res.status(403).json({ message: "Accesso negato" });
            return;
        }
        next();
    };
}
