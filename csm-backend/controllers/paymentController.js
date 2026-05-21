// csms-backend/controllers/paymentController.js
import pool from '../config/database.js';
import stripe from '../config/stripe.js';
import crypto from 'crypto';

const PLAN_LIMITS = {
  free: { max_users: 200, max_devices: 1, max_admins: 1 },
  basic: { max_users: 1000, max_devices: 2, max_admins: 2 },
  professional: { max_users: 2000, max_devices: 5, max_admins: 3 },
  enterprise: { max_users: null, max_devices: 15, max_admins: 5 }
};

function generateInvoiceNumber() {
  return `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ============================================
// FIXED: Get or create Stripe customer - ONLY store the ID string
// ============================================
async function getOrCreateStripeCustomer(organizationId, adminData) {
  // Get existing customer ID from database
  const [orgRows] = await pool.execute(
    'SELECT stripe_customer_id FROM organizations WHERE id = ?',
    [organizationId]
  );
  
  const existingCustomerId = orgRows[0]?.stripe_customer_id;
  
  // If we have a valid customer ID (starts with cus_), try to use it
  if (existingCustomerId && typeof existingCustomerId === 'string' && existingCustomerId.startsWith('cus_')) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (customer && !customer.deleted) {
        console.log('[Customer] Using existing Stripe customer:', existingCustomerId);
        return existingCustomerId;
      }
    } catch (err) {
      console.log('[Customer] Existing customer not found in Stripe, creating new one');
    }
  } else if (existingCustomerId && existingCustomerId !== '[object Object]') {
    console.log('[Customer] Invalid customer ID in database:', existingCustomerId);
  }
  
  // Create new Stripe customer
  console.log('[Customer] Creating new Stripe customer for org:', organizationId);
  
  const customer = await stripe.customers.create({
    email: adminData.email,
    name: `${adminData.firstName} ${adminData.lastName}`.trim(),
    metadata: {
      organization_id: organizationId.toString(),
      organization_name: adminData.organizationName || '',
      admin_id: adminData.id.toString()
    }
  });
  
  // IMPORTANT: Store ONLY the customer.id string, NOT the whole customer object
  const customerId = customer.id;
  console.log('[Customer] Created new Stripe customer with ID:', customerId);
  
  await pool.execute(
    'UPDATE organizations SET stripe_customer_id = ? WHERE id = ?',
    [customerId, organizationId]
  );
  
  return customerId;
}

// ============================================
// 1. CREATE CHECKOUT SESSION
// ============================================

export const createCheckoutSession = async (req, res) => {
  try {
    const {
      priceId,
      planName,
      billingCycle,
      organizationType,
      deviceId,
      includeTax,
      taxRate,
    } = req.body;
    
    const adminId = req.adminId;
    const organizationId = req.organizationId;
    
    if (!priceId || !planName || !billingCycle) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields" 
      });
    }
    
    // Get admin data
    const [adminRows] = await pool.execute(
      'SELECT id, email, first_name, last_name FROM admins WHERE id = ?',
      [adminId]
    );
    
    const adminData = adminRows[0];
    if (!adminData) {
      return res.status(404).json({ success: false, error: "Admin not found" });
    }
    
    // Get or create Stripe customer - this now returns a string ID
    const customerId = await getOrCreateStripeCustomer(organizationId, {
      id: adminId,
      email: adminData.email,
      firstName: adminData.first_name,
      lastName: adminData.last_name,
      organizationName: ''
    });
    
    console.log('[Checkout] Using customer ID:', customerId);
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-required`,
      metadata: {
        organization_id: organizationId.toString(),
        admin_id: adminId.toString(),
        plan_name: planName,
        billing_cycle: billingCycle,
        organization_type: organizationType,
        device_id: deviceId || '',
        include_tax: includeTax ? 'true' : 'false',
        tax_rate: taxRate?.toString() || '0'
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId.toString(),
          admin_id: adminId.toString(),
          plan_name: planName,
          billing_cycle: billingCycle
        }
      },
      client_reference_id: `${organizationId}_${adminId}_${planName}_${Date.now()}`
    });
    
    console.log('[Checkout] Session created:', {
      sessionId: session.id,
      customerId: customerId,
      plan: planName,
      cycle: billingCycle,
      organizationId,
      adminId
    });
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionUrl: session.url
      }
    });
    
  } catch (error) {
    console.error('[CreateCheckout] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create checkout session"
    });
  }
};

