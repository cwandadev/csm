// csms-backend/controllers/billingController.js
import pool from '../config/database.js';
import stripeService from '../services/stripeService.js';

// Get billing info with Stripe details
export const getBillingInfo = async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [orgs] = await pool.execute(
      `SELECT o.*, 
              s.id as subscription_id, s.plan_id, s.status as subscription_status, 
              s.end_date as subscription_expires_at, s.billing_cycle, s.auto_renew,
              sp.name as plan_name, sp.display_name as plan_display_name, 
              sp.max_users, sp.max_devices, sp.max_admins
       FROM organizations o
       LEFT JOIN subscriptions s ON o.id = s.organization_id AND s.status IN ('active', 'trial')
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE o.id = ?`,
      [orgId]
    );
    
    if (orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const org = orgs[0];
    
    // Get Stripe payment methods if customer exists
    let paymentMethods = [];
    if (org.stripe_customer_id) {
      try {
        paymentMethods = await stripeService.getPaymentMethods(org.stripe_customer_id);
      } catch (error) {
        console.error('Error fetching payment methods:', error);
      }
    }
    
    // Get recent invoices
    let invoices = [];
    if (org.stripe_customer_id) {
      try {
        invoices = await stripeService.getInvoices(org.stripe_customer_id, 10);
      } catch (error) {
        console.error('Error fetching invoices:', error);
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        ...org,
        payment_methods: paymentMethods,
        invoices: invoices
      }
    });
  } catch (error) {
    console.error('Get billing info error:', error);
    res.status(500).json({ success: false, error: 'Failed to get billing information' });
  }
};

// Create payment intent (general)
export const createPaymentIntent = async (req, res) => {
  const { amount, currency = 'usd', metadata = {} } = req.body;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id, contact_email, org_name FROM organizations WHERE id = ?',
      [req.organizationId]
    );
    
    let customerId = orgs[0]?.stripe_customer_id;
    if (!customerId && orgs[0]?.contact_email) {
      customerId = await stripeService.getOrCreateCustomer(
        req.organizationId,
        orgs[0].contact_email,
        orgs[0].org_name
      );
    }
    
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      currency,
      {
        organization_id: req.organizationId,
        ...metadata,
        type: 'general'
      }
    );
    
    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create/Update subscription with Stripe
