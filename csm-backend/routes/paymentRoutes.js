// csms-backend/routes/paymentRoutes.js
import express from 'express';
import {
  createCheckoutSession,
  confirmCheckoutSession,
  activateFromSession,  // Make sure this is imported
  activateFreeTrial,
  handleStripeWebhook
} from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Webhook endpoint (keep for future use)
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes
router.use(authenticateToken);

router.post('/create-checkout-session', createCheckoutSession);
router.post('/confirm-checkout-session', confirmCheckoutSession);
router.post('/activate-from-session', activateFromSession);  // This route must exist
router.post('/activate-free-trial', activateFreeTrial);

export default router;