// ============================================
// 2. CONFIRM CHECKOUT SESSION (After payment)
// ============================================
export const confirmCheckoutSession = async (req, res) => {
  let connection;
  
  try {
    const { sessionId } = req.body;
    
    console.log('[ConfirmCheckout] Received sessionId:', sessionId);
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: "Session ID is required" 
      });
    }
    
    // Retrieve the checkout session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer', 'payment_intent', 'subscription.latest_invoice']
      });
      console.log('[ConfirmCheckout] Session retrieved:', {
        id: session.id,
        payment_status: session.payment_status,
        mode: session.mode,
        has_subscription: !!session.subscription
      });
    } catch (stripeError) {
      console.error('[ConfirmCheckout] Stripe retrieve error:', stripeError);
      return res.status(400).json({ 
        success: false, 
        error: `Stripe error: ${stripeError.message}` 
      });
    }
    
    if (session.payment_status !== 'paid') {
      console.log('[ConfirmCheckout] Payment not completed:', session.payment_status);
      return res.status(400).json({ 
        success: false, 
        error: `Payment not completed. Status: ${session.payment_status}` 
      });
    }
    
    const subscription = session.subscription;
   const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
    const paymentIntent = session.payment_intent;
    
    // Get metadata with fallbacks
    let organizationId = session.metadata?.organization_id;
    let adminId = session.metadata?.admin_id;
    let planName = session.metadata?.plan_name;
    let billingCycle = session.metadata?.billing_cycle;
    let deviceId = session.metadata?.device_id;
    
    // Try to get from client_reference_id if metadata missing
    if (!organizationId || !adminId) {
      const refParts = session.client_reference_id?.split('_') || [];
      if (refParts.length >= 2) {
        organizationId = refParts[0];
        adminId = refParts[1];
        console.log('[ConfirmCheckout] Using client_reference_id:', { organizationId, adminId });
      }
    }
    
    if (!organizationId || !adminId || !planName) {
      console.error('[ConfirmCheckout] Missing required data:', {
        organizationId,
        adminId,
        planName,
        metadata: session.metadata
      });
      return res.status(400).json({ 
        success: false, 
        error: "Missing organization or plan information. Please contact support." 
      });
    }
    
    // Process subscription activation
    const result = await processSubscriptionActivation({
      organizationId: parseInt(organizationId),
      adminId: parseInt(adminId),
      planName,
      billingCycle: billingCycle || 'monthly',
      stripeSubscriptionId: subscription?.id,
      stripePriceId: subscription?.items?.data[0]?.price?.id || null,
      customerId,
      paymentIntentId: paymentIntent?.id,
      amount: session.amount_total / 100,
      deviceId: deviceId || null,
      invoiceUrl: subscription?.latest_invoice?.hosted_invoice_url || null,
      pdfUrl: subscription?.latest_invoice?.invoice_pdf || null,
      stripeInvoiceId: subscription?.latest_invoice?.id || null
    });
    
    return res.json(result);
    
  } catch (error) {
    console.error('[ConfirmCheckout] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to confirm checkout"
    });
  }
};