export const createOrUpdateSubscription = async (req, res) => {
  const { orgId } = req.params;
  const { 
    plan_name, 
    billing_cycle, 
    auto_renew = true,
    payment_method_id,
    extra_devices = 0
  } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get organization details
    const [orgs] = await connection.execute(
      'SELECT * FROM organizations WHERE id = ?',
      [orgId]
    );
    
    if (orgs.length === 0) {
      throw new Error('Organization not found');
    }
    
    const org = orgs[0];
    
    // Get or create Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      customerId = await stripeService.getOrCreateCustomer(
        orgId, 
        org.contact_email, 
        org.org_name
      );
    }
    
    // Attach payment method if provided
    if (payment_method_id) {
      await stripeService.attachPaymentMethod(payment_method_id, customerId);
    }
    
    // Get plan ID from database
    const [plans] = await connection.execute(
      'SELECT id FROM subscription_plans WHERE name = ? AND is_active = 1',
      [plan_name]
    );
    
    if (plans.length === 0) {
      throw new Error('Invalid plan');
    }
    
    const planId = plans[0].id;
    let subscription;
    let stripeSubscriptionId = org.stripe_subscription_id;
    
    // Calculate expiration date
    let expiresAt = new Date();
    if (billing_cycle === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    
    if (stripeSubscriptionId) {
      // Update existing subscription
      subscription = await stripeService.updateSubscription(
        orgId, 
        plan_name, 
        billing_cycle, 
        extra_devices
      );
    } else {
      // Create new subscription
      subscription = await stripeService.createSubscription(
        orgId, 
        plan_name, 
        billing_cycle, 
        auto_renew, 
        extra_devices
      );
      stripeSubscriptionId = subscription.id;
    }
    
    // Update or insert subscription in database
    const [existingSub] = await connection.execute(
      'SELECT id FROM subscriptions WHERE organization_id = ? AND status IN ("active", "trial")',
      [orgId]
    );
    
    if (existingSub.length > 0) {
      await connection.execute(
        `UPDATE subscriptions 
         SET plan_id = ?, billing_cycle = ?, status = 'active', 
             end_date = ?, auto_renew = ?, stripe_subscription_id = ?,
             updated_at = NOW()
         WHERE organization_id = ? AND status IN ('active', 'trial')`,
        [planId, billing_cycle, expiresAt, auto_renew, stripeSubscriptionId, orgId]
      );
    } else {
      await connection.execute(
        `INSERT INTO subscriptions (
          organization_id, plan_id, billing_cycle, status, amount_paid,
          currency, start_date, end_date, auto_renew, stripe_subscription_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'active', 0, 'USD', NOW(), ?, ?, ?, NOW(), NOW())`,
        [orgId, planId, billing_cycle, expiresAt, auto_renew, stripeSubscriptionId]
      );
    }
    
    // Update organization
    await connection.execute(
      `UPDATE organizations 
       SET subscription_status = 'active', 
           subscription_expires_at = ?,
           stripe_subscription_id = ?,
           extra_devices_count = ?,
           extra_devices_monthly_fee = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [expiresAt, stripeSubscriptionId, extra_devices, extra_devices * 20, orgId]
    );
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      data: {
        subscription_id: stripeSubscriptionId,
        client_secret: subscription?.latest_invoice?.payment_intent?.client_secret,
        status: 'active',
        expires_at: expiresAt
      },
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create/Update subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  const { orgId } = req.params;
  const { cancel_immediately = false } = req.body;
  
  try {
    const result = await stripeService.cancelSubscription(orgId, cancel_immediately);
    
    // Update database
    if (cancel_immediately) {
      await pool.execute(
        'UPDATE organizations SET subscription_status = "inactive", updated_at = NOW() WHERE id = ?',
        [orgId]
      );
      
      await pool.execute(
        'UPDATE subscriptions SET status = "canceled", canceled_at = NOW() WHERE organization_id = ? AND status = "active"',
        [orgId]
      );
    } else {
      await pool.execute(
        'UPDATE organizations SET auto_renew = 0 WHERE id = ?',
        [orgId]
      );
      
      await pool.execute(
        'UPDATE subscriptions SET auto_renew = 0 WHERE organization_id = ? AND status = "active"',
        [orgId]
      );
    }
    
    res.json({ 
      success: true, 
      message: cancel_immediately ? 'Subscription cancelled immediately' : 'Subscription will cancel at period end'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reactivate subscription
export const reactivateSubscription = async (req, res) => {
  const { orgId } = req.params;
  
  try {
    await stripeService.reactivateSubscription(orgId);
    
    await pool.execute(
      'UPDATE organizations SET auto_renew = 1 WHERE id = ?',
      [orgId]
    );
    
    await pool.execute(
      'UPDATE subscriptions SET auto_renew = 1 WHERE organization_id = ? AND status = "active"',
      [orgId]
    );
    
    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Confirm payment
export const confirmPayment = async (req, res) => {
  const { payment_intent_id } = req.body;
  
  try {
    const paymentIntent = await stripeService.confirmPaymentIntent(payment_intent_id);
    
    // Update payment status
    await pool.execute(
      `UPDATE payments 
       SET status = ?, paid_at = NOW() 
       WHERE payment_intent_id = ?`,
      [paymentIntent.status === 'succeeded' ? 'success' : 'failed', payment_intent_id]
    );
    
    res.json({
      success: paymentIntent.status === 'succeeded',
      data: paymentIntent
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Request refund
export const requestRefund = async (req, res) => {
  const { payment_id, amount, reason } = req.body;
  
  try {
    // Get payment details
    const [payments] = await pool.execute(
      'SELECT payment_intent_id, amount FROM payments WHERE id = ? AND organization_id = ?',
      [payment_id, req.organizationId]
    );
    
    if (payments.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    const refund = await stripeService.createRefund(
      payments[0].payment_intent_id,
      amount,
      reason || 'requested_by_customer'
    );
    
    // Update payment record
    await pool.execute(
      `UPDATE payments 
       SET status = 'refunded', refund_id = ? 
       WHERE id = ?`,
      [refund.id, payment_id]
    );
    
    res.json({ success: true, data: refund });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get payment methods
export const getPaymentMethods = async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id FROM organizations WHERE id = ?',
      [orgId]
    );
    
    if (!orgs[0]?.stripe_customer_id) {
      return res.json({ success: true, data: [] });
    }
    
    const methods = await stripeService.getPaymentMethods(orgs[0].stripe_customer_id);
    
    res.json({ success: true, data: methods });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add payment method
export const addPaymentMethod = async (req, res) => {
  const { orgId } = req.params;
  const { payment_method_id } = req.body;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id, contact_email, org_name FROM organizations WHERE id = ?',
      [orgId]
    );
    
    let customerId = orgs[0]?.stripe_customer_id;
    if (!customerId) {
      customerId = await stripeService.getOrCreateCustomer(
        orgId,
        orgs[0]?.contact_email || 'customer@example.com',
        orgs[0]?.org_name || 'Organization'
      );
    }
    
    const paymentMethod = await stripeService.attachPaymentMethod(payment_method_id, customerId);
    
    // Save to payment_methods table
    await pool.execute(
      `INSERT INTO payment_methods (
        organization_id, admin_id, payment_gateway, gateway_customer_id,
        payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year,
        is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        orgId, req.adminId, customerId, paymentMethod.id,
        paymentMethod.card?.brand || 'Unknown', 
        paymentMethod.card?.last4 || '****',
        paymentMethod.card?.exp_month || 0,
        paymentMethod.card?.exp_year || 0,
        orgs[0]?.stripe_customer_id ? 0 : 1
      ]
    );
    
    res.json({ success: true, data: paymentMethod });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete payment method
export const deletePaymentMethod = async (req, res) => {
  const { payment_method_id } = req.params;
  
  try {
    await stripeService.detachPaymentMethod(payment_method_id);
    
    await pool.execute(
      'DELETE FROM payment_methods WHERE payment_method_id = ?',
      [payment_method_id]
    );
    
    res.json({ success: true, message: 'Payment method removed' });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Set default payment method
export const setDefaultPaymentMethod = async (req, res) => {
  const { orgId } = req.params;
  const { payment_method_id } = req.body;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id FROM organizations WHERE id = ?',
      [orgId]
    );
    
    if (!orgs[0]?.stripe_customer_id) {
      return res.status(404).json({ success: false, error: 'No customer found' });
    }
    
    await stripeService.setDefaultPaymentMethod(orgs[0].stripe_customer_id, payment_method_id);
    
    await pool.execute(
      'UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?',
      [orgId]
    );
    
    await pool.execute(
      'UPDATE payment_methods SET is_default = 1 WHERE payment_method_id = ?',
      [payment_method_id]
    );
    
    res.json({ success: true, message: 'Default payment method updated' });
  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get invoice history
export const getInvoices = async (req, res) => {
  const { orgId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id FROM organizations WHERE id = ?',
      [orgId]
    );
    
    if (!orgs[0]?.stripe_customer_id) {
      return res.json({ success: true, data: [] });
    }
    
    const invoices = await stripeService.getInvoices(orgs[0].stripe_customer_id, parseInt(limit));
    
    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get upcoming invoice
export const getUpcomingInvoice = async (req, res) => {
  const { orgId } = req.params;
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id, stripe_subscription_id FROM organizations WHERE id = ?',
      [orgId]
    );
    
    if (!orgs[0]?.stripe_customer_id) {
      return res.json({ success: true, data: null });
    }
    
    const invoice = await stripeService.getUpcomingInvoice(
      orgs[0].stripe_customer_id,
      orgs[0].stripe_subscription_id
    );
    
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get upcoming invoice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};