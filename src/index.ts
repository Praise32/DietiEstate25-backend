import cors from "cors";
import express from "express";

import commentsRouter from "@/api/routes/comments.router";
import loginRouter from "@/api/routes/login.router";
import postsRouter from "@/api/routes/posts.router";
import adminUsersRouter from "@/api/routes/admin.router";
import inviteRouter from "@/api/routes/invites.router";
import env from "@/env";
import passport from "@/utils/passport";
import { seedRoles , seedAdmin } from "@/db/seed";
const app = express();

const corsOptions = {
  origin: [
    "http://localhost:4200",
    "https://accounts.google.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions)); // Applica il middleware CORS

app.use(express.json());
app.use(passport.initialize());

await seedRoles();
await seedAdmin();

app.use("/posts", postsRouter);
app.use("/login", loginRouter);
app.use("/comments", commentsRouter);
app.use("/admin", adminUsersRouter);
app.use("/invite", inviteRouter);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log("Server is running on port 5003");
});
