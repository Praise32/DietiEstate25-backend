import nodemailer from 'nodemailer';
import env from '@/env';

// Configura il transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD, // Password specifica per le app
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendInviteEmail(email: string, token: string) {
  const registrationLink = `${env.FRONTEND_URL}/register/invite/${token}`;

  const mailOptions = {
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Invito a DietiEstates25',
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
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email di invito inviata con successo');
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    throw new Error('Impossibile inviare l\'email di invito');
  }
}