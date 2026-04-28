// csms-backend/utils/generateCode.js
import crypto from 'crypto';

// Generate 6-digit OTP code
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate secure random token
export const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate temporary password
export const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default { generateOTP, generateToken, generateTempPassword };