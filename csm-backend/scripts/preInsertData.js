// csms-backend/scripts/preInsertData.js
// Run this script when creating a new organization

import pool from '../config/database.js';
import NotificationService from '../services/notificationService.js';

export const preInsertOrganizationData = async (organizationId, adminId) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log(`[PRE-INSERT] Setting up data for organization ${organizationId}...`);
    
    // 1. Insert default attendance types
    const attendanceTypes = [
      { name: 'Present', description: 'Regular attendance', color: '#10b981', requires_check_out: 1, affects_percentage: 1, is_paid: 1, sort_order: 1 },
      { name: 'Absent', description: 'No attendance recorded', color: '#ef4444', requires_check_out: 0, affects_percentage: 1, is_paid: 0, sort_order: 2 },
      { name: 'Late', description: 'Arrived after scheduled time', color: '#f59e0b', requires_check_out: 1, affects_percentage: 1, is_paid: 1, sort_order: 3 },
      { name: 'Half Day', description: 'Left early or arrived late significantly', color: '#8b5cf6', requires_check_out: 1, affects_percentage: 1, is_paid: 1, sort_order: 4 },
      { name: 'Holiday', description: 'Official holiday', color: '#3b82f6', requires_check_out: 0, affects_percentage: 0, is_paid: 1, sort_order: 5 },
      { name: 'Weekend', description: 'Weekend day', color: '#6b7280', requires_check_out: 0, affects_percentage: 0, is_paid: 0, sort_order: 6 },
      { name: 'Leave', description: 'Approved leave', color: '#06b6d4', requires_check_out: 0, affects_percentage: 0, is_paid: 1, sort_order: 7 },
      { name: 'Sick', description: 'Sick leave', color: '#ec4899', requires_check_out: 0, affects_percentage: 0, is_paid: 1, sort_order: 8 }
    ];
    
    for (const type of attendanceTypes) {
      await connection.execute(
        `INSERT INTO attendance_types 
         (organization_id, name, description, color, requires_check_out, 
          affects_attendance_percentage, is_paid, sort_order, is_active, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
        [organizationId, type.name, type.description, type.color, type.requires_check_out,
         type.affects_percentage, type.is_paid, type.sort_order, adminId]
      );
    }
    console.log(`[PRE-INSERT] Added ${attendanceTypes.length} attendance types`);
    
    // 2. Insert default departments
    const departments = [
      { name: 'Administration', description: 'Administrative staff and management' },
      { name: 'Teaching', description: 'Teaching staff and instructors' },
      { name: 'Support Staff', description: 'Support and operational staff' },
      { name: 'Maintenance', description: 'Facilities and equipment maintenance' },
      { name: 'Security', description: 'Security personnel' },
      { name: 'IT Department', description: 'Information technology staff' }
    ];
    
    for (const dept of departments) {
      await connection.execute(
        `INSERT INTO departments 
         (organization_id, name, description, created_by, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [organizationId, dept.name, dept.description, adminId]
      );
    }
    console.log(`[PRE-INSERT] Added ${departments.length} departments`);
    
    // 3. Insert default positions
    const positions = [
      { name: 'Manager', department: 'Administration' },
      { name: 'Supervisor', department: 'Administration' },
      { name: 'Teacher', department: 'Teaching' },
      { name: 'Assistant Teacher', department: 'Teaching' },
      { name: 'Accountant', department: 'Administration' },
      { name: 'Cleaner', department: 'Support Staff' },
      { name: 'Security Guard', department: 'Security' },
      { name: 'IT Support', department: 'IT Department' },
      { name: 'Technician', department: 'Maintenance' }
    ];
    
    for (const pos of positions) {
      const [dept] = await connection.execute(
        `SELECT id FROM departments WHERE organization_id = ? AND name = ?`,
        [organizationId, pos.department]
      );
      
      if (dept.length > 0) {
        await connection.execute(
          `INSERT INTO positions 
           (organization_id, department_id, name, created_by, is_active, created_at)
           VALUES (?, ?, ?, ?, 1, NOW())`,
          [organizationId, dept[0].id, pos.name, adminId]
        );
      }
    }
    console.log(`[PRE-INSERT] Added ${positions.length} positions`);
    
    // 4. Insert default sections (for schools)
    const sections = [
      { name: 'Early Years', description: 'Pre-school and kindergarten' },
      { name: 'Primary', description: 'Primary school (Grades 1-7)' },
      { name: 'Secondary', description: 'Secondary school (Grades 8-12)' },
      { name: 'Higher Education', description: 'College and university' }
    ];
    
    for (const section of sections) {
      await connection.execute(
        `INSERT INTO sections 
         (organization_id, name, description, created_by, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [organizationId, section.name, section.description, adminId]
      );
    }
    console.log(`[PRE-INSERT] Added ${sections.length} sections`);
    
    // 5. Insert notification preferences for the admin
    await connection.execute(
      `INSERT INTO notification_preferences 
       (admin_id, organization_id, push_enabled, email_enabled, sound_enabled, created_at, updated_at)
       VALUES (?, ?, 1, 1, 1, NOW(), NOW())`,
      [adminId, organizationId]
    );
    console.log(`[PRE-INSERT] Set notification preferences`);
    
    // 6. Create welcome notification
    await NotificationService.welcomeNewOrganization(organizationId, adminId);
    
    await connection.commit();
    
    console.log(`[PRE-INSERT] Successfully set up all default data for organization ${organizationId}`);
    return { success: true };
    
  } catch (error) {
    await connection.rollback();
    console.error('[PRE-INSERT] Error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Main function to run when creating a new organization
export const setupNewOrganization = async (organizationId, adminId) => {
  const result = await preInsertOrganizationData(organizationId, adminId);
  
  if (result.success) {
    console.log(`✅ New organization ${organizationId} setup complete!`);
  } else {
    console.error(`❌ Failed to setup organization ${organizationId}:`, result.error);
  }
  
  return result;
};