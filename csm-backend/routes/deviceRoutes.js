// csms-backend/routes/deviceRoutes.js

import express from 'express';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import {
  getDevices,
  getDeviceById,
  addDevice,
  updateDevice,
  deleteDevice,
  updateDeviceStatus,
  getDeviceStatusHistory,
  getDeviceLocations,
  recordDeviceLocation,
  updateWifiCredentials,
  getWifiCredentials,
  getDeviceStats
} from '../controllers/deviceController.js';

const router = express.Router();

// All routes require authentication and organization context
router.use(authenticateToken);
router.use(requireOrganization);

// Device CRUD
router.get('/', getDevices);
router.post('/', addDevice);
router.get('/stats', getDeviceStats);
router.get('/:deviceId', getDeviceById);
router.put('/:deviceId', updateDevice);
router.delete('/:deviceId', deleteDevice);

// Device status and location
router.post('/:deviceId/status', updateDeviceStatus);
router.get('/:deviceId/status-history', getDeviceStatusHistory);
router.get('/:deviceId/locations', getDeviceLocations);
router.post('/:deviceId/location', recordDeviceLocation);

// WiFi credentials
router.put('/:deviceId/wifi', updateWifiCredentials);
router.get('/:deviceId/wifi', getWifiCredentials);

export default router;