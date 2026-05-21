// csms-backend/services/stripeService.js
import stripe from '../config/stripe.js';
import pool from '../config/database.js';

class StripeService {
  
  // Create or get Stripe customer
  async getOrCreateCustomer(organizationId, email, name) {
    try {
      const [orgs] = await pool.execute(
        'SELECT stripe_customer_id FROM organizations WHERE id = ?',
        [organizationId]
      );
      
      if (orgs[0]?.stripe_customer_id) {
        return orgs[0].stripe_customer_id;
      }
      
      const customer = await stripe.customers.create({
        email: email,
        name: name,
        metadata: {
          organization_id: organizationId
        }
      });
      
      await pool.execute(
        'UPDATE organizations SET stripe_customer_id = ? WHERE id = ?',
        [customer.id, organizationId]
      );
      
      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }
  
  // Create subscription for organization
  async createSubscription(organizationId, planName, billingCycle, autoRenew = true, extraDevices = 0) {
    try {
      const [orgs] = await pool.execute(
        'SELECT org_name, contact_email, stripe_customer_id, type FROM organizations WHERE id = ?',
        [organizationId]
      );
      
      if (!orgs[0]) {
        throw new Error('Organization not found');
      }
      
      // USING MY REAL STRIPE PRICE IDs HERE (same as in updateSubscription)
      const priceIds = {
        school: {
          basic: { 
            monthly: 'price_1TUbNbCE2cNbBO2QKA7T1ljO',  // my real monthly price ID
            yearly: 'price_1TUbNbCE2cNbBO2Qlo2Gs6J1'    // my real yearly price ID
          },
          professional: { 
            monthly: 'price_1TUbThCE2cNbBO2QxduoVj09',
            yearly: 'price_1TUbThCE2cNbBO2QpONVX5bY'
          },
          enterprise: { 
            monthly: 'price_1TUbcbCE2cNbBO2Q9wSca7hP',
            yearly: 'price_1TUbcbCE2cNbBO2QZGTa3iXy'
          }
        },
        company: {
          basic: { 
            monthly: 'price_1TUbuyCE2cNbBO2Q9PQFjAvb',
            yearly: 'price_1TUbuyCE2cNbBO2Qsbd0FRSu'
          },
          professional: { 
            monthly: 'price_1TUbyDCE2cNbBO2Qsn12vaYC',
            yearly: 'price_1TUbyDCE2cNbBO2QshtlNsIg'
          },
          enterprise: { 
            monthly: 'price_1TUc34CE2cNbBO2QQAt7rgC5',
            yearly: 'price_1TUc34CE2cNbBO2QdZ0eLPm8'
          }
        }
      };
      
      const priceId = priceIds[orgs[0].type]?.[planName]?.[billingCycle];
      
      if (!priceId) {
        throw new Error(`Invalid plan or billing cycle: ${planName}/${billingCycle}`);
      }
      
      // Create subscription items array
      const items = [{ price: priceId }];
      
      // Add extra devices if any
      const extraDevicePriceId = 'price_1TUe5zCE2cNbBO2QNoAnpbpU'; // in only aded added dashboard/billing if only account bought at list a $99 or $90 device from our shop, so will have ability to get additional device for 20% per month.
      if (extraDevices > 0) {
        items.push({
          price: extraDevicePriceId,
          quantity: extraDevices
        });
      }
      
      const subscription = await stripe.subscriptions.create({
        customer: orgs[0].stripe_customer_id,
        items: items,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          organization_id: organizationId,
          plan_name: planName,
          billing_cycle: billingCycle,
          extra_devices: extraDevices
        },
        cancel_at_period_end: !autoRenew
      });
      
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }
  
  // Update subscription
  async updateSubscription(organizationId, newPlanName, billingCycle, extraDevices = 0) {
    try {
      const [orgs] = await pool.execute(
        `SELECT o.stripe_subscription_id, o.type FROM organizations o WHERE o.id = ?`,
        [organizationId]
      );
      
      if (!orgs[0]?.stripe_subscription_id) {
        throw new Error('No active subscription found');
      }
      
      // USE YOUR REAL STRIPE PRICE IDs HERE
      const priceIds = {
        school: {
          basic: { 
            monthly: 'price_1TUbNbCE2cNbBO2QKA7T1ljO',  // Your real monthly price ID
            yearly: 'price_1TUbNbCE2cNbBO2Qlo2Gs6J1'    // Your real yearly price ID
          },
          professional: { 
            monthly: 'price_1TUbThCE2cNbBO2QxduoVj09',
            yearly: 'price_1TUbThCE2cNbBO2QpONVX5bY'
          },
          enterprise: { 
            monthly: 'price_1TUbcbCE2cNbBO2Q9wSca7hP',
            yearly: 'price_1TUbcbCE2cNbBO2QZGTa3iXy'
          }
        },
        company: {
          basic: { 
            monthly: 'price_1TUbuyCE2cNbBO2Q9PQFjAvb',
            yearly: 'price_1TUbuyCE2cNbBO2Qsbd0FRSu'
          },
          professional: { 
            monthly: 'price_1TUbyDCE2cNbBO2Qsn12vaYC',
            yearly: 'price_1TUbyDCE2cNbBO2QshtlNsIg'
          },
          enterprise: { 
            monthly: 'price_1TUc34CE2cNbBO2QQAt7rgC5',
            yearly: 'price_1TUc34CE2cNbBO2QdZ0eLPm8'
          }
        }
      };
      
      const newPriceId = priceIds[orgs[0].type]?.[newPlanName]?.[billingCycle];
      
      if (!newPriceId) {
        throw new Error('Invalid plan or billing cycle');
      }
      
      const subscription = await stripe.subscriptions.retrieve(orgs[0].stripe_subscription_id);
      
      const updatedItems = subscription.items.data.map(item => {
        if (item.price.metadata?.type === 'base_plan' || !item.price.metadata?.type) {
          return { id: item.id, price: newPriceId };
        }
        return { id: item.id };
      });
      
      const extraDevicePriceId = 'price_1TUe5zCE2cNbBO2QNoAnpbpU';
      if (extraDevices > 0) {
        const existingExtra = subscription.items.data.find(item => item.price.id === extraDevicePriceId);
        if (existingExtra) {
          updatedItems.push({ id: existingExtra.id, quantity: extraDevices });
        } else {
          updatedItems.push({ price: extraDevicePriceId, quantity: extraDevices });
        }
      }
      
      const updatedSubscription = await stripe.subscriptions.update(
        orgs[0].stripe_subscription_id,
        {
          items: updatedItems,
          metadata: {
            plan_name: newPlanName,
            billing_cycle: billingCycle,
            extra_devices: extraDevices
          }
        }
      );
      
      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }
  
  // Cancel subscription
  async cancelSubscription(organizationId, cancelImmediately = false) {
    try {
      const [orgs] = await pool.execute(
        'SELECT stripe_subscription_id FROM organizations WHERE id = ?',
        [organizationId]
      );
      
      if (!orgs[0]?.stripe_subscription_id) {
        throw new Error('No active subscription found');
      }
      
      if (cancelImmediately) {
        await stripe.subscriptions.cancel(orgs[0].stripe_subscription_id);
      } else {
        await stripe.subscriptions.update(orgs[0].stripe_subscription_id, {
          cancel_at_period_end: true
        });
      }
      
      return { success: true, cancelImmediately };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }
  
  // Reactivate subscription
  async reactivateSubscription(organizationId) {
    try {
      const [orgs] = await pool.execute(
        'SELECT stripe_subscription_id FROM organizations WHERE id = ?',
        [organizationId]
      );
      
      if (!orgs[0]?.stripe_subscription_id) {
        throw new Error('No subscription found');
      }
      
      await stripe.subscriptions.update(orgs[0].stripe_subscription_id, {
        cancel_at_period_end: false
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }
  
  // Create payment intent for hardware purchase
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: metadata,
        automatic_payment_methods: { enabled: true },
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }
  
  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw error;
    }
  }
  
  // Create refund
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundParams = { payment_intent: paymentIntentId, reason: reason };
      if (amount) refundParams.amount = Math.round(amount * 100);
      const refund = await stripe.refunds.create(refundParams);
      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }
  
  // Get payment methods
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  }
  
  // Attach payment method
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      const methods = await this.getPaymentMethods(customerId);
      if (methods.length === 1) {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
      }
      
      return paymentMethod;
    } catch (error) {
      console.error('Error attaching payment method:', error);
      throw error;
    }
  }
  
  // Set default payment method
  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return { success: true };
    } catch (error) {
      console.error('Error setting default payment method:', error);
      throw error;
    }
  }
  
  // Detach payment method
  async detachPaymentMethod(paymentMethodId) {
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
      return { success: true };
    } catch (error) {
      console.error('Error detaching payment method:', error);
      throw error;
    }
  }
  
  // Get upcoming invoice
  async getUpcomingInvoice(customerId, subscriptionId = null) {
    try {
      const params = { customer: customerId };
      if (subscriptionId) params.subscription = subscriptionId;
      const invoice = await stripe.invoices.upcoming(params);
      return invoice;
    } catch (error) {
      console.error('Error fetching upcoming invoice:', error);
      throw error;
    }
  }
  
  // Get invoice history
  async getInvoices(customerId, limit = 50) {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: limit,
      });
      return invoices.data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  }
}

export default new StripeService();