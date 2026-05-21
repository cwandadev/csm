// csms-backend/routes/reportRoutes.js
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import moment from 'moment';

const router = express.Router();

// ============ DAILY ATTENDANCE REPORT ============
router.get('/daily_attendance', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  const { date, format = 'csv', start_date, end_date } = req.query;
  
  try {
    const reportDate = date || moment().format('YYYY-MM-DD');
    const startDate = start_date || reportDate;
    const endDateParam = end_date || reportDate;
    
    // Fetch attendance data
    const [attendance] = await pool.execute(
      `SELECT 
        a.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.card_uid,
        a.timestamp as check_in_time,
        a.method as attendance_method,
        a.status,
        a.notes,
        d.device_name,
        a.created_at
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN devices d ON a.device_id = d.id
      WHERE a.organization_id = ? AND DATE(a.timestamp) BETWEEN ? AND ?
      ORDER BY a.timestamp DESC`,
      [organizationId, startDate, endDateParam]
    );
    
    // Get daily summary - using date column from attendance_daily_summary
    const [dailySummary] = await pool.execute(
      `SELECT 
        COUNT(DISTINCT user_id) as total_attendees,
        SUM(CASE WHEN status IN ('present', 'check_in') THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        AVG(total_work_minutes) as avg_work_minutes
      FROM attendance_daily_summary
      WHERE organization_id = ? AND date BETWEEN ? AND ?`,
      [organizationId, startDate, endDateParam]
    );
    
    // Get method distribution
    const [methodStats] = await pool.execute(
      `SELECT method, COUNT(*) as count
      FROM attendance
      WHERE organization_id = ? AND DATE(timestamp) BETWEEN ? AND ?
      GROUP BY method`,
      [organizationId, startDate, endDateParam]
    );
    
    const reportData = {
      generated_at: new Date().toISOString(),
      report_date: reportDate,
      date_range: { start: startDate, end: endDateParam },
      summary: {
        total_records: attendance.length,
        total_attendees: dailySummary[0]?.total_attendees || 0,
        present: dailySummary[0]?.present_count || 0,
        absent: dailySummary[0]?.absent_count || 0,
        late: dailySummary[0]?.late_count || 0,
        avg_work_minutes: Math.round(dailySummary[0]?.avg_work_minutes || 0),
        by_method: methodStats.reduce((acc, m) => {
          acc[m.method] = m.count;
          return acc;
        }, {})
      },
      records: attendance
    };
    
    if (format === 'pdf') {
      await generatePDF(reportData, 'daily_attendance', res);
    } else if (format === 'excel') {
      await generateExcel(reportData, 'daily_attendance', res);
    } else {
      await generateCSV(attendance, 'daily_attendance', res);
    }
  } catch (error) {
    console.error('Daily attendance report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ MONTHLY ANALYTICS REPORT ============
router.get('/monthly_analytics', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  const { month, year, format = 'json', start_date, end_date } = req.query;
  
  try {
    let targetMonth = month;
    let targetYear = year;
    let startDate = start_date;
    let endDate = end_date;
    
    // If using month/year parameters instead of date range
    if (!startDate && !endDate && month && year) {
      targetMonth = parseInt(month);
      targetYear = parseInt(year);
      // Use the monthly summary table with year/month columns
      
      // Get monthly attendance summary from attendance_monthly_summary using year/month
      const [monthlySummary] = await pool.execute(
        `SELECT 
          user_id,
          total_present_days as total_present,
          total_absent_days as total_absent,
          total_late_days as total_late,
          total_half_days as total_half,
          total_work_minutes as total_work,
          total_overtime_minutes as total_overtime,
          attendance_percentage as avg_attendance
        FROM attendance_monthly_summary
        WHERE organization_id = ? AND year = ? AND month = ?`,
        [organizationId, targetYear, targetMonth]
      );
      
      // Get daily trend from attendance_daily_summary for the month
      const startOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const endOfMonth = moment(startOfMonth).endOf('month').format('YYYY-MM-DD');
      
      const [dailyTrend] = await pool.execute(
        `SELECT 
          date,
          COUNT(DISTINCT user_id) as total_attendance,
          SUM(CASE WHEN status IN ('present', 'check_in') THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          AVG(total_work_minutes) as avg_work_minutes
        FROM attendance_daily_summary
        WHERE organization_id = ? AND date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC`,
        [organizationId, startOfMonth, endOfMonth]
      );
      
      // Get user statistics
      const [userStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as total_students,
          SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as total_employees,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
        FROM users
        WHERE organization_id = ?`,
        [organizationId]
      );
      
      // Get device statistics
      const [deviceStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_devices,
          SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_devices
        FROM devices
        WHERE organization_id = ?`,
        [organizationId]
      );
      
      const reportData = {
        generated_at: new Date().toISOString(),
        period: `${moment().month(targetMonth - 1).format('MMMM')} ${targetYear}`,
        user_statistics: userStats[0],
        device_statistics: deviceStats[0],
        monthly_summary: monthlySummary,
        daily_trend: dailyTrend,
        summary: {
          total_users: userStats[0]?.total_users || 0,
          total_attendance_records: monthlySummary.reduce((sum, u) => sum + (u.total_present || 0), 0),
          average_attendance_rate: monthlySummary.length > 0 
            ? (monthlySummary.reduce((sum, u) => sum + parseFloat(u.avg_attendance || 0), 0) / monthlySummary.length).toFixed(2)
            : 0,
          total_overtime_hours: Math.floor(monthlySummary.reduce((sum, u) => sum + (u.total_overtime || 0), 0) / 60)
        }
      };
      
      if (format === 'pdf') {
        await generatePDF(reportData, 'monthly_analytics', res);
      } else if (format === 'excel') {
        await generateExcel(reportData, 'monthly_analytics', res);
      } else {
        res.json({ success: true, data: reportData });
      }
    } else {
      // Using date range
      const [monthlySummary] = await pool.execute(
        `SELECT 
          user_id,
          SUM(total_present_days) as total_present,
          SUM(total_absent_days) as total_absent,
          SUM(total_late_days) as total_late,
          SUM(total_work_minutes) as total_work,
          AVG(attendance_percentage) as avg_attendance
        FROM attendance_monthly_summary
        WHERE organization_id = ? AND year BETWEEN YEAR(?) AND YEAR(?)
        GROUP BY user_id`,
        [organizationId, startDate, endDate]
      );
      
      const [dailyTrend] = await pool.execute(
        `SELECT 
          date,
          COUNT(DISTINCT user_id) as total_attendance,
          SUM(CASE WHEN status IN ('present', 'check_in') THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          AVG(total_work_minutes) as avg_work_minutes
        FROM attendance_daily_summary
        WHERE organization_id = ? AND date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC`,
        [organizationId, startDate, endDate]
      );
      
      const [userStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as total_students,
          SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as total_employees,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
        FROM users
        WHERE organization_id = ?`,
        [organizationId]
      );
      
      const [deviceStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_devices,
          SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_devices
        FROM devices
        WHERE organization_id = ?`,
        [organizationId]
      );
      
      const reportData = {
        generated_at: new Date().toISOString(),
        period: `${moment(startDate).format('MMMM YYYY')} - ${moment(endDate).format('MMMM YYYY')}`,
        user_statistics: userStats[0],
        device_statistics: deviceStats[0],
        daily_trend: dailyTrend,
        summary: {
          total_users: userStats[0]?.total_users || 0,
          total_attendance_records: dailyTrend.reduce((sum, d) => sum + d.total_attendance, 0),
          average_daily_attendance: dailyTrend.length > 0 
            ? (dailyTrend.reduce((sum, d) => sum + d.total_attendance, 0) / dailyTrend.length).toFixed(2)
            : 0
        }
      };
      
      if (format === 'pdf') {
        await generatePDF(reportData, 'monthly_analytics', res);
      } else if (format === 'excel') {
        await generateExcel(reportData, 'monthly_analytics', res);
      } else {
        res.json({ success: true, data: reportData });
      }
    }
  } catch (error) {
    console.error('Monthly analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ USER ACTIVITY REPORT ============
router.get('/user_activity', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  const { start_date, end_date, search, format = 'excel' } = req.query;
  
  try {
    let query = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.card_uid,
        u.is_active,
        COUNT(a.id) as total_attendance,
        SUM(CASE WHEN a.status IN ('check_in', 'present') THEN 1 ELSE 0 END) as total_checkins,
        SUM(CASE WHEN a.status = 'check_out' THEN 1 ELSE 0 END) as total_checkouts,
        MIN(a.timestamp) as first_activity,
        MAX(a.timestamp) as last_activity
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id
      WHERE u.organization_id = ?
    `;
    
    const params = [organizationId];
    
    if (start_date && end_date) {
      query += ` AND DATE(a.timestamp) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }
    
    if (search) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ` GROUP BY u.id ORDER BY total_attendance DESC`;
    
    const [userActivities] = await pool.execute(query, params);
    
    const reportData = {
      generated_at: new Date().toISOString(),
      date_range: { start_date, end_date },
      search_term: search || null,
      summary: {
        total_active_users: userActivities.filter(u => u.total_attendance > 0).length,
        total_attendance_records: userActivities.reduce((sum, u) => sum + u.total_attendance, 0),
        average_attendance_per_user: userActivities.length > 0 
          ? (userActivities.reduce((sum, u) => sum + u.total_attendance, 0) / userActivities.length).toFixed(2)
          : 0
      },
      user_activities: userActivities
    };
    
    if (format === 'pdf') {
      await generatePDF(reportData, 'user_activity', res);
    } else if (format === 'excel') {
      await generateExcel(reportData, 'user_activity', res);
    } else {
      await generateCSV(userActivities, 'user_activity', res);
    }
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ DEVICE HEALTH REPORT ============
router.get('/device_health', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  const { format = 'pdf' } = req.query;
  
  try {
    const [devices] = await pool.execute(
      `SELECT 
        d.id,
        d.device_name,
        d.device_type,
        d.unique_device_id,
        d.is_online,
        d.status,
        d.last_seen,
        d.firmware_version,
        COUNT(a.id) as total_attendance_records,
        MAX(a.timestamp) as last_activity
      FROM devices d
      LEFT JOIN attendance a ON d.id = a.device_id
      WHERE d.organization_id = ?
      GROUP BY d.id
      ORDER BY d.is_online DESC, d.device_name ASC`,
      [organizationId]
    );
    
    const healthSummary = {
      total_devices: devices.length,
      online_devices: devices.filter(d => d.is_online === 1).length,
      offline_devices: devices.filter(d => d.is_online === 0 && d.status === 'active').length,
      lost_devices: devices.filter(d => d.status === 'lost').length,
      devices_by_type: {
        ESP32: devices.filter(d => d.device_type === 'ESP32').length,
        ESP8266: devices.filter(d => d.device_type === 'ESP8266').length
      },
      total_attendance_processed: devices.reduce((sum, d) => sum + d.total_attendance_records, 0)
    };
    
    const reportData = {
      generated_at: new Date().toISOString(),
      health_summary: healthSummary,
      devices: devices.map(device => ({
        ...device,
        health_status: device.is_online ? 'Good' : device.status === 'lost' ? 'Critical' : 'Warning',
        last_seen_hours: device.last_seen ? moment().diff(moment(device.last_seen), 'hours') : null
      }))
    };
    
    if (format === 'pdf') {
      await generatePDF(reportData, 'device_health', res);
    } else if (format === 'excel') {
      await generateExcel(reportData, 'device_health', res);
    } else {
      res.json({ success: true, data: reportData });
    }
  } catch (error) {
    console.error('Device health error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ ACCOUNT ACTIVITY REPORT ============
router.get('/account_activity', authenticateToken, async (req, res) => {
  const organizationId = req.organizationId;
  const { start_date, end_date, format = 'pdf' } = req.query;
  
  try {
    const [adminActivities] = await pool.execute(
      `SELECT 
        al.id,
        al.admin_id,
        CONCAT(a.first_name, ' ', a.last_name) as admin_name,
        a.email,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip_address,
        al.created_at
      FROM activity_logs al
      JOIN admins a ON al.admin_id = a.id
      WHERE a.organization_id = ?
      ${start_date && end_date ? 'AND DATE(al.created_at) BETWEEN ? AND ?' : ''}
      ORDER BY al.created_at DESC
      LIMIT 1000`,
      start_date && end_date ? [organizationId, start_date, end_date] : [organizationId]
    );
    
    const reportData = {
      generated_at: new Date().toISOString(),
      date_range: { start_date, end_date },
      summary: {
        total_activities: adminActivities.length,
        unique_admins_active: [...new Set(adminActivities.map(a => a.admin_id))].length,
        actions_by_type: adminActivities.reduce((acc, action) => {
          acc[action.action] = (acc[action.action] || 0) + 1;
          return acc;
        }, {})
      },
      admin_activities: adminActivities
    };
    
    if (format === 'pdf') {
      await generatePDF(reportData, 'account_activity', res);
    } else if (format === 'excel') {
      await generateExcel(reportData, 'account_activity', res);
    } else {
      await generateCSV(adminActivities, 'account_activity', res);
    }
  } catch (error) {
    console.error('Account activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ PDF GENERATION ============
async function generatePDF(data, reportType, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `${reportType}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.pdf`;
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);
  
  // Header
  doc.fontSize(20).text('CSMS Report', { align: 'center' });
  doc.fontSize(14).text(reportType.replace(/_/g, ' ').toUpperCase(), { align: 'center' });
  doc.fontSize(10).text(`Generated: ${data.generated_at}`, { align: 'center' });
  doc.moveDown();
  
  // Summary section
  if (data.summary) {
    doc.fontSize(12).text('Summary', { underline: true });
    doc.moveDown(0.5);
    Object.entries(data.summary).forEach(([key, value]) => {
      if (typeof value === 'object') {
        doc.fontSize(10).text(`${key.replace(/_/g, ' ').toUpperCase()}:`);
        Object.entries(value).forEach(([subKey, subValue]) => {
          doc.fontSize(10).text(`  - ${subKey}: ${subValue}`, { indent: 20 });
        });
      } else {
        doc.fontSize(10).text(`${key.replace(/_/g, ' ')}: ${value}`);
      }
    });
    doc.moveDown();
  }
  
  // Data table
  let records = data.records || data.user_activities || data.devices || data.daily_trend || [];
  if (records && records.length > 0) {
    doc.fontSize(12).text('Detailed Records', { underline: true });
    doc.moveDown(0.5);
    
    const headers = Object.keys(records[0]).slice(0, 6);
    let yPosition = doc.y;
    let xPosition = 50;
    const colWidths = Array(headers.length).fill(80);
    
    headers.forEach((header, i) => {
      doc.fontSize(8).text(header.replace(/_/g, ' ').substring(0, 15), xPosition, yPosition, { width: colWidths[i] });
      xPosition += colWidths[i];
    });
    
    yPosition += 15;
    
    for (const record of records.slice(0, 30)) {
      if (yPosition > 750) {
        doc.addPage();
        yPosition = 50;
        xPosition = 50;
        headers.forEach((header, i) => {
          doc.fontSize(8).text(header.replace(/_/g, ' ').substring(0, 15), xPosition, yPosition, { width: colWidths[i] });
          xPosition += colWidths[i];
        });
        yPosition += 15;
      }
      
      xPosition = 50;
      headers.forEach((header, i) => {
        let value = record[header];
        if (value instanceof Date) value = moment(value).format('YYYY-MM-DD HH:mm');
        if (typeof value === 'object') value = JSON.stringify(value).substring(0, 20);
        doc.fontSize(7).text(String(value || '-').substring(0, 20), xPosition, yPosition, { width: colWidths[i] });
        xPosition += colWidths[i];
      });
      yPosition += 12;
    }
  }
  
  doc.end();
}

// ============ EXCEL GENERATION ============
async function generateExcel(data, reportType, res) {
  const workbook = new ExcelJS.Workbook();
  const filename = `${reportType}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.getCell('A1').value = 'CSMS Report Summary';
  summarySheet.getCell('A1').font = { bold: true, size: 14 };
  summarySheet.getCell('A3').value = 'Report Type:';
  summarySheet.getCell('B3').value = reportType.replace(/_/g, ' ');
  summarySheet.getCell('A4').value = 'Generated:';
  summarySheet.getCell('B4').value = data.generated_at;
  
  let row = 6;
  if (data.summary) {
    summarySheet.getCell(`A${row}`).value = 'Summary Statistics';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    Object.entries(data.summary).forEach(([key, value]) => {
      if (typeof value === 'object') {
        summarySheet.getCell(`A${row}`).value = key.replace(/_/g, ' ').toUpperCase();
        row++;
        Object.entries(value).forEach(([subKey, subValue]) => {
          summarySheet.getCell(`A${row}`).value = `  ${subKey}`;
          summarySheet.getCell(`B${row}`).value = subValue;
          row++;
        });
      } else {
        summarySheet.getCell(`A${row}`).value = key.replace(/_/g, ' ');
        summarySheet.getCell(`B${row}`).value = value;
        row++;
      }
    });
  }
  
  // Data Sheet
  let records = data.records || data.user_activities || data.devices || data.daily_trend || [];
  if (records && records.length > 0) {
    const dataSheet = workbook.addWorksheet('Data');
    const headers = Object.keys(records[0]);
    
    headers.forEach((header, colIndex) => {
      dataSheet.getCell(1, colIndex + 1).value = header.replace(/_/g, ' ').toUpperCase();
      dataSheet.getCell(1, colIndex + 1).font = { bold: true };
    });
    
    records.forEach((record, rowIndex) => {
      headers.forEach((header, colIndex) => {
        let value = record[header];
        if (value instanceof Date) value = moment(value).format('YYYY-MM-DD HH:mm:ss');
        if (typeof value === 'object') value = JSON.stringify(value);
        dataSheet.getCell(rowIndex + 2, colIndex + 1).value = value;
      });
    });
    
    dataSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) maxLength = columnLength;
      });
      column.width = Math.min(maxLength + 2, 30);
    });
  }
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  await workbook.xlsx.write(res);
  res.end();
}

// ============ CSV GENERATION ============
async function generateCSV(data, reportType, res) {
  const filename = `${reportType}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  
  if (!data || data.length === 0) {
    res.write('No data available\n');
    res.end();
    return;
  }
  
  const headers = Object.keys(data[0]);
  res.write(headers.join(',') + '\n');
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return moment(value).format('YYYY-MM-DD HH:mm:ss');
      if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    res.write(values.join(',') + '\n');
  });
  
  res.end();
}

export default router;