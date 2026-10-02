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
  CalendarCheck,
  Cpu,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { orgApi } from "@/lib/api";

const DOCS_BASE_URL = import.meta.env.VITE_DOCS_URL;

// Inject styles for interactive buttons
const sidebarButtonStyles = `
  @keyframes metallicShine {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  /* Main menu button styles */
  .sidebar-interactive-btn {
    position: relative;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    overflow: hidden;
    cursor: pointer;
    border-radius: 0.5rem;
  }

  /* By default show regular icon, hide solid icon */
  .sidebar-interactive-btn .bx-regular-icon {
    display: inline-block !important;
  }
  
  .sidebar-interactive-btn .bx-solid-icon {
    display: none !important;
  }

  /* On hover: show solid icon, hide regular icon, NO background color change */
  .sidebar-interactive-btn:hover .bx-regular-icon {
    display: none !important;
  }





  .sidebar-interactive-btn:hover .bx-solid-icon {
    display: inline-block !important;
  }

  /* On active: show solid icon, hide regular icon, AND add blue background */
  .sidebar-interactive-btn.active,
  .sidebar-interactive-btn[data-active="true"],
  a.active.sidebar-interactive-btn {
    background: rgba(59, 130, 246, 0.15) !important;
    color: hsl(var(--primary)) !important;
  }

  .sidebar-interactive-btn.active .bx-regular-icon,
  .sidebar-interactive-btn[data-active="true"] .bx-regular-icon,
  a.active.sidebar-interactive-btn .bx-regular-icon {
    display: none !important;
  }

  .sidebar-interactive-btn.active .bx-solid-icon,
  .sidebar-interactive-btn[data-active="true"] .bx-solid-icon,
  a.active.sidebar-interactive-btn .bx-solid-icon {
    display: inline-block !important;
  }

  /* Metallic shine effect */
  .sidebar-interactive-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
    pointer-events: none;
    border-radius: 0.5rem;
  }

  .sidebar-interactive-btn:hover::before {
    left: 100%;
    animation: metallicShine 0.6s ease;
  }

  /* Sub-menu button styles */
  .sidebar-sub-btn {
    position: relative;
    transition: all 0.2s ease !important;
    overflow: hidden;
    cursor: pointer;
    width: 100%;
    border-radius: 0.375rem;
  }

  /* By default show regular icon, hide solid icon */
  .sidebar-sub-btn .bx-regular-icon {
    display: inline-block !important;
  }
  
  .sidebar-sub-btn .bx-solid-icon {
    display: none !important;
  }

  /* On hover: show solid icon, hide regular icon, NO background color change */
  .sidebar-sub-btn:hover .bx-regular-icon {
    display: none !important;
  }






 .sidebar-sub-btn:hover{
  border: 1px solid  rgba(59, 130, 246, 0.2);
 }
  .sidebar-sub-btn:hover .bx-solid-icon {
    display: inline-block !important;
  }

  /* On active: show solid icon, hide regular icon, AND add blue background */
  .sidebar-sub-btn.active,
  .sidebar-sub-btn[data-active="true"],
  a.active.sidebar-sub-btn {
    background: rgba(59, 130, 246, 0.1) !important;
    color: hsl(var(--primary)) !important;
  }

  .sidebar-sub-btn.active .bx-regular-icon,
  .sidebar-sub-btn[data-active="true"] .bx-regular-icon,
  a.active.sidebar-sub-btn .bx-regular-icon {
    display: none !important;
  }

  .sidebar-sub-btn.active .bx-solid-icon,
  .sidebar-sub-btn[data-active="true"] .bx-solid-icon,
  a.active.sidebar-sub-btn .bx-solid-icon {
    display: inline-block !important;
  }

  .sidebar-sub-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.4s ease;
    pointer-events: none;
    border-radius: 0.375rem;
  }

  .sidebar-sub-btn:hover::before {
    left: 100%;
    animation: metallicShine 0.5s ease;
  }

  /* Lucide icons - add fill on active/hover */
  .sidebar-interactive-btn .lucide-icon {
    transition: all 0.2s ease;
  }
  
  .sidebar-interactive-btn.active .lucide-icon,
  .sidebar-interactive-btn[data-active="true"] .lucide-icon,
  a.active.sidebar-interactive-btn .lucide-icon {
    filter: drop-shadow(0 0 0 currentColor);
    stroke-width: 2.5px;
  }

  /* Skeleton loading animation */
  @keyframes skeleton-pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

`;

