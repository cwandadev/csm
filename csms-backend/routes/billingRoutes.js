// csms-backend/routes/billingRoutes.js
app.put('/api/billing/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  const { subscription_status, subscription_expires_at, plan_type, billing_cycle } = req.body;
  const organizationId = req.organizationId;
  
  // Verify access
  if (parseInt(orgId) !== parseInt(organizationId)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    // Update organization subscription
    await pool.execute(
      `UPDATE organizations 
       SET subscription_status = ?, 
           subscription_expires_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [subscription_status, subscription_expires_at, orgId]
    );
    
    // Update or create subscription record
    const [existing] = await pool.execute(
      'SELECT id FROM subscriptions WHERE organization_id = ? AND status = "active"',
      [orgId]
    );
    
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE subscriptions 
         SET status = ?, end_date = ?, updated_at = NOW()
         WHERE id = ?`,
        [subscription_status, subscription_expires_at, existing[0].id]
      );
    } else if (subscription_status === 'active') {
      // Get plan ID based on plan_type
      const [plans] = await pool.execute(
        'SELECT id FROM subscription_plans WHERE name = ? LIMIT 1',
        [plan_type?.replace('_admin', '') || 'basic']
      );
      
      if (plans.length > 0) {
        await pool.execute(
          `INSERT INTO subscriptions (
            organization_id, plan_id, billing_cycle, status, amount_paid,
            currency, start_date, end_date, auto_renew, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 0, 'USD', NOW(), ?, 1, NOW(), NOW())`,
          [orgId, plans[0].id, billing_cycle || 'monthly', subscription_status, subscription_expires_at]
        );
      }
    }
    
    res.json({ success: true, message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Billing update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

// Get billing info
app.get('/api/billing/:orgId', authenticateToken, async (req, res) => {
  const { orgId } = req.params;
  const organizationId = req.organizationId;
  
  if (parseInt(orgId) !== parseInt(organizationId)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const [orgs] = await pool.execute(
      `SELECT o.*, s.*, sp.display_name as plan_name, sp.max_users, sp.max_devices
       FROM organizations o
       LEFT JOIN subscriptions s ON o.id = s.organization_id AND s.status = 'active'
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE o.id = ?`,
      [orgId]
    );
    
    res.json({ success: true, data: orgs[0] || null });
  } catch (error) {
    console.error('Get billing info error:', error);
    res.status(500).json({ success: false, error: 'Failed to get billing information' });
  }
});