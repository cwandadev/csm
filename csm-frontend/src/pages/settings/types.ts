// csms-frontend/src/pages/settings/types.ts
export interface SettingsTabProps {
  admin: any;
  updateProfile: (data: any) => Promise<void>;
  onToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  profile: string;
  role: string;
  roleLevel: number;
  isPrimary: boolean;
  isActive: boolean;
  lastLogin: string;
  authProvider: "email" | "google" | "both";
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
  attendanceAlerts: boolean;
  deviceAlerts: boolean;
  subscriptionAlerts: boolean;
}