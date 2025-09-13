import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import * as inviteRepository from '@/repository/invites.repository';
import jwt from 'jsonwebtoken';
import env from '@/env';
import { inviteSchema } from '@/db/schema/invites';
import validate from 'express-zod-safe';
import * as userRepository from '@/repository/user.repository';
import bcrypt from 'bcryptjs';


const router = express.Router();

// Route per creare un invito
router.post(
  '/create',
  authMiddleware,
  requireRole('agent', 'support', 'manager'),
  validate({ body: inviteSchema }),
  async (req , res) => {
    const { email, role } = req.body;
    
    // Verifica permessi basati sul ruolo
    if (
      (req.user?.role === 'manager' && role !== 'agent') ||
      (req.user?.role === 'agent' && !['support', 'manager'].includes(role))
    ) {
      return res.status(403).json({ message: 'Non autorizzato a creare questo tipo di account' });
    }

    const token = jwt.sign(
      { email, role },
      env.JWT_SECRET_KEY,
      { expiresIn: '24h' }
    );

    await inviteRepository.createInvite({
      email,
      role,
      token,
      invitedBy: req.user!.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Per test senza frontend, restituiamo il token direttamente
    res.json({ 
      message: 'Invito creato con successo',
      registrationLink: `http://localhost:5003/invite/register/${token}`
    });
  }
);

// Route per la registrazione tramite invito
router.post('/register/:token', async (req, res) => {
  const { token } = req.params;
  const { password, name, phone } = req.body;

  const invite = await inviteRepository.getInviteByToken(token);
  
  if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
    return res.status(400).json({ message: 'Invito non valido o scaduto' });
  }

  // Crea nuovo utente
  const user = await userRepository.createUser({
    email: invite.email,
    password: bcrypt.hashSync(password, 10),
    name,
    phone,
    roleId: await getRoleId(invite.role),
  });

  await inviteRepository.markInviteAsUsed(token);

  // Genera JWT per il nuovo utente
  const authToken = jwt.sign(
    { id: user?.id, name: user?.name, email: user?.email },
    env.JWT_SECRET_KEY,
    { expiresIn: '24h' }
  );

  res.json({ 
    message: 'Registrazione completata con successo',
    token: authToken 
  });
});

export default router;

function getRoleId(role: string): number | PromiseLike<number> {
    throw new Error('Function not implemented.');
}
