import bcrypt from "bcryptjs"; // Per confrontare le password
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
// config/passport.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt"; // Importa JwtStrategy e ExtractJwt
import { Strategy as LocalStrategy } from "passport-local"; // Importa LocalStrategy

import { db } from "@/db";
import { roles } from "@/db/schema/user";
import env from "@/env";
import * as userRepository from "@/repository/user.repository";

// Aggiungi la strategia Google
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Cerca l'utente nel database
        let user = await userRepository.getUserByIdentifier(profile.emails![0].value);

        if (!user) {
          // Se l'utente non esiste, crealo
          const [customerRole] = await db.select()
            .from(roles)
            .where(eq(roles.name, "customer"));

          // Crea un nuovo utente
          const newUser = await userRepository.createUser({
            email: profile.emails![0].value,
            name: profile.displayName,
            roleId: customerRole.id,
            // Genera una password casuale sicura per gli account Google
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
        return done(error as Error, undefined);
      }
    },
  ),
);

// Configurazione della LocalStrategy (per login email/password)
passport.use(
  new LocalStrategy(
    {
      usernameField: "identifier",
      passwordField: "password", // NOSONAR: Questo è il nome del campo, non una password reale
      session: false, // Disabilita la sessione per l'autenticazione locale
    },
    async (identifier, password, done) => {
      try {
        // Qui usiamo userRepository.getUserByEmail, assumendo che esista una funzione simile
        // o adatta loginRepository.getuser per cercare solo per email
        const userFound = await userRepository.getUserByIdentifier(identifier); // Modifica se necessario

        if (!userFound) {
          return done(null, false, { message: "credenziali non valide" });
        }

        const passwordIsValid = bcrypt.compareSync(
          password,
          userFound.password,
        );

        if (!passwordIsValid) {
          return done(null, false, { message: "credenziali non valide " });
        }

        return done(null, userFound); // Utente autenticato con successo
      }
      catch (error) {
        return done(error);
      }
    },
  ),
);

// Configurazione della JwtStrategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Estrae il token dall'header "Authorization: Bearer TOKEN"
  secretOrKey: env.JWT_SECRET_KEY, // La stessa chiave segreta che usi per firmare i token
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwt_payload: any, done) => {
    try {
      // jwt_payload è l'oggetto decodificato dal token JWT
      // Dovrebbe contenere l'ID dell'utente (o qualsiasi cosa tu abbia messo nel payload durante la firma del token)
      const userId = jwt_payload.id;

      if (!userId) {
        // Se l'ID non è nel payload, il token non è valido per il nostro scopo
        return done(null, false, { message: "Token non valido: ID utente mancante." });
      }

      if (jwt_payload.role) {
        const user = {
          id: jwt_payload.id,
          name: jwt_payload.name,
          email: jwt_payload.email,
          role: jwt_payload.role,
        };
        return done(null, user);
      }

      const userFound = await userRepository.getUserById(userId);

      if (userFound) {
        // Utente trovato, autenticazione riuscita. Passport popolerà req.user con userFound.
        return done(null, userFound);
      }
      else {
        // Utente non trovato nel database
        return done(null, false, { message: "Utente associato al token non trovato." });
      }
    }
    catch (error) {
      return done(error, false);
    }
  }),
);

export { default } from "passport";