// Helper function to process subscription activation
async function processSubscriptionActivation(params) {
  let connection;
  
  try {
    const {
      organizationId,
      adminId,
      planName,
      billingCycle,
      stripeSubscriptionId,
      stripePriceId,
      customerId,
      paymentIntentId,
      amount,
      deviceId,
      invoiceUrl,
      pdfUrl,
      stripeInvoiceId
    } = params;
    
    console.log('[ProcessActivation] Starting with params:', {
      organizationId,
      adminId,
      planName,
      billingCycle,
      stripeSubscriptionId,
      stripePriceId,
      customerId,
      paymentIntentId,
      amount,
      deviceId
    });
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if subscription already exists
    const [existingSub] = await connection.execute(
      `SELECT id, status FROM subscriptions 
       WHERE organization_id = ? AND status IN ('active', 'trial')
       LIMIT 1`,
      [organizationId]
    );
    
    // Calculate dates
    const startDate = new Date();
    const endDate = billingCycle === 'monthly' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');
    
    // Get exchange rate
    const [currencyRows] = await connection.execute(
      'SELECT rate_to_usd FROM currencies WHERE code = ?',
      ['USD']
    );
    const exchangeRate = currencyRows[0]?.rate_to_usd || 1;
    
    // Get plan ID
    const [planRows] = await connection.execute(
      'SELECT id, name, max_admins FROM subscription_plans WHERE name = ? OR display_name LIKE ? LIMIT 1',
      [planName, `%${planName}%`]
    );
    
    const plan = planRows[0];
    if (!plan) {
      console.error('[ProcessActivation] Plan not found:', planName);
      await connection.rollback();
      return {
        success: false,
        error: `Plan "${planName}" not found in database`
      };
    }
    
    let subscriptionId;
    
    if (existingSub.length > 0) {
      // UPDATE existing subscription
      subscriptionId = existingSub[0].id;
      
      await connection.execute(
        `UPDATE subscriptions SET 
          plan_id = ?,
          amount_paid = ?,
          billing_cycle = ?,
          status = 'active',
          start_date = ?,
          end_date = ?,
          stripe_subscription_id = ?,
          stripe_price_id = ?,
          currency = 'USD',
          exchange_rate = ?,
          base_amount_usd = ?,
          base_currency = 'USD',
          auto_renew = 1,
          updated_at = NOW(),
          metadata = ?
         WHERE id = ?`,
        [plan.id, amount, billingCycle, formattedStartDate, formattedEndDate, 
         stripeSubscriptionId, stripePriceId, exchangeRate, amount,
         JSON.stringify({
           updated_from_session: true,
           payment_intent_id: paymentIntentId,
           updated_at: new Date().toISOString()
         }), subscriptionId]
      );
      console.log('Updated existing subscription:', subscriptionId);
    } else {
      // INSERT new subscription
      const [subResult] = await connection.execute(
        `INSERT INTO subscriptions (
          organization_id, plan_id, amount_paid, billing_cycle, status,
          start_date, end_date, stripe_subscription_id, stripe_price_id,
          auto_renew, currency, exchange_rate, base_amount_usd, base_currency,
          metadata
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 1, 'USD', ?, ?, 'USD', ?)`,
        [
          organizationId, plan.id, amount, billingCycle,
          formattedStartDate, formattedEndDate, stripeSubscriptionId, stripePriceId,
          exchangeRate, amount,
          JSON.stringify({
            activated_from_session: true,
            payment_intent_id: paymentIntentId,
            activated_at: new Date().toISOString()
          })
        ]
      );
      subscriptionId = subResult.insertId;
      console.log('Created new subscription:', subscriptionId);
    }
    
    // ============ CREATE INVOICE ============
    const invoiceNumber = generateInvoiceNumber();
    
    const [invoiceResult] = await connection.execute(
      `INSERT INTO invoices (
        organization_id, subscription_id, invoice_number, amount, currency,
        exchange_rate, base_amount_usd, base_currency,
        status, invoice_date, due_date, items, metadata,
        invoice_url, pdf_url, payment_method, transaction_id
      ) VALUES (?, ?, ?, ?, 'USD', ?, ?, 'USD', 'paid', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, ?, ?, 'card', ?)`,
      [
        organizationId,
        subscriptionId,
        invoiceNumber,
        amount,
        exchangeRate,
        amount,
        JSON.stringify([{
          description: `${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan - ${billingCycle} subscription`,
          amount: amount,
          quantity: 1,
          unit_price: amount
        }]),
        JSON.stringify({
          payment_intent_id: paymentIntentId,
          stripe_invoice_id: stripeInvoiceId,
          plan_name: planName
        }),
        invoiceUrl,
        pdfUrl,
        paymentIntentId
      ]
    );
    
    const invoiceId = invoiceResult.insertId;
    console.log('Created invoice:', invoiceNumber, 'ID:', invoiceId);
    
    // ============ CREATE PAYMENT RECORD ============
    await connection.execute(
      `INSERT INTO payments (
        organization_id, subscription_id, invoice_id, gateway, gateway_transaction_id,
        amount, payment_intent_id, currency, exchange_rate, base_amount_usd, base_currency,
        status, paid_at, metadata
      ) VALUES (?, ?, ?, 'stripe', ?, ?, ?, 'USD', ?, ?, 'USD', 'success', NOW(), ?)`,
      [
        organizationId, subscriptionId, invoiceId, paymentIntentId, amount, paymentIntentId,
        exchangeRate, amount,
        JSON.stringify({ payment_intent_id: paymentIntentId, checkout_completed: true })
      ]
    );
    
    console.log('Created payment record');
    
    // ============ SAVE PAYMENT METHOD ============
    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const paymentMethodIdFromIntent = paymentIntent.payment_method;
        
        if (paymentMethodIdFromIntent) {
          const [existingPM] = await connection.execute(
            'SELECT id FROM payment_methods WHERE gateway_payment_method_id = ? LIMIT 1',
            [paymentMethodIdFromIntent]
          );
          
          if (existingPM.length === 0) {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodIdFromIntent);
            
            await connection.execute(
              `INSERT INTO payment_methods (
                organization_id, admin_id, payment_gateway, gateway_payment_method_id,
                gateway_customer_id, gateway_type, payment_method_id,
                currency, card_brand, card_last4, card_exp_month, card_exp_year,
                is_default, is_active, created_at, updated_at
              ) VALUES (?, ?, 'stripe', ?, ?, 'card', ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
              [
                organizationId,
                adminId,
                paymentMethodIdFromIntent,
                customerId,
                paymentMethod.id,
                paymentMethod.card?.currency || 'USD',
                paymentMethod.card?.brand || null,
                paymentMethod.card?.last4 || null,
                paymentMethod.card?.exp_month || null,
                paymentMethod.card?.exp_year || null
              ]
            );
            console.log('Saved enhanced payment method');
          }
        }
      } catch (pmError) {
        console.error('Error saving payment method:', pmError);
      }
    }
    
    // ============ UPDATE ORGANIZATION ============
    // CRITICAL: Ensure customerId is a string, not an object
    const safeCustomerId = (customerId && typeof customerId === 'string' && customerId !== '[object Object]') 
      ? customerId 
      : '';
    const safeStripeSubscriptionId = stripeSubscriptionId ? String(stripeSubscriptionId) : '';
    
    const [orgCheck] = await connection.execute(
      'SELECT subscription_started_at FROM organizations WHERE id = ?',
      [organizationId]
    );
    
    const existingStartDate = orgCheck[0]?.subscription_started_at;
    const finalStartDate = existingStartDate || formattedStartDate;
    
    await connection.execute(
      `UPDATE organizations 
       SET subscription_status = 'active',
           subscription_started_at = ?,
           subscription_expires_at = ?,
           stripe_customer_id = ?,
           stripe_subscription_id = ?,
           max_admins_allowed = ?
       WHERE id = ?`,
      [finalStartDate, formattedEndDate, safeCustomerId, safeStripeSubscriptionId, plan.max_admins || 5, organizationId]
    );
    
    console.log('Updated organization with stripe_customer_id:', safeCustomerId);
    
    // ============ UPDATE ADMIN ============
    await connection.execute(
      `UPDATE admins 
       SET payment_status = 'completed', 
           plan_selected = ?,
           billing_cycle = ?
       WHERE id = ?`,
      [plan.name, billingCycle, adminId]
    );
    
    console.log('Updated admin');
    
    await connection.commit();
    
    // Determine redirect URL
    let redirectUrl = null;
    if (deviceId && deviceId !== '' && deviceId !== 'null' && deviceId !== 'undefined') {
      redirectUrl = `/dashboard/hardware-shop?re-select_crat=csm-device-99_added&device_id=${deviceId}`;
    }
    
    console.log('[ProcessActivation] Completed successfully:', {
      subscriptionId,
      organizationId,
      plan: plan.name,
      redirectUrl
    });
    
    return {
      success: true,
      data: {
        subscription_id: subscriptionId,
        plan_name: plan.name,
        billing_cycle: billingCycle,
        amount,
        status: 'active',
        invoice_number: invoiceNumber,
        stripe_subscription_id: stripeSubscriptionId,
        redirect_url: redirectUrl,
        message: 'Subscription activated successfully!'
      }
    };
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ProcessActivation] Error:', error);
    return {
      success: false,
      error: error.message || "Failed to activate subscription"
    };
  } finally {
    if (connection) connection.release();
  }
}

// ============================================
// ACTIVATE FREE TRIAL
// ============================================
export const activateFreeTrial = async (req, res) => {
  let connection;
  
  try {
    const { planName = 'free', organizationType = 'school', deviceId } = req.body;
    const adminId = req.adminId;
    const organizationId = req.organizationId;
    
    console.log('Activating free trial for:', { adminId, organizationId, planName });
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Check if already has active subscription
    const [existingSub] = await connection.execute(
      `SELECT id, status FROM subscriptions 
       WHERE organization_id = ? AND status IN ('active', 'trial')
       LIMIT 1`,
      [organizationId]
    );
    
    if (existingSub.length > 0) {
      await connection.commit();
      return res.json({
        success: true,
        data: {
          subscription_id: existingSub[0].id,
          message: "Subscription already active"
        }
      });
    }
    
    // Get plan ID
    const [planRows] = await connection.execute(
      'SELECT id, name, max_admins FROM subscription_plans WHERE name = ? LIMIT 1',
      [planName]
    );
    
    const plan = planRows[0] || { id: 1, name: 'free', max_admins: 1 };
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');
    
    // Get exchange rate
    const [currencyRows] = await connection.execute(
      'SELECT rate_to_usd FROM currencies WHERE code = ?',
      ['USD']
    );
    const exchangeRate = currencyRows[0]?.rate_to_usd || 1;
    
    // Create subscription record
    const [subResult] = await connection.execute(
      `INSERT INTO subscriptions (
        organization_id, plan_id, amount_paid, billing_cycle, status,
        start_date, end_date, auto_renew, currency, exchange_rate,
        base_amount_usd, base_currency, metadata
      ) VALUES (?, ?, 0, 'monthly', 'trial', NOW(), ?, 1, 'USD', ?, 0, 'USD', ?)`,
      [
        organizationId,
        plan.id,
        formattedEndDate,
        exchangeRate,
        JSON.stringify({ free_trial: true, organization_type: organizationType })
      ]
    );
    
    const subscriptionId = subResult.insertId;
    
    // Create invoice for free trial
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    await connection.execute(
      `INSERT INTO invoices (
        organization_id, subscription_id, invoice_number, amount, currency,
        exchange_rate, base_amount_usd, base_currency,
        status, invoice_date, due_date, items, metadata,
        payment_method, transaction_id
      ) VALUES (?, ?, ?, 0, 'USD', ?, 0, 'USD', 'paid', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, 'free_trial', NULL)`,
      [
        organizationId,
        subscriptionId,
        invoiceNumber,
        exchangeRate,
        JSON.stringify([{
          description: `${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Free Trial`,
          amount: 0,
          quantity: 1,
          unit_price: 0
        }]),
        JSON.stringify({ free_trial: true, organization_type: organizationType })
      ]
    );
    
    // Update organization
    await connection.execute(
      `UPDATE organizations 
       SET subscription_status = 'trial',
           subscription_started_at = NOW(),
           subscription_expires_at = ?,
           trial_ends_at = ?,
           max_admins_allowed = ?
       WHERE id = ?`,
      [formattedEndDate, formattedEndDate, plan.max_admins || 1, organizationId]
    );
    
    // Update admin record
    await connection.execute(
      `UPDATE admins 
       SET payment_status = 'trial',
           plan_selected = ?
       WHERE id = ?`,
      ['free', adminId]
    );
    
    await connection.commit();
    
    let redirectUrl = null;
    if (deviceId && deviceId !== '' && deviceId !== 'null' && deviceId !== 'undefined') {
      redirectUrl = `/hardware-shop?re-select_crat=csm-device-99_added&device_id=${deviceId}`;
    }
    
    res.json({
      success: true,
      data: {
        subscription_id: subscriptionId,
        plan_name: 'free',
        status: 'trial',
        trial_end_date: formattedEndDate,
        invoice_number: invoiceNumber,
        redirect_url: redirectUrl,
        message: 'Free trial activated successfully!'
      }
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('FreeTrial error:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to activate free trial"
    });
  } finally {
    if (connection) connection.release();
  }
};

// ============================================
// STRIPE WEBHOOK
// ============================================
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return res.status(200).json({ received: true });
  }
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  console.log('[Webhook] Received event:', event.type, event.id);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('[Webhook] Checkout completed:', session.id);
        
        if (session.mode === 'subscription' && session.payment_status === 'paid') {
          const organizationId = session.metadata?.organization_id;
          const adminId = session.metadata?.admin_id;
          const planName = session.metadata?.plan_name;
          const billingCycle = session.metadata?.billing_cycle;
          const deviceId = session.metadata?.device_id;
          
          if (organizationId && adminId && planName) {
            const result = await processSubscriptionActivation({
              organizationId: parseInt(organizationId),
              adminId: parseInt(adminId),
              planName,
              billingCycle: billingCycle || 'monthly',
              stripeSubscriptionId: session.subscription,
              stripePriceId: session.subscription?.items?.data[0]?.price?.id || null,
              customerId: session.customer,
              paymentIntentId: session.payment_intent,
              amount: session.amount_total / 100,
              deviceId: deviceId || null,
              invoiceUrl: session.subscription?.latest_invoice?.hosted_invoice_url || null,
              pdfUrl: session.subscription?.latest_invoice?.invoice_pdf || null,
              stripeInvoiceId: session.subscription?.latest_invoice?.id || null
            });
            console.log('[Webhook] Activation result:', result);
          }
        }
        break;
        
      case 'invoice.payment_succeeded':
        console.log('[Webhook] Invoice payment succeeded:', event.data.object.id);
        const invoice = event.data.object;
        await pool.execute(
          `UPDATE invoices 
           SET status = 'paid', paid_at = NOW()
           WHERE invoice_number = ? OR metadata->>"$.stripe_invoice_id" = ?`,
          [invoice.number, invoice.id]
        );
        break;
        
      case 'customer.subscription.deleted':
        console.log('[Webhook] Subscription deleted:', event.data.object.id);
        const deletedSub = event.data.object;
        await pool.execute(
          `UPDATE subscriptions 
           SET status = 'expired', end_date = NOW()
           WHERE stripe_subscription_id = ?`,
          [deletedSub.id]
        );
        await pool.execute(
          `UPDATE organizations 
           SET subscription_status = 'expired'
           WHERE stripe_subscription_id = ?`,
          [deletedSub.id]
        );
        break;
        
      case 'customer.subscription.updated':
        console.log('[Webhook] Subscription updated:', event.data.object.id);
        const updatedSub = event.data.object;
        if (updatedSub.cancel_at_period_end) {
          await pool.execute(
            `UPDATE subscriptions SET auto_renew = 0 
             WHERE stripe_subscription_id = ?`,
            [updatedSub.id]
          );
        }
        break;
        
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(200).json({ received: true, error: error.message });
  }
};

// ============================================
// DIRECT ACTIVATION FROM SESSION
// ============================================
export const activateFromSession = async (req, res) => {
  let connection;
  
  try {
    const { 
      sessionId, 
      fallbackPlan, 
      fallbackCycle, 
      fallbackOrgType, 
      fallbackDeviceId 
    } = req.body;
    
    console.log('=== ActivateFromSession Debug ===');
    console.log('Session ID:', sessionId);
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: "Session ID is required" 
      });
    }
    
    // Retrieve the checkout session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer', 'payment_intent', 'subscription.latest_invoice']
      });
      console.log('Session retrieved:', {
        id: session.id,
        payment_status: session.payment_status,
        mode: session.mode,
        subscription_id: session.subscription?.id
      });
    } catch (stripeError) {
      console.error('Stripe retrieve error:', stripeError);
      return res.status(400).json({ 
        success: false, 
        error: `Stripe error: ${stripeError.message}` 
      });
    }
    
    if (session.payment_status !== 'paid') {
      console.log('Payment not completed:', session.payment_status);
      return res.status(400).json({ 
        success: false, 
        error: `Payment not completed. Status: ${session.payment_status}` 
      });
    }
    
    // Get data from session metadata or fallbacks
    let organizationId = session.metadata?.organization_id;
    let adminId = session.metadata?.admin_id;
    let planName = session.metadata?.plan_name;
    let billingCycle = session.metadata?.billing_cycle;
    let deviceId = session.metadata?.device_id;
    
    if (!planName && fallbackPlan) planName = fallbackPlan;
    if (!billingCycle && fallbackCycle) billingCycle = fallbackCycle;
    if (!deviceId && fallbackDeviceId) deviceId = fallbackDeviceId;
    
    if (!organizationId && req.organizationId) organizationId = req.organizationId.toString();
    if (!adminId && req.adminId) adminId = req.adminId.toString();
    
    if (!planName) planName = 'basic';
    if (!billingCycle) billingCycle = 'monthly';
    
    console.log('Final activation data:', { organizationId, adminId, planName, billingCycle, deviceId });
    
    if (!organizationId || !adminId) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing organization or admin information" 
      });
    }
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const actualOrgId = parseInt(organizationId);
    const actualAdminId = parseInt(adminId);
    
    // Get plan ID
    const [planRows] = await connection.execute(
      'SELECT id, name, max_admins FROM subscription_plans WHERE name = ? LIMIT 1',
      [planName]
    );
    
    const plan = planRows[0];
    if (!plan) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: `Plan "${planName}" not found` });
    }
    
    console.log('Found plan:', plan);
    
    const amount = session.amount_total / 100;
    const stripeSubscriptionId = session.subscription?.id || null;
    const stripePriceId = session.subscription?.items?.data[0]?.price?.id || null;
    const customerId = session.customer || null;
    const paymentIntentId = session.payment_intent?.id || null;
    const invoiceUrl = session.subscription?.latest_invoice?.hosted_invoice_url || null;
    const pdfUrl = session.subscription?.latest_invoice?.invoice_pdf || null;
    const stripeInvoiceId = session.subscription?.latest_invoice?.id || null;
    
    const startDate = new Date();
    const endDate = billingCycle === 'monthly' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const formattedEndDate = endDate.toISOString().slice(0, 19).replace('T', ' ');
    
    // Get exchange rate
    const [currencyRows] = await connection.execute(
      'SELECT rate_to_usd FROM currencies WHERE code = ?',
      ['USD']
    );
    const exchangeRate = currencyRows[0]?.rate_to_usd || 1;
    
    // Check for existing subscription
    const [existingSubscription] = await connection.execute(
      `SELECT id, status FROM subscriptions 
       WHERE organization_id = ? AND status IN ('active', 'trial')
       LIMIT 1`,
      [actualOrgId]
    );
    
    let subscriptionId;
    
    if (existingSubscription.length > 0) {
      subscriptionId = existingSubscription[0].id;
      
      await connection.execute(
        `UPDATE subscriptions SET 
          plan_id = ?,
          amount_paid = ?,
          billing_cycle = ?,
          status = 'active',
          start_date = ?,
          end_date = ?,
          stripe_subscription_id = ?,
          stripe_price_id = ?,
          currency = 'USD',
          exchange_rate = ?,
          base_amount_usd = ?,
          base_currency = 'USD',
          auto_renew = 1,
          updated_at = NOW(),
          metadata = ?
         WHERE id = ?`,
        [plan.id, amount, billingCycle, formattedStartDate, formattedEndDate, 
         stripeSubscriptionId, stripePriceId, exchangeRate, amount,
         JSON.stringify({
           updated_from_session: true,
           session_id: sessionId,
           payment_intent_id: paymentIntentId,
           updated_at: new Date().toISOString()
         }), subscriptionId]
      );
      console.log('Updated existing subscription:', subscriptionId);
    } else {
      const [subResult] = await connection.execute(
        `INSERT INTO subscriptions (
          organization_id, plan_id, amount_paid, billing_cycle, status,
          start_date, end_date, stripe_subscription_id, stripe_price_id,
          auto_renew, currency, exchange_rate, base_amount_usd, base_currency,
          metadata
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 1, 'USD', ?, ?, 'USD', ?)`,
        [
          actualOrgId, plan.id, amount, billingCycle,
          formattedStartDate, formattedEndDate, stripeSubscriptionId, stripePriceId,
          exchangeRate, amount,
          JSON.stringify({
            activated_from_session: true,
            session_id: sessionId,
            payment_intent_id: paymentIntentId,
            activated_at: new Date().toISOString()
          })
        ]
      );
      subscriptionId = subResult.insertId;
      console.log('Created new subscription:', subscriptionId);
    }
    
    // Create invoice
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const [invoiceResult] = await connection.execute(
      `INSERT INTO invoices (
        organization_id, subscription_id, invoice_number, amount, currency,
        exchange_rate, base_amount_usd, base_currency,
        status, invoice_date, due_date, items, metadata,
        invoice_url, pdf_url, payment_method, transaction_id
      ) VALUES (?, ?, ?, ?, 'USD', ?, ?, 'USD', 'paid', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?, ?, ?, 'card', ?)`,
      [
        actualOrgId, subscriptionId, invoiceNumber, amount,
        exchangeRate, amount,
        JSON.stringify([{
          description: `${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan - ${billingCycle} subscription`,
          amount: amount,
          quantity: 1,
          unit_price: amount
        }]),
        JSON.stringify({
          session_id: sessionId,
          payment_intent_id: paymentIntentId,
          stripe_invoice_id: stripeInvoiceId
        }),
        invoiceUrl, pdfUrl, paymentIntentId
      ]
    );
    
    const invoiceId = invoiceResult.insertId;
    console.log('Created invoice:', invoiceNumber, 'ID:', invoiceId);
    
    // Create payment record
    await connection.execute(
      `INSERT INTO payments (
        organization_id, subscription_id, invoice_id, gateway, gateway_transaction_id,
        amount, payment_intent_id, currency, exchange_rate, base_amount_usd, base_currency,
        status, paid_at, metadata
      ) VALUES (?, ?, ?, 'stripe', ?, ?, ?, 'USD', ?, ?, 'USD', 'success', NOW(), ?)`,
      [
        actualOrgId, subscriptionId, invoiceId, paymentIntentId, amount, paymentIntentId,
        exchangeRate, amount,
        JSON.stringify({ session_id: sessionId, checkout_completed: true })
      ]
    );
    
    console.log('Created payment record');
    
    // Save payment method
    if (paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const paymentMethodIdFromIntent = paymentIntent.payment_method;
        
        if (paymentMethodIdFromIntent) {
          const [existingPM] = await connection.execute(
            'SELECT id FROM payment_methods WHERE gateway_payment_method_id = ? LIMIT 1',
            [paymentMethodIdFromIntent]
          );
          
          if (existingPM.length === 0) {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodIdFromIntent);
            const stripeCustomerId = session.customer;
            
            await connection.execute(
              `INSERT INTO payment_methods (
                organization_id, admin_id, payment_gateway, gateway_payment_method_id,
                gateway_customer_id, gateway_type, payment_method_id,
                currency, card_brand, card_last4, card_exp_month, card_exp_year,
                is_default, is_active, created_at, updated_at
              ) VALUES (?, ?, 'stripe', ?, ?, 'card', ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
              [
                actualOrgId, actualAdminId, paymentMethodIdFromIntent, stripeCustomerId,
                paymentMethod.id, paymentMethod.card?.currency || 'USD',
                paymentMethod.card?.brand || null, paymentMethod.card?.last4 || null,
                paymentMethod.card?.exp_month || null, paymentMethod.card?.exp_year || null
              ]
            );
            console.log('Saved enhanced payment method');
          }
        }
      } catch (pmError) {
        console.error('Error saving payment method:', pmError);
      }
    }
    
    // ============ UPDATE ORGANIZATION - CRITICAL FIX ============
    // Ensure customerId is a valid string, not an object
    let finalCustomerId = '';
    if (customerId && typeof customerId === 'string') {
      finalCustomerId = customerId;
    } else if (customerId && customerId.id && typeof customerId.id === 'string') {
      // If somehow we got the whole customer object, extract the ID
      finalCustomerId = customerId.id;
      console.log('[Fix] Extracted customer ID from object:', finalCustomerId);
    } else {
      console.log('[Fix] No valid customer ID found, using empty string');
    }
    
    const safeStripeSubscriptionId = stripeSubscriptionId ? String(stripeSubscriptionId) : '';
    
    const [orgCheck] = await connection.execute(
      'SELECT subscription_started_at FROM organizations WHERE id = ?',
      [actualOrgId]
    );
    
    const existingStartDate = orgCheck[0]?.subscription_started_at;
    const finalStartDate = existingStartDate || formattedStartDate;
    
    await connection.execute(
      `UPDATE organizations 
       SET subscription_status = 'active',
           subscription_started_at = ?,
           subscription_expires_at = ?,
           stripe_customer_id = ?,
           stripe_subscription_id = ?,
           max_admins_allowed = ?
       WHERE id = ?`,
      [finalStartDate, formattedEndDate, finalCustomerId, safeStripeSubscriptionId, plan.max_admins || 5, actualOrgId]
    );
    
    console.log('Updated organization with stripe_customer_id:', finalCustomerId);
    
    // Update admin
    await connection.execute(
      `UPDATE admins 
       SET payment_status = 'completed', 
           plan_selected = ?,
           billing_cycle = ?
       WHERE id = ?`,
      [plan.name, billingCycle, actualAdminId]
    );
    
    await connection.commit();
    
    let redirectUrl = null;
    if (deviceId && deviceId !== '' && deviceId !== 'null' && deviceId !== 'undefined') {
      redirectUrl = `/dashboard/hardware-shop?re-select_crat=csm-device-99_added&device_id=${deviceId}`;
    }
    
    console.log('Activation completed successfully');
    
    res.json({
      success: true,
      data: {
        subscription_id: subscriptionId,
        plan_name: plan.name,
        billing_cycle: billingCycle,
        amount: amount,
        status: 'active',
        invoice_number: invoiceNumber,
        redirect_url: redirectUrl,
        message: 'Subscription activated successfully!'
      }
    });
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('ActivateFromSession error:', error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to activate subscription"
    });
  } finally {
    if (connection) connection.release();
  }
};

export default {
  createCheckoutSession,
  confirmCheckoutSession,
  activateFromSession,
  activateFreeTrial,
  handleStripeWebhook
};