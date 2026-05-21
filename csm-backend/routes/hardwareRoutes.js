// csms-backend/routes/hardwareRoutes.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import stripe from '../config/stripe.js';

const router = express.Router();

// Product SKU mapping
const PRODUCT_SKU_MAPPING = {
  'FP-CARD-001': 'FP-CARD-001',
  'FP-ONLY-002': 'FP-ONLY-002',
  'CSM-CASE-001': 'CSM-CASE-001',
  'CSM-STAND-001': 'CSM-STAND-001',
  'CSM-POWER-001': 'CSM-POWER-001'
};

// Get all hardware products
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.execute(
      `SELECT id, product_name, product_sku, category, quantity, 
              unit_price, purchase_price, status, notes, created_at
       FROM device_store 
       WHERE status != 'discontinued' 
       ORDER BY category, unit_price`
    );
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, error: 'Failed to get products' });
  }
});

// Get product by ID or SKU
router.get('/products/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  
  try {
    let [products] = await pool.execute(
      'SELECT * FROM device_store WHERE id = ? OR product_sku = ?',
      [productId, productId]
    );
    
    if (products.length === 0 && PRODUCT_SKU_MAPPING[productId]) {
      [products] = await pool.execute(
        'SELECT * FROM device_store WHERE product_sku = ?',
        [PRODUCT_SKU_MAPPING[productId]]
      );
    }
    
    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: products[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, error: 'Failed to get product' });
  }
});

// Create Stripe payment intent
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  const { amount, currency = 'usd', orderData } = req.body;
  
  console.log('Creating payment intent for amount:', amount);
  
  try {
    const [orgs] = await pool.execute(
      'SELECT stripe_customer_id, contact_email, org_name FROM organizations WHERE id = ?',
      [req.organizationId]
    );
    
    let customerId = orgs[0]?.stripe_customer_id;
    
    if (!customerId && orgs[0]?.contact_email) {
      const customer = await stripe.customers.create({
        email: orgs[0].contact_email,
        name: orgs[0].org_name,
        metadata: { organization_id: req.organizationId }
      });
      customerId = customer.id;
      
      await pool.execute(
        'UPDATE organizations SET stripe_customer_id = ? WHERE id = ?',
        [customerId, req.organizationId]
      );
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: {
        organization_id: req.organizationId.toString(),
        type: 'hardware_purchase'
      },
      automatic_payment_methods: { enabled: true },
    });
    
    await pool.execute(
      `INSERT INTO payments (
        organization_id, amount, currency, status, payment_intent_id, 
        gateway, created_at
      ) VALUES (?, ?, ?, 'pending', ?, 'stripe', NOW())`,
      [req.organizationId, amount, currency, paymentIntent.id]
    );
    
    console.log('Payment intent created:', paymentIntent.id);
    
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
});

