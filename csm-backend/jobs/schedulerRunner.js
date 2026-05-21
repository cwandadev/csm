// Separate runner for production
import { initializeAllJobs, startAllSchedulers } from './index.js';

const run = async () => {
  console.log('🚀 Starting CSMS Job Scheduler...');
  
  await initializeAllJobs();
  startAllSchedulers();
  
  console.log('✅ Job scheduler is running. Press Ctrl+C to stop.');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('🛑 Stopping job scheduler...');
    process.exit(0);
  });
};

run();