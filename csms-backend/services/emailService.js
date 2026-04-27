import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Email templates with new design
const emailTemplates = {
  verification: (name, code) => ({
    subject: 'Verify Your Email - CSM Attendance System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2589fed6;">Email Verification</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with the CSM Attendance System.</p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #2589fed6; padding: 10px 15px; margin: 20px 0;">
          <p style="margin: 0;">Your verification code is:</p>
          <h1 style="color: #2589fed6; margin: 10px 0;">${code}</h1>
        </div>
        
        <p>Please enter this code on the verification page to activate your account.</p>
        <p>If you didn't request this, please ignore this email.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>CSM Team</p>
      </div>
    `
  }),
  
  passwordReset: (name, resetLink) => ({
    subject: 'Password Reset Request - CSM Attendance System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2589fed6;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2589fed6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>CSM Team</p>
      </div>
    `
  }),
  
  resetSuccess: (name) => ({
    subject: 'Password Changed Successfully - CSM Attendance System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2589fed6;">Password Changed</h2>
        <p>Hello ${name},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>CSM Team</p>
      </div>
    `
  }),
  
  welcome: (name, email, password) => ({
    subject: 'Welcome to CSM Attendance System - Your Account Details',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2589fed6;">Welcome to CSM Attendance System!</h2>
        <p>Hello ${name},</p>
        <p>Your account has been created successfully. Here are your login details:</p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #2589fed6; padding: 10px 15px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        
        <p>Please change your password after first login for security.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>CSM Team</p>
      </div>
    `
  })
};

// Send email function
export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
};

// Send verification code
export const sendVerificationCode = async (email, name, code) => {
  const { subject, html } = emailTemplates.verification(name, code);
  return await sendEmail(email, subject, html);
};

// Send password reset link
export const sendPasswordResetLink = async (email, name, resetLink) => {
  const { subject, html } = emailTemplates.passwordReset(name, resetLink);
  return await sendEmail(email, subject, html);
};

// Send password change confirmation
export const sendPasswordChangeConfirmation = async (email, name) => {
  const { subject, html } = emailTemplates.resetSuccess(name);
  return await sendEmail(email, subject, html);
};

// Send welcome email with credentials
export const sendWelcomeEmail = async (email, name, password) => {
  const { subject, html } = emailTemplates.welcome(name, email, password);
  return await sendEmail(email, subject, html);
};

export default {
  sendEmail,
  sendVerificationCode,
  sendPasswordResetLink,
  sendPasswordChangeConfirmation,
  sendWelcomeEmail
};