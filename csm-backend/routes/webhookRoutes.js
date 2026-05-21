// csms-backend/routes/webhookRoutes.js
import express from 'express';
import Stripe from 'stripe';
import pool from '../config/database.js';
import stripe from '../config/stripe.js';

const router = express.Router();

// Stripe webhook endpoint (raw body required)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  console.log(`Received Stripe event: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
        
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`Payment intent succeeded: ${paymentIntent.id}`);
  
  // Update payment status
  await pool.execute(
    `UPDATE payments 
     SET status = 'success', paid_at = NOW() 
     WHERE payment_intent_id = ?`,
    [paymentIntent.id]
  );
  
  // If this is for a subscription, update subscription status
  if (paymentIntent.metadata?.type === 'subscription') {
    const organizationId = paymentIntent.metadata?.organization_id;
    
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = 'active' 
       WHERE id = ?`,
      [organizationId]
    );
  }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  console.log(`Payment intent failed: ${paymentIntent.id}`);
  
  await pool.execute(
    `UPDATE payments 
     SET status = 'failed', 
         failure_code = ?, 
         failure_message = ? 
     WHERE payment_intent_id = ?`,
    [paymentIntent.last_payment_error?.code, paymentIntent.last_payment_error?.message, paymentIntent.id]
  );
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  console.log(`Subscription created: ${subscription.id}`);
  
  const organizationId = subscription.metadata?.organization_id;
  
  if (organizationId) {
    await pool.execute(
      `UPDATE organizations 
       SET stripe_subscription_id = ?, 
           subscription_status = 'active',
           updated_at = NOW()
       WHERE id = ?`,
      [subscription.id, organizationId]
    );
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  console.log(`Subscription updated: ${subscription.id}`);
  
  const organizationId = subscription.metadata?.organization_id;
  
  if (organizationId) {
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = ?, 
           auto_renew = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [subscription.cancel_at_period_end ? 'cancelling' : 'active', !subscription.cancel_at_period_end, organizationId]
    );
    
    // Update extra devices count from subscription items
    const extraDevicesItem = subscription.items.data.find(
      item => item.price.metadata?.type === 'extra_device'
    );
    
    if (extraDevicesItem) {
      await pool.execute(
        `UPDATE organizations 
         SET extra_devices_count = ?,
             extra_devices_monthly_fee = ?
         WHERE id = ?`,
        [extraDevicesItem.quantity, extraDevicesItem.quantity * 20, organizationId]
      );
    }
  }
}

// Handle subscription deleted/cancelled
async function handleSubscriptionDeleted(subscription) {
  console.log(`Subscription deleted: ${subscription.id}`);
  
  const organizationId = subscription.metadata?.organization_id;
  
  if (organizationId) {
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = 'expired',
           stripe_subscription_id = NULL,
           updated_at = NOW()
       WHERE id = ? AND stripe_subscription_id = ?`,
      [organizationId, subscription.id]
    );
    
    await pool.execute(
      `UPDATE subscriptions 
       SET status = 'canceled', 
           canceled_at = NOW() 
       WHERE stripe_subscription_id = ?`,
      [subscription.id]
    );
  }
}

// Handle invoice payment succeeded
async function handleInvoicePaymentSucceeded(invoice) {
  console.log(`Invoice payment succeeded: ${invoice.id}`);
  
  // Create invoice record in database
  await pool.execute(
    `INSERT INTO invoices (
      organization_id, subscription_id, invoice_number, amount, currency,
      status, invoice_date, paid_at, payment_method
    ) SELECT 
      o.id, s.id, ?, ?, ?, 'paid', NOW(), NOW, ?
    FROM organizations o
    LEFT JOIN subscriptions s ON o.stripe_subscription_id = ?
    WHERE o.stripe_customer_id = ?`,
    [invoice.number, invoice.total / 100, invoice.currency, invoice.charge, invoice.subscription, invoice.customer]
  );
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice) {
  console.log(`Invoice payment failed: ${invoice.id}`);
  
  // Update organization status to payment_failed
  const [customers] = await pool.execute(
    'SELECT id FROM organizations WHERE stripe_customer_id = ?',
    [invoice.customer]
  );
  
  if (customers.length > 0) {
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = 'payment_failed' 
       WHERE id = ?`,
      [customers[0].id]
    );
  }
}

// Handle charge refunded
async function handleChargeRefunded(charge) {
  console.log(`Charge refunded: ${charge.id}`);
  
  await pool.execute(
    `UPDATE payments 
     SET status = 'refunded' 
     WHERE payment_intent_id = ?`,
    [charge.payment_intent]
  );
}

export default router;