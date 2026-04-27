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
  completeGoogleSignup  // Make sure this is imported
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
router.post('/google', googleAuth);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/logout', authenticateToken, logout);
router.post('/complete-google-signup', authenticateToken, completeGoogleSignup);

export default router;