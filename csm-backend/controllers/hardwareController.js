// csms-backend/controllers/hardwareController.js
import pool from '../config/database.js';
import stripe from '../config/stripe.js';
import crypto from 'crypto';

// Create hardware payment intent
export const createHardwarePaymentIntent = async (req, res) => {
  const { amount, currency = 'usd', order_id, items } = req.body;
  
  try {
    // Get or create Stripe customer
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
        order_id: order_id,
        items: JSON.stringify(items),
        type: 'hardware_purchase'
      }
    );
    
    // Save payment record
    await pool.execute(
      `INSERT INTO payments (
        organization_id, amount, currency, status, payment_intent_id, 
        gateway, created_at
      ) VALUES (?, ?, ?, 'pending', ?, 'stripe', NOW())`,
      [req.organizationId, amount, currency, paymentIntent.id]
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

// Create hardware order with payment
export const createHardwareOrder = async (req, res) => {
  const {
    items,
    subtotal,
    shipping_cost,
    tax,
    total,
    shipping_method,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    payment_intent_id
  } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: 'No items in order' });
  }
  
  if (!payment_intent_id) {
    return res.status(400).json({ success: false, error: 'Payment required' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Verify payment intent
    const [payments] = await connection.execute(
      'SELECT status, amount FROM payments WHERE payment_intent_id = ? AND organization_id = ?',
      [payment_intent_id, req.organizationId]
    );
    
    if (payments.length === 0) {
      throw new Error('Payment not found');
    }
    
    if (payments[0].status !== 'success') {
      throw new Error('Payment not successful');
    }
    
    if (parseFloat(payments[0].amount) !== total) {
      throw new Error('Payment amount mismatch');
    }
    
    // Generate order number
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // Create order
    const [orderResult] = await connection.execute(
      `INSERT INTO hardware_orders (
        order_number, organization_id, admin_id, status, subtotal, shipping_cost,
        tax, total, shipping_method, customer_name, customer_email, customer_phone,
        shipping_address, payment_status, payment_gateway, gateway_transaction_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, NOW(), NOW())`,
      [
        orderNumber, req.organizationId, req.adminId,
        subtotal, shipping_cost, tax, total, shipping_method,
        customer_name, customer_email, customer_phone, shipping_address,
        payment_intent_id
      ]
    );
    
    const orderId = orderResult.insertId;
    
    // Update payment record with order_id
    await connection.execute(
      'UPDATE payments SET invoice_id = ? WHERE payment_intent_id = ?',
      [orderId, payment_intent_id]
    );
    
    // Create order items and update stock
    for (const item of items) {
      // Find product by SKU or name
      let [products] = await connection.execute(
        `SELECT * FROM device_store 
         WHERE product_sku = ? OR product_name LIKE ?`,
        [item.product_id, `%${item.product_name.split(':')[0].trim()}%`]
      );
      
      if (products.length === 0) {
        throw new Error(`Product ${item.product_name} not found in inventory`);
      }
      
      const product = products[0];
      
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.product_name}`);
      }
      
      // Add order item
      await connection.execute(
        `INSERT INTO hardware_order_items (
          order_id, product_id, product_name, product_sku, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.product_name, product.product_sku, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
      
      // Update stock
      await connection.execute(
        'UPDATE device_store SET quantity = quantity - ?, updated_at = NOW() WHERE id = ?',
        [item.quantity, product.id]
      );
      
      // Record stock transaction
      await connection.execute(
        `INSERT INTO stock_transactions (
          store_id, organization_id, admin_id, transaction_type, quantity,
          previous_quantity, new_quantity, reason, reference_number, created_at
        ) VALUES (?, ?, ?, 'remove', ?, ?, ?, 'order_fulfillment', ?, NOW())`,
        [product.id, req.organizationId, req.adminId, item.quantity, product.quantity, product.quantity - item.quantity, orderNumber]
      );
    }
    
    await connection.commit();
    
    res.json({
      success: true,
      data: {
        order_id: orderId,
        order_number: orderNumber,
        status: 'processing',
        total: total
      },
      message: 'Order placed successfully'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};

// Get order status
export const getOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, p.status as payment_status
       FROM hardware_orders o
       LEFT JOIN payments p ON o.gateway_transaction_id = p.payment_intent_id
       WHERE o.id = ? AND o.organization_id = ?`,
      [orderId, req.organizationId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    res.json({ success: true, data: orders[0] });
  } catch (error) {
    console.error('Get order status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all orders for organization
export const getOrganizationOrders = async (req, res) => {
  const { status, limit = 50 } = req.query;
  
  try {
    let query = `
      SELECT o.*, COUNT(oi.id) as item_count
      FROM hardware_orders o
      LEFT JOIN hardware_order_items oi ON o.id = oi.order_id
      WHERE o.organization_id = ?
    `;
    const params = [req.organizationId];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const [orders] = await pool.execute(query, params);
    
    // Get items for each order
    for (const order of orders) {
      const [items] = await pool.execute(
        'SELECT * FROM hardware_order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }
    
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to get orders' });
  }
};

// Cancel order
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get order details
    const [orders] = await connection.execute(
      'SELECT * FROM hardware_orders WHERE id = ? AND organization_id = ?',
      [orderId, req.organizationId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = orders[0];
    
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending orders can be cancelled' });
    }
    
    // Get order items to restore stock
    const [items] = await connection.execute(
      'SELECT * FROM hardware_order_items WHERE order_id = ?',
      [orderId]
    );
    
    // Restore stock for each item
    for (const item of items) {
      await connection.execute(
        'UPDATE device_store SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
    
    // Update order status
    await connection.execute(
      'UPDATE hardware_orders SET status = "cancelled", updated_at = NOW() WHERE id = ?',
      [orderId]
    );
    
    await connection.commit();
    
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  } finally {
    connection.release();
  }
};