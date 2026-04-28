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

const DashboardLayout = () => {
  const { admin, logout, darkMode, toggleDarkMode, isLoading } = useAuth();
  const navigate = useNavigate();
  const [profileImageError, setProfileImageError] = useState(false);
  const [orgLogoError, setOrgLogoError] = useState(false);
  
  useCardDetection(!!admin);

  useEffect(() => {
    if (isLoading) return;
    
    if (!admin) {
      navigate("/login");
      return;
    }

    if (!admin.isVerified) {
      navigate("/verify-email");
    }
  }, [admin, isLoading, navigate]);

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
    return `${staticBaseUrl}/uploads/${admin.profile}`;
  };

  // Get organization logo URL
  const getOrgLogoUrl = () => {
    const orgLogo = (admin as any).organizationLogo;
    if (!orgLogo) return null;
    
    if (orgLogo.startsWith('http://') || orgLogo.startsWith('https://')) {
      return orgLogo;
    }
    
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const staticBaseUrl = baseUrl.replace('/api', '');
    return `${staticBaseUrl}/uploads/${orgLogo}`;
  };

  const profileImageUrl = getProfileImageUrl();
  const orgLogoUrl = getOrgLogoUrl();

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
                {/* Notifications */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground relative"
                  onClick={() => navigate("/dashboard/notifications")}
                >
                  <i className="bx bx-bell text-lg" style={{ fontSize: '25px' }}></i>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
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