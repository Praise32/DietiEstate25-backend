import cors from "cors";
import express from "express";
import adminUsersRouter from "./api/routes/admin.router.js";
import agenciesRouter from "./api/routes/agencies.router.js";
import appointmentsRouter from "./api/routes/appointments.router.js";
import inviteRouter from "./api/routes/invites.router.js";
import loginRouter from "./api/routes/login.router.js";
import postsRouter from "./api/routes/posts.router.js";
import { seedAdmin, seedRoles } from "./db/seed.js";
import env from "./env.js";
import passport from "./utils/passport.js";
const app = express();
app.disable("x-powered-by");
const corsOptions = {
    origin: [
        "http://localhost:4200",
        "https://accounts.google.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());
await seedRoles();
await seedAdmin();
app.use("/posts", postsRouter);
app.use("/login", loginRouter);
app.use("/admin", adminUsersRouter);
app.use("/invite", inviteRouter);
app.use("/appointments", appointmentsRouter);
app.use("/agencies", agenciesRouter);
app.listen(env.PORT, () => {
    console.log("Server is running on port 5003");
});
