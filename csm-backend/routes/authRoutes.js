// csms-backend/routes/authRoutes.js
import express from 'express';
import {
  register,
  verifyEmail,
  resendCode,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  logout,
  googleAuth,
  googleSignup,
  verifyGoogleUser,
  googleConnect,
  googleDisconnect,
  getGoogleStatus,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google routes
router.post('/google', googleAuth);
router.post('/google/signup', googleSignup);
router.post('/google/verify', verifyGoogleUser);

// Protected Google routes (require authentication)
router.post('/google-connect', authenticateToken, googleConnect);
router.post('/google-disconnect', authenticateToken, googleDisconnect);
router.get('/google-status', authenticateToken, getGoogleStatus);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/logout', authenticateToken, logout);

export default router;