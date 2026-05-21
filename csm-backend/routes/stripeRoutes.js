// csms-backend/routes/stripeRoutes.js
import express from 'express';
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getInvoices,
  getUpcomingInvoice,
  requestRefund,
  createOrUpdateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getBillingInfo
} from '../controllers/billingController.js';
import {
  createHardwarePaymentIntent,
  createHardwareOrder,
  getOrganizationOrders,
  getOrderStatus,
  cancelOrder
} from '../controllers/hardwareController.js';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';

const router = express.Router();

// ============ BILLING & SUBSCRIPTION ROUTES ============
router.get('/billing/:orgId', authenticateToken, getBillingInfo);
router.post('/billing/:orgId/subscription', authenticateToken, createOrUpdateSubscription);
router.delete('/billing/:orgId/subscription', authenticateToken, cancelSubscription);
router.post('/billing/:orgId/subscription/reactivate', authenticateToken, reactivateSubscription);

// ============ PAYMENT INTENT ROUTES ============
router.post('/create-payment-intent', authenticateToken, createPaymentIntent);
router.post('/confirm-payment', authenticateToken, confirmPayment);
router.post('/hardware-payment-intent', authenticateToken, requireOrganization, createHardwarePaymentIntent);
router.post('/hardware-order', authenticateToken, requireOrganization, createHardwareOrder);

// ============ HARDWARE ORDER ROUTES ============
router.get('/hardware-orders', authenticateToken, requireOrganization, getOrganizationOrders);
router.get('/hardware-orders/:orderId', authenticateToken, requireOrganization, getOrderStatus);
router.put('/hardware-orders/:orderId/cancel', authenticateToken, requireOrganization, cancelOrder);

// ============ PAYMENT METHOD ROUTES ============
router.get('/payment-methods/:orgId', authenticateToken, getPaymentMethods);
router.post('/payment-methods/:orgId', authenticateToken, addPaymentMethod);
router.delete('/payment-methods/:payment_method_id', authenticateToken, deletePaymentMethod);
router.put('/payment-methods/:orgId/default', authenticateToken, setDefaultPaymentMethod);

// ============ INVOICE ROUTES ============
router.get('/invoices/:orgId', authenticateToken, getInvoices);
router.get('/invoices/:orgId/upcoming', authenticateToken, getUpcomingInvoice);

// ============ REFUND ROUTES ============
router.post('/refund', authenticateToken, requestRefund);

export default router;