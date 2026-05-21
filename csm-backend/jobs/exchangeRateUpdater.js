// csms-backend/jobs/exchangeRateUpdater.js
// Complete exchange rate updater with notification service integration

import pool from '../config/database.js';
import NotificationService from '../services/notificationService.js';

// Cache for current rates to avoid excessive DB queries
let rateCache = new Map();
let lastRateUpdate = null;

// Free API endpoints (you can switch to paid ones for production)
const API_ENDPOINTS = {
  FIXER: 'https://api.exchangerate-api.com/v4/latest/USD',
  OPEN_EXCHANGE_RATES: 'https://open.er-api.com/v6/latest/USD',
  CURRENCY_API: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
};

// Main function to update all exchange rates
export const updateExchangeRates = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('[JOB] Starting exchange rate update...');
    
    // Fetch latest rates from API
    const rates = await fetchLatestRates();
    
    if (!rates || Object.keys(rates).length === 0) {
      throw new Error('Failed to fetch exchange rates from API');
    }
    
    // Get all currencies from database
    const [currencies] = await connection.execute(
      `SELECT code, name, symbol, rate_to_usd, auto_update_enabled 
       FROM currencies 
       WHERE code != 'USD'`
    );
    
    let updatedCount = 0;
    let rateChanges = [];
    const now = new Date();
    
    for (const currency of currencies) {
      // Skip if auto-update is disabled
      if (currency.auto_update_enabled === 0) {
        console.log(`[JOB] Skipping ${currency.code} - auto-update disabled`);
        continue;
      }
      
      const newRate = rates[currency.code.toLowerCase()] || rates[currency.code];
      
      if (!newRate) {
        console.log(`[JOB] No rate found for ${currency.code}, skipping...`);
        continue;
      }
      
      const oldRate = parseFloat(currency.rate_to_usd);
      const rateDifference = Math.abs(newRate - oldRate);
      const percentChange = (rateDifference / oldRate) * 100;
      
      // Update current rate in currencies table
      await connection.execute(
        `UPDATE currencies 
         SET rate_to_usd = ?, rate_updated_at = NOW(), updated_at = NOW()
         WHERE code = ?`,
        [newRate, currency.code]
      );
      
      // Update rate cache
      rateCache.set(currency.code, {
        rate: newRate,
        updated_at: now
      });
      
      updatedCount++;
      
      // Track significant changes (>2% change)
      if (percentChange > 2) {
        rateChanges.push({
          currency_code: currency.code,
          currency_name: currency.name,
          old_rate: oldRate,
          new_rate: newRate,
          percent_change: percentChange.toFixed(2),
          direction: newRate > oldRate ? 'up' : 'down'
        });
        
        console.log(`[JOB] ${currency.code}: ${oldRate} → ${newRate} (${percentChange.toFixed(2)}% change)`);
      } else {
        console.log(`[JOB] ${currency.code}: ${oldRate} → ${newRate} (minor change)`);
      }
    }
    
    // Update last update timestamp
    lastRateUpdate = now;
    
    await connection.commit();
    
    // Send notifications for significant rate changes
    if (rateChanges.length > 0) {
      await NotificationService.exchangeRateAlert(rateChanges);
    }
    
    console.log(`[JOB] Exchange rate update completed. Updated ${updatedCount} currencies.`);
    
    return { 
      success: true, 
      updatedCount, 
      rateChanges,
      lastUpdate: now
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('[JOB] Exchange rate update error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Fetch latest rates from API with fallback
const fetchLatestRates = async () => {
  // Try multiple APIs in case one fails
  for (const [name, url] of Object.entries(API_ENDPOINTS)) {
    try {
      console.log(`[API] Trying ${name}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CSMS-System/1.0'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Parse different API response formats
      let rates = {};
      
      if (data.rates) {
        // Fixer.io format
        rates = data.rates;
      } else if (data.usd) {
        // Currency-api format
        rates = {};
        for (const [currency, rate] of Object.entries(data.usd)) {
          rates[currency.toUpperCase()] = 1 / rate;
        }
      } else {
        throw new Error('Unknown API response format');
      }
      
      // Always add USD as base
      rates.USD = 1;
      
      console.log(`[API] Successfully fetched rates from ${name}`);
      return rates;
      
    } catch (error) {
      console.log(`[API] ${name} failed:`, error.message);
      continue;
    }
  }
  
  // If all APIs fail, use fallback rates
  console.log('[API] All APIs failed, using fallback rates');
  return getFallbackRates();
};

// Fallback rates in case API is unavailable
const getFallbackRates = () => {
  return {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 148.50,
    CAD: 1.35,
    AUD: 1.52,
    CHF: 0.89,
    CNY: 7.20,
    INR: 83.50,
    RUB: 91.20,
    BRL: 5.05,
    ZAR: 18.90,
    NGN: 1480.00,
    KES: 128.50,
    TZS: 2550.00,
    UGX: 3800.00,
    RWF: 1280.00
  };
};

// Get current exchange rate for a currency
export const getCurrentRate = async (currencyCode, connection = null) => {
  try {
    // Check cache first (cache for 1 hour)
    const cached = rateCache.get(currencyCode);
    if (cached && (new Date() - cached.updated_at) < 60 * 60 * 1000) {
      return cached.rate;
    }
    
    const db = connection || pool;
    const [rows] = await db.execute(
      `SELECT rate_to_usd, rate_updated_at FROM currencies WHERE code = ?`,
      [currencyCode]
    );
    
    if (rows.length === 0) {
      throw new Error(`Currency ${currencyCode} not found`);
    }
    
    const rate = parseFloat(rows[0].rate_to_usd);
    
    // Update cache
    rateCache.set(currencyCode, {
      rate: rate,
      updated_at: new Date()
    });
    
    return rate;
    
  } catch (error) {
    console.error(`[RATE] Error getting rate for ${currencyCode}:`, error);
    return 1; // Default to 1 (USD)
  }
};

// Calculate USD amount from any currency
export const convertToUSD = async (amount, fromCurrency, connection = null) => {
  if (fromCurrency === 'USD') {
    return amount;
  }
  
  const rate = await getCurrentRate(fromCurrency, connection);
  return amount / rate;
};

// Calculate amount in target currency from USD
export const convertFromUSD = async (amountUSD, toCurrency, connection = null) => {
  if (toCurrency === 'USD') {
    return amountUSD;
  }
  
  const rate = await getCurrentRate(toCurrency, connection);
  return amountUSD * rate;
};

// Create transaction with exchange rate stored
export const createTransactionWithRate = async (transactionType, data) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { amount, currency, organization_id, ...rest } = data;
    
    // Get current exchange rate
    const exchangeRate = await getCurrentRate(currency, connection);
    const baseAmountUSD = await convertToUSD(amount, currency, connection);
    
    let tableName, result;
    
    switch (transactionType) {
      case 'invoice':
        [result] = await connection.execute(
          `INSERT INTO invoices 
           (organization_id, amount, currency, exchange_rate, base_amount_usd, base_currency, created_at, ...) 
           VALUES (?, ?, ?, ?, ?, 'USD', NOW(), ...)`,
          [organization_id, amount, currency, exchangeRate, baseAmountUSD]
        );
        break;
        
      case 'payment':
        [result] = await connection.execute(
          `INSERT INTO payments 
           (organization_id, amount, currency, exchange_rate, base_amount_usd, base_currency, created_at) 
           VALUES (?, ?, ?, ?, ?, 'USD', NOW())`,
          [organization_id, amount, currency, exchangeRate, baseAmountUSD]
        );
        break;
        
      case 'subscription':
        [result] = await connection.execute(
          `INSERT INTO subscriptions 
           (organization_id, amount_paid, currency, exchange_rate, base_amount_usd, base_currency, start_date) 
           VALUES (?, ?, ?, ?, ?, 'USD', NOW())`,
          [organization_id, amount, currency, exchangeRate, baseAmountUSD]
        );
        break;
        
      default:
        throw new Error(`Unknown transaction type: ${transactionType}`);
    }
    
    await connection.commit();
    
    return {
      success: true,
      transaction_id: result.insertId,
      exchange_rate: exchangeRate,
      base_amount_usd: baseAmountUSD,
      original_amount: amount,
      original_currency: currency
    };
    
  } catch (error) {
    await connection.rollback();
    console.error(`[TRANSACTION] Error creating ${transactionType}:`, error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Get rate statistics and trends
export const getRateStatistics = async (currencyCode = null) => {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_currencies,
        AVG(rate_to_usd) as avg_rate,
        MIN(rate_to_usd) as min_rate,
        MAX(rate_to_usd) as max_rate,
        SUM(CASE WHEN auto_update_enabled = 1 THEN 1 ELSE 0 END) as auto_update_enabled_count
      FROM currencies
    `;
    
    const params = [];
    if (currencyCode) {
      query = `SELECT * FROM currencies WHERE code = ?`;
      params.push(currencyCode);
    }
    
    const [stats] = await pool.execute(query, params);
    
    return { success: true, data: stats[0] };
    
  } catch (error) {
    console.error('[STATS] Error getting rate statistics:', error);
    return { success: false, error: error.message };
  }
};

// Manual rate override (for admin use)
export const manualRateUpdate = async (currencyCode, newRate, adminId, reason) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get old rate
    const [old] = await connection.execute(
      `SELECT rate_to_usd FROM currencies WHERE code = ?`,
      [currencyCode]
    );
    
    if (old.length === 0) {
      throw new Error(`Currency ${currencyCode} not found`);
    }
    
    const oldRate = old[0].rate_to_usd;
    
    // Update rate
    await connection.execute(
      `UPDATE currencies 
       SET rate_to_usd = ?, rate_updated_at = NOW(), updated_at = NOW(), auto_update_enabled = 0
       WHERE code = ?`,
      [newRate, currencyCode]
    );
    
    // Log manual update
    await connection.execute(
      `INSERT INTO activity_logs 
       (organization_id, admin_id, action, entity_type, entity_id, old_values, new_values, created_at)
       VALUES (NULL, ?, 'manual_rate_update', 'currency', ?, ?, ?, NOW())`,
      [adminId, currencyCode, JSON.stringify({ rate: oldRate }), JSON.stringify({ rate: newRate, reason })]
    );
    
    await connection.commit();
    
    // Update cache
    rateCache.set(currencyCode, {
      rate: newRate,
      updated_at: new Date()
    });
    
    console.log(`[MANUAL] ${currencyCode} rate manually updated: ${oldRate} → ${newRate} by admin ${adminId}`);
    
    return { success: true, oldRate, newRate };
    
  } catch (error) {
    await connection.rollback();
    console.error('[MANUAL] Error updating rate:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Initialize rate cache on startup
export const initRateCache = async () => {
  try {
    const [currencies] = await pool.execute(
      `SELECT code, rate_to_usd FROM currencies WHERE auto_update_enabled = 1 OR code = 'USD'`
    );
    
    const now = new Date();
    for (const currency of currencies) {
      rateCache.set(currency.code, {
        rate: parseFloat(currency.rate_to_usd),
        updated_at: now
      });
    }
    
    console.log(`[CACHE] Initialized rate cache with ${rateCache.size} currencies`);
    return { success: true, count: rateCache.size };
    
  } catch (error) {
    console.error('[CACHE] Error initializing rate cache:', error);
    return { success: false, error: error.message };
  }
};

// Schedule all exchange rate jobs
export const startExchangeRateScheduler = () => {
  // Update rates every 6 hours (or daily for free APIs)
  setInterval(async () => {
    console.log('[SCHEDULER] Running exchange rate update job...');
    await updateExchangeRates();
  }, 6 * 60 * 60 * 1000); // 6 hours
  
  // Log rate statistics every day
  setInterval(async () => {
    const stats = await getRateStatistics();
    if (stats.success && stats.data) {
      console.log(`[STATS] Exchange Rate Summary:`, stats.data);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours
  
  console.log('[SCHEDULER] Exchange rate updater scheduled:');
  console.log('  - Rate update: every 6 hours');
  console.log('  - Stats logging: every 24 hours');
};

// Export all functions
export default {
  updateExchangeRates,
  getCurrentRate,
  convertToUSD,
  convertFromUSD,
  createTransactionWithRate,
  getRateStatistics,
  manualRateUpdate,
  initRateCache,
  startExchangeRateScheduler
};