// csms-frontend/src/pages/DashboardLayout.tsx
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useCardDetection } from '@/hooks/useCardDetection';
import { useNotifications } from '@/hooks/useNotifications';

// Loading Skeleton Components
const HeaderSkeleton = () => (
  <header className="h-16 border-b border-border bg-accent/80 backdrop-blur-sm px-3 sm:px-4 sticky top-0 z-30">
    <div className="h-full flex items-center gap-6">
      <div className="flex items-center gap-4 min-w-0">
        {/* Sidebar Trigger Skeleton */}
        <div className="w-8 h-8 bg-muted animate-pulse rounded"></div>
        
        {/* Organization Info Skeleton */}
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse"></div>
          <div className="min-w-0 text-left space-y-1">
            <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
            <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
      </div>

      {/* Search Skeleton */}
      <div className="hidden md:block flex-1 max-w-2xl">
        <div className="h-10 w-full bg-muted animate-pulse rounded-md"></div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* Notifications Skeleton */}
        <div className="w-9 h-9 bg-muted animate-pulse rounded-md"></div>
        
        {/* Dark Mode Toggle Skeleton */}
        <div className="w-9 h-9 bg-muted animate-pulse rounded-md"></div>
        
        {/* Profile Dropdown Skeleton */}
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse"></div>
      </div>
    </div>
  </header>
);

const SidebarSkeleton = () => (
  <div className="hidden lg:flex lg:flex-col lg:w-64 border-r border-border bg-card/50 backdrop-blur-sm">
    <div className="p-6 border-b border-border">
      <div className="flex items-center justify-center">
        <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
      </div>
    </div>
    
    <div className="flex-1 p-4 space-y-4">
      {/* Navigation items skeleton */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded"></div>
          <div className="flex-1 h-4 bg-muted animate-pulse rounded"></div>
        </div>
      ))}
    </div>
    
    <div className="p-4 border-t border-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-muted animate-pulse rounded-full"></div>
        <div className="flex-1 space-y-1">
          <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
          <div className="h-2 w-16 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    </div>
  </div>
);

