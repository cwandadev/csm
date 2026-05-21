// csms-backend/controllers/accountController.js

// Schedule account deletion (2 days from now)
export const scheduleDeletion = async (req, res) => {
  const adminId = req.adminId;
  
  try {
    const deletionDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    
    await pool.execute(
      `UPDATE admins 
       SET deletion_scheduled_at = ?, is_active = 0, updated_at = NOW()
       WHERE id = ?`,
      [deletionDate, adminId]
    );
    
    // Send confirmation email
    const [admins] = await pool.execute('SELECT first_name, email FROM admins WHERE id = ?', [adminId]);
    if (admins.length > 0) {
      await emailService.sendDeletionConfirmation(admins[0].email, admins[0].first_name, deletionDate);
    }
    
    res.json({ success: true, message: 'Account deletion scheduled', data: { scheduled_date: deletionDate } });
  } catch (error) {
    console.error('Schedule deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule deletion' });
  }
};

// Cancel scheduled deletion
export const cancelDeletion = async (req, res) => {
  const adminId = req.adminId;
  
  try {
    await pool.execute(
      'UPDATE admins SET deletion_scheduled_at = NULL, is_active = 1, updated_at = NOW() WHERE id = ?',
      [adminId]
    );
    
    res.json({ success: true, message: 'Deletion cancelled' });
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel deletion' });
  }
};

// Get deletion status
export const getDeletionStatus = async (req, res) => {
  const adminId = req.adminId;
  
  try {
    const [admins] = await pool.execute(
      'SELECT deletion_scheduled_at FROM admins WHERE id = ?',
      [adminId]
    );
    
    const scheduledDate = admins[0]?.deletion_scheduled_at;
    res.json({ 
      success: true, 
      data: { 
        pending: !!scheduledDate,
        scheduled_date: scheduledDate
      } 
    });
  } catch (error) {
    console.error('Get deletion status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get deletion status' });
  }
};