// Create hardware order with payment - NO ORGANIZATION FILTER FOR PRODUCTS
router.post('/orders', authenticateToken, async (req, res) => {
  const {
    organization_id,
    items,
    subtotal,
    delivery_cost,
    tax,
    total,
    delivery_method,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    payment_intent_id
  } = req.body;
  
  console.log('Received order request:', { 
    organization_id, 
    itemsCount: items?.length, 
    subtotal, 
    total, 
    delivery_method, 
    customer_name,
    payment_intent_id 
  });
  
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: 'No items in order' });
  }
  
  // Only check that payment_intent_id exists
  if (!payment_intent_id) {
    return res.status(400).json({ success: false, error: 'Payment required. Please complete payment first.' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const shippingAddressValue = delivery_address || (delivery_method === 'pickup' ? 'Self Pickup - CSM Kigali Office' : null);
    
    // Insert order
    const [orderResult] = await connection.execute(
      `INSERT INTO hardware_orders (
        order_number, organization_id, admin_id, status, subtotal, shipping_cost,
        tax, total, shipping_method, customer_name, customer_email, customer_phone,
        shipping_address, payment_status, payment_gateway, gateway_transaction_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'stripe', ?, NOW(), NOW())`,
      [
        orderNumber,
        organization_id || req.organizationId,
        req.adminId,
        subtotal || 0,
        delivery_cost || 0,
        tax || 0,
        total || 0,
        delivery_method || null,
        customer_name || null,
        customer_email || null,
        customer_phone || null,
        shippingAddressValue,
        payment_intent_id
      ]
    );
    
    const orderId = orderResult.insertId;
    
    // Update payment record
    await connection.execute(
      'UPDATE payments SET invoice_id = NULL, status = "success", paid_at = NOW() WHERE payment_intent_id = ?',
      [payment_intent_id]
    );
    
    // Create order items and update stock - NO organization filter
    for (const item of items) {
      console.log('Searching for product:', item.product_id, item.product_name);
      
      // Search WITHOUT any organization filter - get ALL products
      let [products] = await connection.execute(
        `SELECT * FROM device_store WHERE product_sku = ? OR product_name = ? OR product_name LIKE ?`,
        [item.product_id, item.product_name, `%${item.product_name}%`]
      );
      
      if (products.length === 0) {
        // Get all products to debug
        const [allProducts] = await connection.execute(`SELECT id, product_name, product_sku, organization_id FROM device_store`);
        console.log('All products in database:', allProducts);
        throw new Error(`Product "${item.product_name}" not found. Available products: ${allProducts.map(p => p.product_name).join(', ')}`);
      }
      
      const product = products[0];
      console.log('Found product:', product.product_name, 'Stock:', product.quantity);
      
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.product_name}. Available: ${product.quantity}`);
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
        [product.id, organization_id || req.organizationId, req.adminId, item.quantity, product.quantity, product.quantity - item.quantity, orderNumber]
      );
    }
    
    await connection.commit();
    
    console.log(`Order created successfully: ${orderNumber}`);
    
    res.json({
      success: true,
      data: {
        order_id: orderId,
        order_number: orderNumber,
        status: 'processing',
        total: total
      },
      message: 'Order placed successfully!'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create order' });
  } finally {
    connection.release();
  }
});

// Get order history
router.get('/orders', authenticateToken, requireOrganization, async (req, res) => {
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
});

// Get single order
router.get('/orders/:orderId', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  
  try {
    const [orders] = await pool.execute(
      `SELECT o.*, 
              oi.id as item_id, oi.product_name, oi.quantity, oi.unit_price, oi.total_price as item_total
       FROM hardware_orders o
       LEFT JOIN hardware_order_items oi ON o.id = oi.order_id
       WHERE o.id = ? AND (o.organization_id = ? OR o.admin_id = ?)`,
      [orderId, req.organizationId, req.adminId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = {
      id: orders[0].id,
      order_number: orders[0].order_number,
      status: orders[0].status,
      subtotal: orders[0].subtotal,
      shipping_cost: orders[0].shipping_cost,
      tax: orders[0].tax,
      total: orders[0].total,
      shipping_method: orders[0].shipping_method,
      customer_name: orders[0].customer_name,
      customer_email: orders[0].customer_email,
      customer_phone: orders[0].customer_phone,
      shipping_address: orders[0].shipping_address,
      created_at: orders[0].created_at,
      items: []
    };
    
    for (const row of orders) {
      if (row.item_id) {
        order.items.push({
          id: row.item_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.item_total
        });
      }
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, error: 'Failed to get order' });
  }
});

// Cancel order
router.put('/orders/:orderId/cancel', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const [orders] = await connection.execute(
      'SELECT * FROM hardware_orders WHERE id = ? AND (organization_id = ? OR admin_id = ?)',
      [orderId, req.organizationId, req.adminId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const order = orders[0];
    
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending orders can be cancelled' });
    }
    
    const [items] = await connection.execute(
      'SELECT * FROM hardware_order_items WHERE order_id = ?',
      [orderId]
    );
    
    for (const item of items) {
      await connection.execute(
        'UPDATE device_store SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
    
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
});

// Get shipping cost estimate
router.post('/shipping/estimate', authenticateToken, async (req, res) => {
  const { subtotal, country, city } = req.body;
  
  try {
    let shippingCost = 5;
    
    if (subtotal >= 500) {
      shippingCost = 0;
    } else if (country !== 'Rwanda') {
      shippingCost = 25;
    } else if (city && city.toLowerCase() !== 'kigali') {
      shippingCost = 10;
    }
    
    const options = [
      {
        id: 'standard',
        name: 'Standard Shipping',
        price: shippingCost,
        estimatedDays: shippingCost === 0 ? '5-7 business days' : (shippingCost === 25 ? '10-15 business days' : '5-7 business days'),
        description: shippingCost === 0 ? 'Free shipping on orders over $500' : 'Tracked delivery'
      },
      {
        id: 'express',
        name: 'Express Shipping',
        price: shippingCost + 10,
        estimatedDays: '2-3 business days',
        description: 'Priority processing'
      }
    ];
    
    res.json({ success: true, data: options });
  } catch (error) {
    console.error('Shipping estimate error:', error);
    res.status(500).json({ success: false, error: 'Failed to estimate shipping' });
  }
});

// Admin: Get all orders
router.get('/admin/orders', authenticateToken, async (req, res) => {
  const [admin] = await pool.execute(
    'SELECT role_level FROM admins WHERE id = ?',
    [req.adminId]
  );
  
  if (admin.length === 0 || admin[0].role_level !== 1) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  
  const { status, startDate, endDate, limit = 100 } = req.query;
  
  try {
    let query = `
      SELECT o.*, oi.product_name, oi.quantity, oi.unit_price,
             org.org_name as organization_name
      FROM hardware_orders o
      LEFT JOIN hardware_order_items oi ON o.id = oi.order_id
      LEFT JOIN organizations org ON o.organization_id = org.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      query += ' AND o.created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND o.created_at <= ?';
      params.push(endDate);
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const [orders] = await pool.execute(query, params);
    
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to get orders' });
  }
});

// Admin: Update order status
router.put('/admin/orders/:orderId/status', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const { status, tracking_number } = req.body;
  
  const [admin] = await pool.execute(
    'SELECT role_level FROM admins WHERE id = ?',
    [req.adminId]
  );
  
  if (admin.length === 0 || admin[0].role_level !== 1) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  
  const allowedStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  
  try {
    await pool.execute(
      `UPDATE hardware_orders 
       SET status = ?, tracking_number = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, tracking_number || null, orderId]
    );
    
    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Get product stock levels
router.get('/stock', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const [stock] = await pool.execute(
      `SELECT id, product_name, product_sku, category, quantity, minimum_stock, status
       FROM device_store 
       WHERE organization_id = ?
       ORDER BY quantity ASC`,
      [req.organizationId]
    );
    
    res.json({ success: true, data: stock });
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stock levels' });
  }
});

export default router;