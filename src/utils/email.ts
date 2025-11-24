import nodemailer from "nodemailer";

import env from "@/env";

// Configura il transporter
// Configura il transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Host esplicito di Gmail
  port: 465,              // Porta standard per SSL
  secure: true,           // Usa SSL/TLS esplicito (Risolve S5332)
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD, // Password specifica per le app
  },
});

export async function sendInviteEmail(email: string, token: string) {
  const registrationLink = `${env.FRONTEND_URL}/register/invite/${token}`;

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: email,
    subject: "Invito a DietiEstates25",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Benvenuto in DietiEstates25</h1>
        <p>Sei stato invitato a unirti al nostro team di professionisti immobiliari.</p>
        <p>Per completare la registrazione, clicca sul link seguente:</p>
        <div style="margin: 20px 0;">
          <a href="${registrationLink}" 
             style="background-color: #3498db; 
                    color: white; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px;">
            Completa la Registrazione
          </a>
        </div>
        <p style="color: #e74c3c;">Attenzione: questo link scadrà tra 24 ore.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">
          Se non hai richiesto questo invito, puoi ignorare questa email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email di invito inviata con successo");
  }
  catch (error) {
    console.error("Errore nell'invio dell'email:", error);
    throw new Error("Impossibile inviare l'email di invito");
  }
}


/**
 * Invia email di notifica all'agente quando viene richiesta una visita
 */
export async function sendAppointmentNotificationEmail(
  agentEmail: string | undefined,
  userName: string,
  propertyTitle: string,
  appointmentDate: Date,
  appointmentId: number
): Promise<void> {
  if (!agentEmail) return;
  
  const formattedDate = appointmentDate.toLocaleString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = `Nuova richiesta di visita per ${propertyTitle}`;
  const html = `
    <h1>Nuova richiesta di visita</h1>
    <p>Ciao,</p>
    <p>Il cliente <strong>${userName}</strong> ha richiesto una visita per l'immobile "<strong>${propertyTitle}</strong>".</p>
    <p>Data e ora richieste: <strong>${formattedDate}</strong></p>
    <p>Per confermare o rifiutare questa richiesta, accedi al tuo pannello di controllo.</p>
    <p>Cordiali saluti,<br>Team DietiDeals24</p>
  `;

  await sendEmail(agentEmail, subject, html);
}

/**
 * Invia email di conferma al cliente quando la visita viene confermata
 */
export async function sendAppointmentConfirmationEmail(
  userEmail: string | undefined,
  propertyTitle: string,
  appointmentDate: Date,
  notes: string
): Promise<void> {
  if (!userEmail) return;

  const formattedDate = appointmentDate.toLocaleString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = `Visita confermata per ${propertyTitle}`;
  const html = `
    <h1>Visita confermata</h1>
    <p>Gentile cliente,</p>
    <p>Siamo lieti di confermare la tua visita per l'immobile "<strong>${propertyTitle}</strong>".</p>
    <p>Data e ora: <strong>${formattedDate}</strong></p>
    ${notes ? `<p>Note aggiuntive: ${notes}</p>` : ''}
    <p>Ti aspettiamo!</p>
    <p>Cordiali saluti,<br>Team DietiDeals24</p>
  `;

  await sendEmail(userEmail, subject, html);
}

/**
 * Invia email di rifiuto al cliente quando la visita viene rifiutata
 */
export async function sendAppointmentRejectionEmail(
  userEmail: string | undefined,
  propertyTitle: string,
  appointmentDate: Date,
  notes: string
): Promise<void> {
  if (!userEmail) return;

  const formattedDate = appointmentDate.toLocaleString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = `Visita non disponibile per ${propertyTitle}`;
  const html = `
    <h1>Visita non disponibile</h1>
    <p>Gentile cliente,</p>
    <p>Ci dispiace informarti che la tua richiesta di visita per l'immobile "<strong>${propertyTitle}</strong>" 
       prevista per <strong>${formattedDate}</strong> non può essere confermata.</p>
    ${notes ? `<p>Motivazione: ${notes}</p>` : ''}
    <p>Ti invitiamo a selezionare una nuova data e ora per la tua visita.</p>
    <p>Cordiali saluti,<br>Team DietiDeals24</p>
  `;

  await sendEmail(userEmail, subject, html);
}

async function sendEmail(userEmail: string, subject: string, html: string): Promise<void> {
  const mailOptions = {
    from: env.EMAIL_FROM,
    to: userEmail,
    subject: subject,
    html: html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email inviata con successo a ${userEmail}`);
  }
  catch (error) {
    console.error("Errore nell'invio dell'email:", error);
    throw new Error(`Impossibile inviare l'email a ${userEmail}`);
  }
}