// Inject styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'sidebar-interactive-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = sidebarButtonStyles;
    document.head.appendChild(style);
  }
}

const primaryLinks = [
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard
  },
  { 
    title: "Attendance", 
    url: "/dashboard/attendance", 
    icon: CalendarCheck
  },
  { 
    title: "Devices", 
    url: "/dashboard/devices", 
    icon: Cpu
    
  },
];

const analyticsSubTabs = [
  { title: "Users", view: "users", iconRegular: "bx-group", iconSolid: "bxs-group" },
  { title: "Attendance", view: "attendance", iconRegular: "bx-calendar-check", iconSolid: "bxs-calendar-check" },
  { title: "Devices", view: "devices", iconRegular: "bx-mobile-vibration", iconSolid: "bxs-mobile-vibration" },
  { title: "Organization", view: "organization", iconRegular: "bx-building", iconSolid: "bxs-building" },
  { title: "Subscription", view: "subscription", iconRegular: "bx-credit-card", iconSolid: "bxs-credit-card" },
];

const companyUserTabs = [
  { title: "Employees List", view: "list", iconRegular: "bxs-user-detail", iconSolid: "bxs-user-detail" },
  { title: "Departments", view: "departments", iconRegular: "bx-building-house", iconSolid: "bxs-building-house" },
  { title: "Positions", view: "positions", iconRegular: "bx-briefcase", iconSolid: "bxs-briefcase" },
];

const educationUserTabs = [
  { title: "Members List", view: "list", iconRegular: "bxs-user-detail", iconSolid: "bxs-user-detail" },
  { title: "Trades and Sections", view: "sections", iconRegular: "bx-layer", iconSolid: "bxs-layer" },
  { title: "Classes", view: "classes", iconRegular: "bx-book-open", iconSolid: "bxs-book-open" },
  { title: "Departments", view: "departments", iconRegular: "bx-building-house", iconSolid: "bxs-building-house" },
  { title: "Positions", view: "positions", iconRegular: "bx-briefcase", iconSolid: "bxs-briefcase" },
];

// Loading Skeleton Components with muted colors
const SidebarMenuSkeleton = () => (
  <div className="space-y-2 px-3">
    <div className="h-4 w-20 bg-muted/60 rounded animate-pulse mb-3"></div>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <div className="h-5 w-5 bg-muted/60 rounded animate-pulse"></div>
        <div className="h-4 flex-1 bg-muted/60 rounded animate-pulse"></div>
      </div>
    ))}
  </div>
);

const SidebarConfigSkeleton = () => (
  <div className="space-y-2 px-3">
    <div className="h-4 w-16 bg-muted/60 rounded animate-pulse mb-3"></div>
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <div className="h-5 w-5 bg-muted/60 rounded animate-pulse"></div>
        <div className="h-4 flex-1 bg-muted/60 rounded animate-pulse"></div>
      </div>
    ))}
  </div>
);

const SidebarMoreSkeleton = () => (
  <div className="space-y-2 px-3">
    <div className="h-4 w-16 bg-muted/60 rounded animate-pulse mb-3"></div>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <div className="h-5 w-5 bg-muted/60 rounded animate-pulse"></div>
        <div className="h-4 flex-1 bg-muted/60 rounded animate-pulse"></div>
      </div>
    ))}
  </div>
);

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

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
    const loadData = async () => {
      await fetchSubscriptionInfo();
      setInitialLoading(false);
    };
    loadData();
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

  // Show skeleton loading while initial data is loading
