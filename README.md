# DietiEstate25 - Backend

Backend per la piattaforma immobiliare "DietiEstate", sviluppato per il progetto DietiEstate25.
Questa applicazione fornisce API RESTful robuste per la gestione di annunci immobiliari, agenzie, utenti e funzionalità geospaziali avanzate.

## 🚀 Tecnologie Utilizzate

- **Runtime:** Node.js
- **Linguaggio:** TypeScript
- **Framework Web:** Express.js
- **Database:** PostgreSQL (NeonDB) con estensione **PostGIS** per le query geospaziali
- **ORM:** Drizzle ORM
- **Autenticazione:** Passport.js (JWT, Google OAuth 2.0, Local Strategy)
- **Storage File:** AWS S3 (tramite Multer S3) per il caricamento delle foto
- **Validazione:** Zod & Express-Zod-Safe
- **Servizi Esterni:**
  - OpenMeteo (Previsioni meteo localizzate)
  - Google OAuth (Social Login)

## ✨ Funzionalità Principali

- **Autenticazione & Utenti:**
  - Registrazione e Login (Email/Password)
  - Login tramite Google
  - Gestione Ruoli (Admin, Manager, Agent, Customer)
  - Protezione rotte tramite JWT Bearer Token
  
- **Gestione Immobili (Posts):**
  - CRUD completo degli annunci immobiliari
  - **Geolocalizzazione:** Salvataggio coordinate e ricerca immobili per raggio (km) tramite PostGIS
  - Filtri avanzati (prezzo, stanze, mq, classe energetica, ecc.)
  - Upload multiplo di immagini su AWS S3
  
- **Agenzie:**
  - Gestione profili agenzie
  - Associazione Manager e Agenti
  
- **Utility:**
  - Servizio Meteo integrato per visualizzare le previsioni nella zona dell'immobile
  - Sistema di inviti via email per nuovi membri dello staff

## 🛠️ Come Avviare il Progetto in Locale

### Prerequisiti

- **Node.js** (v18 o superiore)
- **PostgreSQL** con supporto PostGIS
- **Account AWS** (per S3 bucket)
- **Account Google Cloud** (per OAuth credentials)

### Passaggi per l'installazione

1. **Clona il repository:**
   ```bash
   git clone <url-repository>
   cd DietiDeals24-backend
   ```

2. **Installa le dipendenze:**
   ```bash
   npm i
   ```

3. **Configura le variabili d'ambiente:**
   
   Crea un file `.env` nella root del progetto basandoti su `.env.example`:
   ```env
   PORT=5003
   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   JWT_SECRET_KEY="tua_chiave_segreta"
   FRONTEND_URL="http://localhost:4200"

   # AWS S3
   AWS_ACCESS_KEY_ID="tua_aws_key"
   AWS_SECRET_ACCESS_KEY="tua_aws_secret"
   AWS_REGION="eu-north-1"
   S3_BUCKET_NAME="DietiEstates25-bucket"

   # Google OAuth
   GOOGLE_CLIENT_ID="tuo_google_client_id"
   GOOGLE_CLIENT_SECRET="tuo_google_secret"
   GOOGLE_CALLBACK_URL="http://localhost:5003/login/google/callback"

   # Email
   GMAIL_USER="tua@email.com"
   GMAIL_APP_PASSWORD="tua_app_password"
   ```

4. **Esegui le migrazioni del database:**
   ```bash
   npx drizzle-kit push
   ```

5. **Avvia il server in modalità sviluppo:**
   ```bash
   npm run dev
   ```

Il server sarà disponibile su `http://localhost:5003` (o sulla porta specificata nel file `.env`).

## 📜 Script Disponibili

- `npm run dev` - Avvia il server in modalità sviluppo (hot-reload)
- `npm run build` - Compila il progetto TypeScript in JavaScript nella cartella `dist`
- `npm start` - Avvia il server di produzione (richiede build)
- `npm run lint` - Esegue il controllo del codice con ESLint
- `npm run format` - Formatta il codice con Prettier
- `npm test` - Esegue i test con Jest
- `npm run test:coverage` - Esegue i test con coverage

## 📂 Struttura del Progetto

```
src/
├── api/              # Router, Controller e Middleware Express
│   ├── middleware/   # Middleware di autenticazione, autorizzazione, ecc.
│   └── routes/       # Definizione delle route API
├── db/               # Schema Drizzle, Migrazioni e connessione DB
│   ├── migrations/   # File di migrazione del database
│   └── schema/       # Definizione dello schema del database
├── repository/       # Logica di accesso ai dati (Query)
├── utils/            # Servizi ausiliari (Passport, WeatherService, ecc.)
└── env.ts           # Validazione centralizzata delle variabili d'ambiente
```

## 📄 Licenza

Distribuito sotto licenza MIT. Vedi il file `LICENSE` per maggiori informazioni.
