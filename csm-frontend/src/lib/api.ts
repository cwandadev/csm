// csms-frontend/src/lib/api.ts API service layer for CSMS backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

type AnyRecord = Record<string, unknown>;

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const parseResponse = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  return text ? { message: text } : {};
};

const toErrorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === "string") return payload;

  if (payload && typeof payload === "object") {
    const data = payload as AnyRecord;
    const message = data.message ?? data.error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
};

const onRefreshed = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onRefreshSuccess = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const onRefreshFailure = () => {
  refreshSubscribers = [];
};

const refreshToken = async (): Promise<string | null> => {
  const refreshTokenValue = localStorage.getItem("csm_refresh_token");
  if (!refreshTokenValue) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });

    if (response.ok) {
      const data = await response.json();
      const newToken = data.data?.token || data.token;
      if (newToken) {
        localStorage.setItem("csm_token", newToken);
        return newToken;
      }
    }
    return null;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return null;
  }
};

const handleUnauthorized = async (
  originalRequest: () => Promise<Response>
): Promise<Response> => {
  if (!isRefreshing) {
    isRefreshing = true;

    try {
      const newToken = await refreshToken();

      if (newToken) {
        onRefreshSuccess(newToken);
        return await originalRequest();
      } else {
        // Only clear storage if this isn't a login attempt
        localStorage.removeItem("csm_admin");
        localStorage.removeItem("csm_token");
        localStorage.removeItem("csm_refresh_token");
        onRefreshFailure();
        throw new Error("Session expired");
      }
    } finally {
      isRefreshing = false;
    }
  } else {
    return new Promise((resolve, reject) => {
      onRefreshed(async (_newToken) => {
        try {
          const response = await originalRequest();
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
};




// ─────────────────────────────────────────────
// Core request function
// ─────────────────────────────────────────────
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const makeRequest = async (customToken?: string): Promise<Response> => {
    const token = customToken || localStorage.getItem("csm_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  };

  try {
    let res = await makeRequest();

    // Only try to refresh token if we have a token and got 401
    if (res.status === 401 && localStorage.getItem("csm_token")) {
      try {
        res = await handleUnauthorized(() => makeRequest());
      } catch {
        localStorage.removeItem("csm_admin");
        localStorage.removeItem("csm_token");
        localStorage.removeItem("csm_refresh_token");
        // Don't return session expired for login attempts
        if (!endpoint.includes("/auth/login")) {
          return { success: false, error: "Session expired. Please login again." };
        }
      }
    }

    if (res.status === 403) {
      return {
        success: false,
        error: "You don't have permission to perform this action.",
      };
    }

    const payload = await parseResponse(res);

    if (!res.ok) {
      // Return a user-friendly error message
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      
      if (payload && typeof payload === "object") {
        const data = payload as AnyRecord;
        if (data.error) errorMessage = data.error;
        else if (data.message) errorMessage = data.message;
      }
      
      // Customize error messages for login failures
      if (endpoint.includes("/auth/login")) {
        if (res.status === 401) {
          errorMessage = "Invalid Credentials. Please try different ones.";
        } else if (res.status === 404) {
          errorMessage = "No account found with these credentials. Please sign up first.";
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    if (payload && typeof payload === "object") {
      const normalized = payload as AnyRecord;

      if (normalized.success === false) {
        return {
          success: false,
          error: toErrorMessage(payload, "Request failed"),
          message:
            typeof normalized.message === "string"
              ? normalized.message
              : undefined,
        };
      }

      return {
        success: true,
        data: (normalized.data ?? normalized) as T,
        message:
          typeof normalized.message === "string"
            ? normalized.message
            : undefined,
      };
    }

    return { success: true, data: payload as T };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("API request error:", err);
    
    // Return network error without mentioning session
    if (message.includes("fetch") || message.includes("network")) {
      return { success: false, error: "Cannot connect to server. Please check your internet connection." };
    }
    
    return { success: false, error: message };
  }
}

export const statsApi = {
  getDashboardStats: async () => {
    try {
      const response = await api.get("/dashboard/stats");
      return response;
    } catch (error: any) {
      console.error('Get dashboard stats error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch stats' 
      };
    }
  },
};



// ─────────────────────────────────────────────
// HTTP method wrappers Supports optional { params } for query strings — used as `api.get(...)` etc...
// ─────────────────────────────────────────────
interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(
  endpoint: string,
  params?: RequestOptions["params"]
): string {
  if (!params) return endpoint;

  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");

  return qs ? `${endpoint}?${qs}` : endpoint;
}

const api = {
  get<T>(endpoint: string, options?: RequestOptions) {
    const { params, ...rest } = options ?? {};
    return request<T>(buildUrl(endpoint, params), { ...rest, method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    const { params, ...rest } = options ?? {};
    return request<T>(buildUrl(endpoint, params), {
      ...rest,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    const { params, ...rest } = options ?? {};
    return request<T>(buildUrl(endpoint, params), {
      ...rest,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    const { params, ...rest } = options ?? {};
    return request<T>(buildUrl(endpoint, params), {
      ...rest,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string, options?: RequestOptions) {
    const { params, ...rest } = options ?? {};
    return request<T>(buildUrl(endpoint, params), {
      ...rest,
      method: "DELETE",
    });
  },
};

// ─────────────────────────────────────────────
// Normalise register payload
// ─────────────────────────────────────────────
const normalizeRegisterPayload = (data: Record<string, unknown>) => {
  const s = (k: string) => String(data[k] ?? "");
  
  const result: Record<string, unknown> = {
    firstName: s("firstName"),
    lastName: s("lastName"),
    email: s("email"),
    username: s("username"),
    gender: s("gender"),
    roleId: s("roleId"),
    profileImage: s("profileImage"),
    orgName: s("orgName") || "school",
    orgType: s("orgType"),
    orgAddress: s("orgAddress"),
    orgEmail: s("orgEmail"),
    orgPhone: s("orgPhone"),
    orgLogo: s("orgLogo"),  // CRITICAL: Use 'orgLogo' not 'logo'
    province: s("province"),
    district: s("district"),
    apiSlug: s("apiSlug"),
    planId: s("planId") || "free_trial",
    billingCycle: s("billingCycle") || "monthly",
    planDetails: data.planDetails || {},
    isGoogleSignup: data.isGoogleSignup === true,
    addExtraDevice: data.addExtraDevice === true,
    extraDeviceFee: typeof data.extraDeviceFee === 'number' ? data.extraDeviceFee : 0,
  };
  
  // Preserve password for email registration
  if (data.password && !data.isGoogleSignup) {
    result.password = String(data.password);
  }
  
  console.log('[API] Normalized payload:', {
    ...result,
    password: result.password ? '[PRESENT]' : '[MISSING]',
    orgLogo: result.orgLogo
  });
  
  return result;
};


// ─────────────────────────────────────────────
// Named API modules
// ─────────────────────────────────────────────

export const authApi = {
   googleAuth: async (googleToken: string) => {
    const response = await request<{
      token: string;
      refreshToken: string;
      admin: AnyRecord;
    }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ token: googleToken }),
    });

    if (response.success && response.data) {
      if (response.data.token)
        localStorage.setItem("csm_token", response.data.token);
      if (response.data.refreshToken)
        localStorage.setItem("csm_refresh_token", response.data.refreshToken);
      if (response.data.admin)
        localStorage.setItem("csm_admin", JSON.stringify(response.data.admin));
    }

    return response;
  },
  uploadProfileImage: async (file: File) => {
    const formData = new FormData();
    formData.append('profile', file);
    
    const token = localStorage.getItem("csm_token");
    
    const response = await fetch(`${API_BASE_URL}/auth/upload-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    return result;
  },
  
  login: async (email: string, password: string) => {
    try {
      const response = await request<{
        token: string;
        refreshToken: string;
        user: AnyRecord;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (response.success && response.data) {
        if (response.data.token)
          localStorage.setItem("csm_token", response.data.token);
        if (response.data.refreshToken)
          localStorage.setItem("csm_refresh_token", response.data.refreshToken);
        if (response.data.user)
          localStorage.setItem("csm_admin", JSON.stringify(response.data.user));
      }

      return response;
    } catch (error: any) {
      console.error("Login API error:", error);
      // Return a proper error response instead of throwing
      return {
        success: false,
        error: error.message || "Login failed. Please check your credentials."
      };
    }
  },
  updateProfile: (data: Record<string, unknown>) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  register: (data: Record<string, unknown>) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(normalizeRegisterPayload(data)),
    }),

  verifyEmail: (code: string, email: string) =>
    request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ code, email }),
    }),

  resendCode: (email: string) =>
    request("/auth/resend-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  googleAuth: (googleToken: string) =>
    request("/auth/google", {
      method: "POST",
      body: JSON.stringify({ token: googleToken }),
    }),

  getProfile: () => request("/auth/profile"),

  updateProfile: (data: Record<string, unknown>) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  logout: () => {
    localStorage.removeItem("csm_token");
    localStorage.removeItem("csm_refresh_token");
    localStorage.removeItem("csm_admin");
    return request("/auth/logout", { method: "POST" });
  },
};



export const deviceApi = {
  verifyCard: (cardId: string, deviceId?: string) => {
    let url = `/verify?card_id=${cardId}`;
    if (deviceId) {
      url += `&device_id=${deviceId}`;
    }
    return request(url);
  },
  getDevices: (orgId: string) => request(`/devices?org_id=${orgId}`),
  getDevice: (deviceId: string) => request(`/devices/${deviceId}`),
  addDevice: (data: Record<string, unknown>) =>
    request("/devices", { method: "POST", body: JSON.stringify(data) }),
  updateDevice: (deviceId: string, data: Record<string, unknown>) =>
    request(`/devices/${deviceId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDevice: (deviceId: string) =>
    request(`/devices/${deviceId}`, { method: "DELETE" }),
  updateWifi: (deviceId: string, ssid: string, password: string, apiUrl: string) =>
    request(`/devices/${deviceId}/wifi`, {
      method: "PUT",
      body: JSON.stringify({ ssid, password, api: apiUrl }),
    }),
  getDeviceStats: () => request("/devices/stats"),
  getDeviceHistory: (deviceId: string, days?: number) =>
    request(`/devices/${deviceId}/history${days ? `?days=${days}` : ""}`),
  getRecentUnregisteredScans: () => api.get("/recent-unregistered-scans"),
  // In your deviceApi service
 getAllWifiCredentials: async (organizationId: string) => {
  return await api.get(`/devices/wifi-credentials?organizationId=${organizationId}`);
}, 
 getWifiCredentials: async (deviceId: string) => {
  const response = await apiClient.get(`/devices/${deviceId}/wifi`);
  return response.data;
},

 updateWifiCredentials: async (deviceId: string, data: { ssid: string; password: string; api?: string }) => {
  const response = await apiClient.put(`/devices/${deviceId}/wifi`, data);
  return response.data;
},

 getAllWifiCredentials: async (organizationId: string) => {
    return await api.get(`/devices/wifi-credentials?organizationId=${organizationId}`);
  },

  // Update WiFi credentials
  updateWifiCredentials: async (deviceId: string, data: { ssid: string; password: string; api?: string }) => {
    return await api.put(`/devices/${deviceId}/wifi`, data);
  },

  // Get WiFi credentials for a specific device
  getWifiCredentials: async (deviceId: string) => {
    return await api.get(`/devices/${deviceId}/wifi`);
  },

  // Update device location
  updateDeviceLocation: async (deviceId: string, location: { latitude: number; longitude: number }) => {
    return await api.post(`/devices/${deviceId}/location`, location);
  },

  // Get device location history
  getDeviceLocations: async (deviceId: string, limit?: number) => {
    const params = limit ? { limit } : {};
    return await api.get(`/devices/${deviceId}/locations`, { params });
  },

  // Get device status history
  getDeviceStatusHistory: async (deviceId: string, limit?: number) => {
    const params = limit ? { limit } : {};
    return await api.get(`/devices/${deviceId}/status-history`, { params });
  },
   updateDeviceLocation: async (deviceId: string, latitude: number, longitude: number) => {
    return await api.post(`/devices/${deviceId}/location`, { latitude, longitude });
  },

  // Get device details with WiFi credentials
  getDevice: async (deviceId: string) => {
    return await api.get(`/devices/${deviceId}`);
  },

  // Get all devices
  getDevices: async (orgId: string) => {
    return await api.get(`/devices?org_id=${orgId}`);
  },
};

export const orgApi = {
  getOrganization: (orgId: string) => request(`/organizations/${orgId}`),
  updateOrganization: (orgId: string, data: Record<string, unknown>) =>
    request(`/organizations/${orgId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};



export const attendanceApi = {
  // Get attendance records with filters
  getRecords: (params?: {
    search?: string;
    status?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
    schedule_id?: string;
    page?: number;
    limit?: number;
  }) => api.get("/attendance/records", { params }),
  
  // Get today's statistics
  getTodayStats: () => api.get("/attendance/stats/today"),
  
  // Get all schedules
  getSchedules: () => api.get("/attendance/schedules"),
  
  // Create new schedule
  createSchedule: (data: {
    name: string;
    description?: string;
    type: "check_in" | "check_out" | "both";
    start_time: string;
    end_time: string;
    days_of_week: string[];
    grace_minutes?: number;
    late_threshold_minutes?: number;
    early_leave_threshold_minutes?: number;
    is_active?: boolean;
    device_ids?: number[];
    target_type?: string;
    target_ids?: number[];
  }) => api.post("/attendance/schedules", data),
  
  // Update schedule
  updateSchedule: (id: number, data: Partial<{
    name: string;
    description: string;
    type: "check_in" | "check_out" | "both";
    start_time: string;
    end_time: string;
    days_of_week: string[];
    grace_minutes: number;
    late_threshold_minutes: number;
    early_leave_threshold_minutes: number;
    is_active: boolean;
    device_ids: number[];
    target_type: string;
    target_ids: number[];
  }>) => api.put(`/attendance/schedules/${id}`, data),
  
  // Delete schedule
  deleteSchedule: (id: number) => api.delete(`/attendance/schedules/${id}`),
  
  // Record manual attendance
  recordManual: (data: {
    user_id: number;
    status: "check_in" | "check_out";
    notes?: string;
    schedule_id?: number | null;
  }) => api.post("/attendance/manual", data),
  
  // Get users for manual attendance
  getUsers: (search?: string) => api.get("/attendance/users", { params: { search } }),
  
  // Export attendance to CSV
  exportAttendance: (params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    method?: string;
    schedule_id?: string;
  }) => api.get("/attendance/export", { params }),
  
  // Get organization structure (sections/classes for schools, departments/positions for both)
  getOrganizationStructure: () => api.get("/attendance/structure"),
  
  // Get target users based on selection
  getTargetUsers: (targetType: string, targetIds: number[]) => 
    api.get("/attendance/target-users", { 
      params: { target_type: targetType, target_ids: JSON.stringify(targetIds) } 
    }),
  
  // Get schedules for a specific user (for manual attendance)
  getUserSchedules: (userId: number) => 
    api.get("/attendance/user-schedules", { params: { user_id: userId } }),


    // Get today's statistics with currently inside count
  getTodayStats: async () => {
    try {
      const response = await api.get("/attendance/stats/today");
      // Add currently_inside calculation if not provided by backend
      if (response.success && response.data && response.data.currently_inside === undefined) {
        // Calculate from records if backend doesn't provide it
        const records = response.data.records || [];
        const checkedInUsers = new Set();
        const checkedOutUsers = new Set();
        
        records.forEach((record: any) => {
          if (record.status === 'check_in' || record.status === 'present' || record.status === 'late') {
            checkedInUsers.add(record.user_id);
          } else if (record.status === 'check_out') {
            checkedOutUsers.add(record.user_id);
          }
        });
        
        response.data.currently_inside = Math.max(0, checkedInUsers.size - checkedOutUsers.size);
      }
      return response;
    } catch (error) {
      console.error('Get today stats error:', error);
      return { success: false, error: 'Failed to fetch stats' };
    }
  },
};


// export const usersApi = {
//   getUsers: (orgId: string) => request(`/users?org_id=${orgId}`),
//   createUser: (data: Record<string, unknown>) =>
//     request("/users", { method: "POST", body: JSON.stringify(data) }),
//   updateUser: (userId: string, data: Record<string, unknown>) =>
//     request(`/users/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
//   deleteUser: (userId: string) =>
//     request(`/users/${userId}`, { method: "DELETE" }),
// };




export const usersApi = {
  getUsers: (orgId: string) => request(`/users?org_id=${orgId}`),
  createUser: (data: Record<string, unknown>) =>
    request("/users/enhanced", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (userId: string, data: Record<string, unknown>) =>
    request(`/users/enhanced/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (userId: string) =>
    request(`/users/${userId}`, { method: "DELETE" }),
  
  uploadUserImage: async (userId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const token = localStorage.getItem("csm_token");
    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    return response.json();
  },
  
  uploadTempUserImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const token = localStorage.getItem("csm_token");
    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    
    const response = await fetch(`${API_BASE_URL}/users/upload-temp-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    return response.json();
  },
};




export const organizeApi = {
  getSections: () => request("/organize/sections"),
  getSection: (id: number) => request(`/organize/sections/${id}`),
  createSection: (data: { name: string; description?: string }) =>
    request("/organize/sections", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSection: (id: number, data: { name: string; description?: string }) =>
    request(`/organize/sections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSection: (id: number) =>
    request(`/organize/sections/${id}`, { method: "DELETE" }),

  getClasses: (sectionId: number) =>
    request(`/organize/sections/${sectionId}/classes`),
  getClass: (id: number) => request(`/organize/classes/${id}`),
  createClass: (data: {
    name: string;
    section_id: number;
    grade_level?: string;
    capacity?: number;
  }) =>
    request("/organize/classes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClass: (
    id: number,
    data: { name: string; grade_level?: string; capacity?: number }
  ) =>
    request(`/organize/classes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteClass: (id: number) =>
    request(`/organize/classes/${id}`, { method: "DELETE" }),

  getDepartments: () => request("/organize/departments"),
  getDepartment: (id: number) => request(`/organize/departments/${id}`),
  createDepartment: (data: { name: string; description?: string }) =>
    request("/organize/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDepartment: (
    id: number,
    data: { name: string; description?: string }
  ) =>
    request(`/organize/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDepartment: (id: number) =>
    request(`/organize/departments/${id}`, { method: "DELETE" }),

  getPositions: (departmentId: number) =>
    request(`/organize/departments/${departmentId}/positions`),
  getPosition: (id: number) => request(`/organize/positions/${id}`),
  createPosition: (data: {
    name: string;
    department_id: number;
    salary_range?: string;
  }) =>
    request("/organize/positions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePosition: (id: number, data: { name: string; salary_range?: string }) =>
    request(`/organize/positions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePosition: (id: number) =>
    request(`/organize/positions/${id}`, { method: "DELETE" }),
};

export const enhancedUsersApi = {
  getEnhancedUsers: (orgId: string, role?: string) =>
    request(
      `/users/enhanced?org_id=${orgId}${role ? `&type=${role}` : ""}`
    ),
  getEnhancedUser: (userId: string) => request(`/users/enhanced/${userId}`),
  createEnhancedUser: (data: Record<string, unknown>) =>
    request("/users/enhanced", { method: "POST", body: JSON.stringify(data) }),
  updateEnhancedUser: (userId: string, data: Record<string, unknown>) =>
    request(`/users/enhanced/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getStudentsBySection: (sectionId: number, orgId: string) =>
    request(`/students/by-section/${sectionId}?org_id=${orgId}`),
  getStudentsByClass: (classId: number, orgId: string) =>
    request(`/students/by-class/${classId}?org_id=${orgId}`),
  getEmployeesByDepartment: (departmentId: number, orgId: string) =>
    request(`/employees/by-department/${departmentId}?org_id=${orgId}`),
  getEmployeesByPosition: (positionId: number, orgId: string) =>
    request(`/employees/by-position/${positionId}?org_id=${orgId}`),
  searchUsers: (
    orgId: string,
    params: {
      query?: string;
      role?: string;
      section_id?: number;
      class_id?: number;
      department_id?: number;
      position_id?: number;
      status?: "active" | "inactive";
    }
  ) => {
    const searchParams = new URLSearchParams({
      org_id: orgId,
      ...(params as Record<string, string>),
    });
    return request(`/users/search?${searchParams.toString()}`);
  },
  getUserStatistics: (orgId: string) =>
    request(`/users/statistics?org_id=${orgId}`),
};



export const billingApi = {
  getBillingInfo: (orgId: string) => request(`/billing/${orgId}`),
  updateSubscription: (
    orgId: string,
    data: {
      subscription_status: string;
      subscription_expires_at?: string;
      plan_type?: string;
    }
  ) =>
    request(`/billing/${orgId}`, { method: "PUT", body: JSON.stringify(data) }),
};

export const accountApi = {
  updateAccount: (
    adminId: string,
    data: {
      first_name: string;
      last_name: string;
      username: string;
      email: string;
      profile?: string;
      current_password?: string;
      new_password?: string;
    }
  ) =>
    request(`/account/${adminId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAccount: (adminId: string) =>
    request(`/account/${adminId}`, { method: "DELETE" }),
};


export const liveViewApi = {
  createLiveSession: async (organizationId: string, adminId: string, durationMinutes: number = 60) => {
    try {
      const response = await api.post('/live/sessions', {
        organization_id: organizationId,
        duration_minutes: durationMinutes
      });
      return response;
    } catch (error: any) {
      console.error('Create live session error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create session' 
      };
    }
  },

  validateSession: async (sessionId: string) => {
    try {
      const response = await api.get(`/live/sessions/${sessionId}/validate`);
      return response;
    } catch (error: any) {
      console.error('Validate session error:', error);
      return { 
        success: false, 
        error: error.message || 'Invalid session' 
      };
    }
  },

  getPublicAttendance: async (sessionId: string, limit: number = 50) => {
    try {
      const response = await api.get(`/live/sessions/${sessionId}/attendance`, { params: { limit } });
      return response;
    } catch (error: any) {
      console.error('Get public attendance error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch attendance' 
      };
    }
  }
};

export interface IncrementViewerResponse {
  success: boolean;
}

// Default export — the `api` object with .get / .post / .put / .patch / .delete
export default api;