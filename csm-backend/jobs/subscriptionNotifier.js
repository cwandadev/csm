// csms-backend/jobs/subscriptionNotifier.js
import cron from 'node-cron';
import NotificationService from '../services/notificationService.js';

// Run daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Checking expiring subscriptions...');
  await NotificationService.checkExpiringSubscriptions();
  console.log('[CRON] Subscription check completed');
});

export default cron;