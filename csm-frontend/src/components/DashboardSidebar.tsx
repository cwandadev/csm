// csms-frontend/src/components/DashboardSidebar.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BarChart3,
  CalendarCheck,
  Users,
  Cpu,
  Settings,
  MonitorSmartphone,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Rocket,
  LogOut,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { orgApi } from "@/lib/api";

const primaryLinks = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Attendance", url: "/dashboard/attendance", icon: CalendarCheck },
  { title: "Devices", url: "/dashboard/devices", icon: Cpu },
];

const analyticsSubTabs = [
  { title: "Users", view: "users" },
  { title: "Attendance", view: "attendance" },
  { title: "Devices", view: "devices" },
  { title: "Organization", view: "organization" },
  { title: "Subscription", view: "subscription" },
];

const companyUserTabs = [
  { title: "Users List", view: "list" },
  { title: "Department", view: "departments" },
  { title: "Category", view: "categories" },
];

const educationUserTabs = [
  { title: "Users List", view: "list" },
  { title: "Trades and Sections", view: "sections" },
  { title: "Classes", view: "classes" },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const analyticsView = query.get("view") || "users";
  const usersView = query.get("view") || "list";

  const analyticsActive = location.pathname.startsWith("/dashboard/analytics");
  const usersActive = location.pathname.startsWith("/dashboard/users");

  const [analyticsOpen, setAnalyticsOpen] = useState(analyticsActive);
  const [usersOpen, setUsersOpen] = useState(usersActive);

  useEffect(() => {
    if (analyticsActive) setAnalyticsOpen(true);
    if (usersActive) setUsersOpen(true);
  }, [analyticsActive, usersActive]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [admin]);

  const fetchSubscriptionInfo = async () => {
    if (!admin?.organizationId) {
      setLoadingSubscription(false);
      return;
    }
    
    try {
      const orgRes = await orgApi.getOrganization(admin.organizationId);
      console.log('Organization data:', orgRes);
      if (orgRes.success && orgRes.data) {
        setSubscriptionData(orgRes.data);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const userSubTabs = admin?.organizationType === "company" ? companyUserTabs : educationUserTabs;

  const linkClasses =
    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors";

  const renderPrimaryLinks = () => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {primaryLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/dashboard"}
                  className={linkClasses}
                  activeClassName="bg-primary/15 text-primary font-medium"
                >
                  <item.icon className="h-10 w-10 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
           <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/categories"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-network-chart" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Organize</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              isActive={analyticsActive}
              onClick={() => navigate("/dashboard/analytics?view=users")}
              className="flex items-center gap-3"
            >
              <i className="bx bx-bar-chart-alt-2" style={{ fontSize: '18px' }}/>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Analytics</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnalyticsOpen((prev) => !prev);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {analyticsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </>
              )}
            </SidebarMenuButton>

            {!collapsed && analyticsOpen && (
              <SidebarMenuSub>
                {analyticsSubTabs.map((tab) => (
                  <SidebarMenuSubItem key={tab.view}>
                    <SidebarMenuSubButton asChild isActive={analyticsActive && analyticsView === tab.view}>
                      <Link to={`/dashboard/analytics?view=${tab.view}`}>{tab.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
            
          </SidebarMenuItem>

          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              isActive={usersActive}
              onClick={() => navigate("/dashboard/users?view=list")}
              className="flex items-center gap-3"
            >
              <i className="bx bx-group" style={{ fontSize: '18px' }}/>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Users</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUsersOpen((prev) => !prev);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {usersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </>
              )}
            </SidebarMenuButton>

            {!collapsed && usersOpen && (
              <SidebarMenuSub>
                {userSubTabs.map((tab) => (
                  <SidebarMenuSubItem key={tab.view}>
                    <SidebarMenuSubButton asChild isActive={usersActive && usersView === tab.view}>
                      <Link to={`/dashboard/users?view=${tab.view}`}>{tab.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  // Dynamic Plan Banner with Real Data
  const DynamicPlanBanner = () => {
    if (loadingSubscription) {
      return (
        <div className="p-3 rounded-xl bg-muted/50 animate-pulse">
          <div className="h-20 rounded-lg bg-muted"></div>
        </div>
      );
    }

    const org = subscriptionData;
    
    // Extract real data from API response
    const subscriptionStatus = org?.subscription_status || "none";
    const planName = org?.subscription_plan?.display_name || (subscriptionStatus === "trial" ? "Trial Plan" : "Free Plan");
    const trialEndsAt = org?.trial_ends_at;
    const subscriptionEndsAt = org?.subscription_expires_at;
    const usersLimit = org?.subscription_plan?.max_users === null ? 999999 : (org?.subscription_plan?.max_users || 200);
    const devicesLimit = org?.subscription_plan?.max_devices === null ? 999999 : (org?.subscription_plan?.max_devices || 2);
    const usersUsed = org?.current_users_count || 0;
    const devicesUsed = org?.current_devices_count || 0;
    
    // Calculate days remaining
    let daysRemaining = null;
    if (subscriptionStatus === "trial" && trialEndsAt) {
      const endDate = new Date(trialEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysRemaining = diffDays > 0 ? diffDays : 0;
    } else if (subscriptionStatus === "active" && subscriptionEndsAt) {
      const endDate = new Date(subscriptionEndsAt);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysRemaining = diffDays > 0 ? diffDays : 0;
    }

    const usagePercent = usersLimit !== 999999 ? Math.min(100, (usersUsed / usersLimit) * 100) : 0;
    const isNearExpiry = daysRemaining !== null && daysRemaining <= 7;

    // Active Paid Plan
    if (subscriptionStatus === "active") {
      return (
        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 shadow-sm">
          <div className="flex items-start gap-2">
            <i className="bx bx-check-circle text-green-500 text-xl"></i>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{planName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active Plan</p>
            </div>
          </div>
          
          {usersLimit !== 999999 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Usage</span>
                <span>{usersUsed} / {usersLimit}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          )}
          
          {isNearExpiry && daysRemaining && (
            <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
              <i className="bx bx-time"></i>
              Expires in {daysRemaining} days
            </p>
          )}
          
          <button
            type="button"
            className="w-full mt-3 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 text-sm font-semibold py-1.5 transition-opacity border border-green-500/30"
            onClick={() => navigate("/dashboard/billing")}
          >
            Manage Subscription
          </button>
        </div>
      );
    }

    // Trial Plan
    if (subscriptionStatus === "trial") {
      const isNearEnd = daysRemaining !== null && daysRemaining <= 7;
      const totalTrialDays = 30; // Default trial period
      const percentUsed = daysRemaining !== null ? ((totalTrialDays - daysRemaining) / totalTrialDays) * 100 : 0;
      
      return (
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 shadow-sm">
          <div className="flex items-start gap-2">
            <i className="bx bx-rocket text-blue-500 text-xl"></i>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Trial Period</p>
              <p className="text-xs text-muted-foreground mt-0.5">{planName}</p>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Trial ends in</span>
              <span className={cn(isNearEnd ? "text-orange-500 font-semibold" : "")}>
                {daysRemaining} days
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={cn("h-1.5 rounded-full transition-all", isNearEnd ? "bg-orange-500" : "bg-blue-500")}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
          
          {usersLimit !== 999999 && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Users used</span>
                <span>{usersUsed} / {usersLimit}</span>
              </div>
            </div>
          )}
          
          {isNearEnd && (
            <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
              <i className="bx bx-time"></i>
              Trial ending soon! Upgrade to continue
            </p>
          )}
          
          <button
            type="button"
            className="w-full mt-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 text-sm font-semibold py-1.5 transition-opacity"
            onClick={() => navigate("/dashboard/billing")}
          >
            Upgrade Now
          </button>
        </div>
      );
    }

    // Expired Plan
    if (subscriptionStatus === "expired") {
      return (
        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/20 shadow-sm">
          <div className="flex items-start gap-2">
            <i className="bx bx-error-circle text-red-500 text-xl"></i>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Plan Expired</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your subscription has ended</p>
            </div>
          </div>
          
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <i className="bx bx-block"></i>
            Some features may be limited
          </p>
          
          <button
            type="button"
            className="w-full mt-3 rounded-full bg-red-500 text-white hover:bg-red-600 text-sm font-semibold py-1.5 transition-opacity"
            onClick={() => navigate("/dashboard/billing")}
          >
            Renew Subscription
          </button>
        </div>
      );
    }

    // Free / No Plan (Default)
    return (
      <div className="p-3 rounded-xl gradient-primary text-primary-foreground shadow-md">
        <div className="flex items-start gap-2">
          <i className="bx bx-rocket" style={{ fontSize: '20px' }}/>
          <div className="flex-1">
            <p className="text-sm font-semibold">Upgrade Plan</p>
            <p className="text-xs text-primary-foreground/80 mt-0.5">Get access to all features</p>
          </div>
        </div>
        
        {usersLimit !== 999999 && (
          <div className="mt-2 text-xs text-primary-foreground/80">
            <p>{usersUsed} / {usersLimit} users used</p>
          </div>
        )}
        
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="w-full rounded-full bg-primary-foreground text-primary text-sm font-semibold py-1.5 hover:opacity-90 transition-opacity"
            onClick={() => navigate("/dashboard/billing")}
          >
            Upgrade
          </button>
        </div>
      </div>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-3 flex items-center gap-3 border-b border-sidebar-border bg-sidebar-accent/60">
        <div className={cn(collapsed 
                ? "w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-md mb-0 mr1 mt-1"
                : "w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-md mb-0 mt-0")}>
          <span className={cn(collapsed ? "text-xm font-bold" : "text-primary-foreground font-heading font-bold text-lg")}>CS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-sidebar-foreground text-sm truncate">CSM</h2>
            <p className="text-[10px] text-muted-foreground truncate">{admin?.organizationName || "Organization"}</p>
          </div>
        )}
      </div>

      <SidebarContent className="px-1 py-3 flex-1 custom-scrollbar">
        {renderPrimaryLinks()}

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">Config</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/device-config"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-chip shrink-0" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Device Config</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/wifi-config"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-wifi shrink-0" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Wi-Fi Config</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/settings"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-cog shrink-0" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">More</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/notifications"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-bell shrink-0 " style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Notifictions</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/reports"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-file" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Reports</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/billing"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-credit-card" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Billing</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/account"
                    end
                    className={linkClasses}
                    activeClassName="bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bx-user" style={{ fontSize: '18px' }}/>
                    {!collapsed && <span>Account</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-3">
        {!collapsed && <DynamicPlanBanner />}

        <Button
            variant="ghost"
            className={cn(
              "transition-all duration-200 group",
              collapsed 
                ? "w-8 h-8 rounded-40 p-0 mr-20 items-center justify-center bg-[hsl(var(--out-bg))] text-destructive hover:bg-[hsl(var(--out-bg)/0.8)]" 
                : "w-full justify-start gap-3 px-3 py-2  bg-[hsl(var(--out-bg))] text-destructive hover:bg-[hsl(var(--out-bg)/0.8)]"
            )}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <i className="bx bx-log-out-circle" style={{ fontSize: '20px' }}/>
            {!collapsed && (
              <span >
                Logout
              </span>
            )}
          </Button>

        {!collapsed && (
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/privacy")}
          >
            Our policy and privacy
          </button>
        )}
      </div>
    </Sidebar>
  );
}