import type { Profile } from "passport-google-oauth20";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";

import { db } from "@/db";
import { roles } from "@/db/schema/user";
import env from "@/env";
import * as userRepository from "@/repository/user.repository";

// Configurazione della LocalStrategy (per login email/password)
passport.use(
  new LocalStrategy({ usernameField: "identifier" }, async (identifier, password, done) => {
    const user = await userRepository.getUserByIdentifier(identifier);

    if (!user?.password) {
      return done(null, false, {
        message: "Email o password non corretti",
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return done(null, false, { message: "Email o password non corretti" });
    }

    return done(null, user);
  }),
);

// Configurazione della JwtStrategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: env.JWT_SECRET_KEY,
};

interface JwtPayload {
  id: number;
  name?: string;
  email?: string;
  role?: string;
}

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload: JwtPayload, done) => {
    try {
      const userId = jwtPayload.id;

      if (!userId) {
        return done(null, false, { message: "Token non valido: ID utente mancante." });
      }

      if (jwtPayload.role) {
        const user = {
          id: jwtPayload.id,
          name: jwtPayload.name,
          email: jwtPayload.email,
          role: jwtPayload.role,
        };
        return done(null, user);
      }

      const userFound = await userRepository.getUserById(userId);

      if (userFound) {
        return done(null, userFound);
      }
      else {
        return done(null, false, { message: "Utente associato al token non trovato." });
      }
    }
    catch (error) {
      return done(error, false);
    }
  }),
);

// Aggiungi la strategia Google
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: (error: Error | null, user?: Express.User | false) => void,
    ) => {
      try {
        // Verifica che profile.emails esista e abbia almeno un elemento
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Email non disponibile dal profilo Google"), undefined);
        }

        // Cerca l'utente nel database
        let user = await userRepository.getUserByIdentifier(email);

        if (!user) {
          // Se l'utente non esiste, crealo
          const [customerRole] = await db.select()
            .from(roles)
            .where(eq(roles.name, "customer"));

          // Crea un nuovo utente
          const newUser = await userRepository.createUser({
            email,
            name: profile.displayName,
            roleId: customerRole.id,
            password: bcrypt.hashSync(randomBytes(16).toString("hex"), 10),
            phone: "",
            googleId: profile.id,
          });

          if (!newUser) {
            return done(new Error("Failed to create user"), undefined);
          }

          user = { ...newUser, password: bcrypt.hashSync(randomBytes(16).toString("hex"), 10) };
        }

        return done(null, user);
      }
      catch (error) {
        done(error as Error);
      }
    },
  ),
);

export { default } from "passport";
