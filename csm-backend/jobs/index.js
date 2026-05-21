// csms-backend/jobs/index.js
// Main scheduler that runs all jobs

import { startDeviceStatusScheduler, initDeviceStatusCache } from './deviceStatusUpdater.js';
import { startExchangeRateScheduler, initRateCache } from './exchangeRateUpdater.js';

// Initialize all caches
export const initializeAllJobs = async () => {
  console.log('[INIT] Initializing all job caches...');
  
  await initDeviceStatusCache();
  await initRateCache();
  
  console.log('[INIT] All caches initialized');
};

// Start all scheduled jobs
export const startAllSchedulers = () => {
  console.log('[SCHEDULER] Starting all background jobs...');
  
  startDeviceStatusScheduler();
  startExchangeRateScheduler();
  
  console.log('[SCHEDULER] All schedulers are running');
};

// Export all job functions
export * from './deviceStatusUpdater.js';
export * from './exchangeRateUpdater.js';