if (initialLoading) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="p-3 flex items-center gap-3 border-b border-sidebar-border bg-sidebar-accent/60">
        <div className={cn(collapsed 
                ? "w-8 h-8 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-md"
                : "w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-md")}>
          <span className={cn(collapsed ? "text-xm font-bold" : "text-primary-foreground font-heading font-bold text-lg")}>CS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="h-4 w-12 bg-muted/60 rounded animate-pulse"></div>
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse mt-1"></div>
          </div>
        )}
      </div>

      <SidebarContent className="px-1 py-3 flex-1">
        <SidebarMenuSkeleton />
        <div className="my-4"></div>
        <SidebarConfigSkeleton />
        <div className="my-4"></div>
        <SidebarMoreSkeleton />
      </SidebarContent>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-3">
        {!collapsed && (
          <div className="p-3 rounded-xl bg-muted/30 animate-pulse">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 bg-muted/60 rounded animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted/60 rounded animate-pulse"></div>
                  <div className="h-3 w-32 bg-muted/60 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="h-8 w-full bg-muted/60 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}
        <div className="h-8 w-full bg-muted/60 rounded animate-pulse"></div>
      </div>
    </Sidebar>
  );
}

  const renderPrimaryLinks = () => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {primaryLinks.map((item) => {
            const isActive = location.pathname === item.url || (item.url === "/dashboard" && location.pathname === "/dashboard");
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/dashboard"}
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                    isActive={() => isActive}
                  >
                    <Icon className="h-5 w-5 shrink-0 lucide-icon" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/dashboard/categories"
                end
                className={`${linkClasses} sidebar-interactive-btn`}
                activeClassName="active bg-primary/15 text-primary font-medium"
              >
                <i className="bx bxs-network-chart bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                <i className="bx bx-network-chart bx-regular-icon" style={{ fontSize: '18px' }}></i>
                {!collapsed && <span>Organize</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              isActive={analyticsActive}
              onClick={() => navigate("/dashboard/analytics?view=users")}
              className={`flex items-center gap-3 w-full sidebar-interactive-btn ${analyticsActive ? 'active' : ''}`}
            >
              <i className="bx bxs-bar-chart-alt-2 bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
              <i className="bx bx-bar-chart-alt-2 bx-regular-icon" style={{ fontSize: '18px' }}></i>
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
                {analyticsSubTabs.map((tab) => {
                  const isSubActive = analyticsActive && analyticsView === tab.view;
                  return (
                    <SidebarMenuSubItem key={tab.view}>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={isSubActive}
                        className={`sidebar-sub-btn ${isSubActive ? 'active' : ''}`}
                      >
                        <Link to={`/dashboard/analytics?view=${tab.view}`} className="flex items-center gap-2 w-full">
                          <i className={`bx ${tab.iconSolid} bx-solid-icon`} style={{ fontSize: '16px', display: 'none' }}></i>
                          <i className={`bx ${tab.iconRegular} bx-regular-icon`} style={{ fontSize: '16px' }}></i>
                          <span>{tab.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>

          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              isActive={usersActive}
              onClick={() => navigate("/dashboard/users?view=list")}
              className={`flex items-center gap-3 w-full sidebar-interactive-btn ${usersActive ? 'active' : ''}`}
            >
              <i className="bx bxs-group bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
              <i className="bx bx-group bx-regular-icon" style={{ fontSize: '18px' }}></i>
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
                {userSubTabs.map((tab) => {
                  const isSubActive = usersActive && usersView === tab.view;
                  return (
                    <SidebarMenuSubItem key={tab.view}>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={isSubActive}
                        className={`sidebar-sub-btn ${isSubActive ? 'active' : ''}`}
                      >
                        <Link to={`/dashboard/users?view=${tab.view}`} className="flex items-center gap-2 w-full">
                          <i className={`bx ${tab.iconSolid} bx-solid-icon`} style={{ fontSize: '16px', display: 'none' }}></i>
                          <i className={`bx ${tab.iconRegular} bx-regular-icon`} style={{ fontSize: '16px' }}></i>
                          <span>{tab.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
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
    
    const subscriptionStatus = org?.subscription_status || "none";
    const planName = org?.subscription_plan?.display_name || (subscriptionStatus === "trial" ? "Trial Plan" : "Free Plan");
    const trialEndsAt = org?.trial_ends_at;
    const subscriptionEndsAt = org?.subscription_expires_at;
    const usersLimit = org?.subscription_plan?.max_users === null ? 999999 : (org?.subscription_plan?.max_users || 200);
    const usersUsed = org?.current_users_count || 0;
    
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

    const isNearExpiry = daysRemaining !== null && daysRemaining <= 7;

    // Active Paid Plan - No progress bar
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
          
          {isNearExpiry && daysRemaining && (
            <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
              <i className="bx bx-time"></i>
              Expires in {daysRemaining} days
            </p>
          )}
          
          <button
            type="button"
            className="w-full mt-3 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 text-sm font-semibold py-1.5 transition-opacity border border-green-500/30 sidebar-interactive-btn"
            onClick={() => navigate("/dashboard/billing")}
          >
            Manage Subscription
          </button>
        </div>
      );
    }

    // Trial Plan - WITH Progress Bar
    if (subscriptionStatus === "trial") {
      const isNearEnd = daysRemaining !== null && daysRemaining <= 7;
      const totalTrialDays = 30;
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
          
          {/* Progress Bar - Only for trial */}
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
            className="w-full mt-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 text-sm font-semibold py-1.5 transition-opacity sidebar-interactive-btn"
            onClick={() => navigate("/dashboard/billing")}
          >
            Upgrade Now
          </button>
        </div>
      );
    }

    // Expired Plan - No progress bar
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
            className="w-full mt-3 rounded-full bg-red-500 text-white hover:bg-red-600 text-sm font-semibold py-1.5 transition-opacity sidebar-interactive-btn"
            onClick={() => navigate("/dashboard/billing")}
          >
            Renew Subscription
          </button>
        </div>
      );
    }

    // Free / No Plan - No progress bar
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
            className="w-full rounded-full bg-primary-foreground text-primary text-sm font-semibold py-1.5 hover:opacity-90 transition-opacity sidebar-interactive-btn"
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
                ? "w-8 h-8 gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-md mb-0 mr1 mt-1"
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
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-chip bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-chip bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Device Config</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/wifi-config"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    {/*<i className="bx bxs-wifi bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>*/}
                    <i className="bx bx-wifi" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Wi-Fi Config</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/settings"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-cog bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-cog bx-regular-icon" style={{ fontSize: '18px' }}></i>
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
                    to="/dashboard/account"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-user bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-user bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Account</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/billing"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-credit-card bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-credit-card bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Billing</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/hardware-shop"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-store bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-store bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Hardware Shop</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/notifications"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-bell bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-bell bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Notifications</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/reports"
                    end
                    className={`${linkClasses} sidebar-interactive-btn`}
                    activeClassName="active bg-primary/15 text-primary font-medium"
                  >
                    <i className="bx bxs-file bx-solid-icon" style={{ fontSize: '18px', display: 'none' }}></i>
                    <i className="bx bx-file bx-regular-icon" style={{ fontSize: '18px' }}></i>
                    {!collapsed && <span>Reports</span>}
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
              "transition-all duration-200 group sidebar-interactive-btn",
              collapsed 
                ? "w-8 h-8 rounded-40 p-0 mr-20 items-center justify-center bg-[hsl(var(--out-bg))] text-destructive hover:bg-[hsl(var(--out-bg)/0.8)] hover:text-red-5" 
                : "w-full justify-start gap-3 px-3 py-2 bg-[hsl(var(--out-bg))] text-destructive hover:bg-[hsl(var(--out-bg)/0.8)] hover:text-red-5"
            )}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {/*<i className="bx bxs-log-out-circle bx-solid-icon" style={{ fontSize: '20px', display: 'none' }}></i>*/}
            <i className="bx bx-log-out-circle" style={{ fontSize: '20px' }}></i>
            {!collapsed && <span>Logout</span>}
          </Button>

        {!collapsed && (
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground sidebar-interactive-btn"
            onClick={() => navigate(`${DOCS_BASE_URL}/#legal_docs`)}
          >
            Our Terms of Service
          </button>
        )}
      </div>
    </Sidebar>
  );
}