const DashboardLayout = () => {
  const { admin, logout, darkMode, toggleDarkMode, isLoading } = useAuth();
  const navigate = useNavigate();
  const [profileImageError, setProfileImageError] = useState(false);
  const [orgLogoError, setOrgLogoError] = useState(false);
  const { unreadCount } = useNotifications();
  
  useCardDetection(!!admin);

  useEffect(() => {
    // Wait for loading to complete
    if (isLoading) return;
    
    // Check if we have admin data
    if (!admin) {
      console.log('No admin found, redirecting to login');
      navigate("/login", { replace: true });
      return;
    }

    // Check if email is verified
    if (admin.isVerified === false) {
      console.log('Email not verified, redirecting to verify-email');
      navigate("/verify-email", { replace: true });
      return;
    }

    // Check if organization setup is needed (for Google auth users without org)
    if ((admin as any).needsOrgSetup) {
      console.log('Organization setup needed, redirecting to signup');
      navigate("/register", { replace: true });
      return;
    }
    
    // All good, stay on dashboard
    console.log('Admin authenticated:', admin.email);
    
  }, [admin, isLoading, navigate]);

  // Format notification count display (9+ for numbers > 9)
  const formatNotificationCount = (count: number) => {
    if (count === 0) return null;
    if (count > 9) return '9+';
    return count.toString();
  };

  // Show loading state with skeleton
  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          {/* Sidebar Skeleton */}
          <SidebarSkeleton />
          
          <div className="flex-1 flex flex-col min-w-10">
            {/* Header Skeleton */}
            <HeaderSkeleton />

            {/* Main Content Skeleton */}
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              <div className="space-y-6">
                {/* Welcome message skeleton */}
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2"></div>
                    <div className="h-4 w-48 bg-muted animate-pulse rounded"></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="h-10 w-32 bg-muted animate-pulse rounded-full"></div>
                    <div className="h-10 w-32 bg-muted animate-pulse rounded-full"></div>
                    <div className="h-10 w-32 bg-muted animate-pulse rounded-full"></div>
                  </div>
                </div>

                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-border/60 bg-card rounded-lg p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-muted animate-pulse rounded"></div>
                        <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="rounded-xl border border-border bg-accent/60 p-3">
                            <div className="h-3 w-12 bg-muted animate-pulse rounded mb-2"></div>
                            <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
                          </div>
                        ))}
                      </div>
                      <div className="h-2 bg-muted animate-pulse rounded-full"></div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <div key={j} className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="border border-border/60 bg-card rounded-lg p-6">
                      <div className="h-6 w-40 bg-muted animate-pulse rounded mb-2"></div>
                      <div className="h-3 w-48 bg-muted animate-pulse rounded mb-4"></div>
                      <div className="h-[300px] w-full bg-muted/20 animate-pulse rounded"></div>
                    </div>
                  ))}
                </div>

                {/* Bottom Cards Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="border border-border/60 bg-card rounded-lg p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-muted animate-pulse rounded"></div>
                        <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
                      </div>
                      <div className="space-y-3">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-muted animate-pulse"></div>
                              <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                            </div>
                            <div className="h-4 w-12 bg-muted animate-pulse rounded"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Don't render anything if not authenticated (will redirect in useEffect)
  if (!admin) return null;

  // Get profile image URL - handle different storage formats
  const getProfileImageUrl = () => {
    if (!admin.profile) return null;
    
    // If it's a full URL (http:// or https://)
    if (admin.profile.startsWith('http://') || admin.profile.startsWith('https://')) {
      return admin.profile;
    }
    
    // If it's just a filename, construct the URL
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/profiles/${admin.profile}`;
  };

  // Get organization logo URL - fixed to work with logo filename
  const getOrgLogoUrl = () => {
    // Try multiple possible property names where the logo might be stored
    const orgLogo = (admin as any).organizationLogo || (admin as any).logo || (admin as any).organization?.logo;
    
    if (!orgLogo) {
      console.log('No organization logo found');
      return null;
    }
    
    // If it's already a full URL
    if (orgLogo.startsWith('http://') || orgLogo.startsWith('https://')) {
      return orgLogo;
    }
    
    // If it starts with /uploads
    if (orgLogo.startsWith('/uploads/')) {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const staticBaseUrl = baseUrl.replace('/api', '');
      return `${staticBaseUrl}${orgLogo}`;
    }
    
    // If it's just a filename (like logo-1779292028211-231738862.png), construct the URL for logos folder
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/logos/${orgLogo}`;
  };

  const profileImageUrl = getProfileImageUrl();
  const orgLogoUrl = getOrgLogoUrl();
  const notificationCount = formatNotificationCount(unreadCount);

  const handleOrganizationClick = () => {
    navigate("/dashboard/categories");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-10">
          <header className="h-16 border-b border-border bg-accent/80 backdrop-blur-sm px-3 sm:px-4 sticky top-0 z-30">
            <div className="h-full flex items-center gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <SidebarTrigger className="text-muted-foreground" />

                {/* Clickable Organization Info */}
                <button
                  onClick={handleOrganizationClick}
                  className="hidden sm:flex items-center gap-2 min-w-0 hover:bg-accent/50 px-2 py-1 rounded-lg transition-colors"
                  title="Click to manage categories"
                >
                  {orgLogoUrl && !orgLogoError ? (
                    <img
                      src={orgLogoUrl}
                      alt={admin.organizationName}
                      className="w-10 h-10 rounded-lg object-cover border border-border"
                      onError={() => setOrgLogoError(true)}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center font-heading font-bold text-primary">
                      {admin.organizationName?.[0] || 'C'}
                    </div>
                  )}
                  <div className="min-w-0 text-left">
                    <p className="text-foreground font-heading font-semibold truncate">
                      {admin.organizationName}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {admin.organizationType}
                    </p>
                  </div>
                </button>
              </div>

              {/* Search */}
              <div className="hidden md:block flex-1 max-w-2xl">
                <div className="relative">
                  <i className="bx bx-search absolute left-3 top-2.5 text-muted-foreground text-base" style={{ fontSize: '20px'}}></i>
                  <Input className="pl-9 h-10 bg-card" placeholder="Here! Search..." />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                {/* Notifications with Count Badge */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground relative"
                  onClick={() => navigate("/dashboard/notifications")}
                >
                  <i className="bx bx-bell text-lg" style={{ fontSize: '25px' }}></i>
                  {notificationCount && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg ring-2 ring-background">
                      {notificationCount}
                    </span>
                  )}
                </Button>

                {/* Dark mode */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDarkMode}
                  className="text-muted-foreground"
                >
                  {darkMode ? (
                    <i className="bx bx-sun text-lg"></i>
                  ) : (
                    <i className="bx bx-moon text-lg"></i>
                  )}
                </Button>

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-10 w-10 rounded-full p-0 border border-border hover:ring-1 hover:ring-primary transition">
                      {profileImageUrl && !profileImageError ? (
                        <img
                          src={profileImageUrl}
                          alt={`${admin.firstName} ${admin.lastName}`}
                          className="w-9 h-9 rounded-full object-cover"
                          onError={() => setProfileImageError(true)}
                        />
                      ) : (
                        <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold select-none">
                          {admin.firstName?.[0] || admin.email?.[0] || 'U'}
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="w-64 bg-card shadow-lg rounded-xl border border-border p-2"
                  >
                    {/* Admin Info with Image */}
                    <DropdownMenuLabel className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {profileImageUrl && !profileImageError ? (
                          <img
                            src={profileImageUrl}
                            alt={`${admin.firstName} ${admin.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={() => setProfileImageError(true)}
                          />
                        ) : (
                          <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                            {admin.firstName?.[0] || admin.email?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {admin.firstName} {admin.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {/* Menu Items */}
                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard/account")}
                      className="gap-3 px-3 py-2 rounded-lg hover:bg-muted hover:text-foreground transition flex items-center"
                    >
                      <i className="bx bx-user text-lg"></i>
                      My Profile
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard/settings")}
                      className="gap-3 px-3 py-2 rounded-lg hover:bg-muted hover:text-foreground transition flex items-center"
                    >
                      <i className="bx bx-cog text-lg"></i>
                      Settings
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard/billing")}
                      className="gap-3 px-3 py-2 rounded-lg hover:bg-muted hover:text-foreground transition flex items-center"
                    >
                      <i className="bx bx-credit-card text-lg"></i>
                      Subscription
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => {
                        logout();
                        navigate("/login");
                      }}
                      className="w-full justify-start gap-2 bg-[hsl(var(--out-bg))] text-destructive hover:bg-[hsl(var(--out-bg)/0.8)]"
                    >
                      <i className="bx bx-log-out-circle text-lg" style={{ fontSize: '20px' }} />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;