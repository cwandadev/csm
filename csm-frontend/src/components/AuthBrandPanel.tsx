// csms-frontend/src/components/AuthBrandPanel.tsx

'use client';

import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { statsApi } from "@/lib/api";


const AuthBrandPanel = () => {
  const [stats, setStats] = useState({
    organizations: "0",
    users: "0",
    uptime: "99%"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('📊 Fetching dashboard stats...');
        
        // Direct fetch to your backend (no auth required)
        const statusUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const response = await fetch(`${statusUrl}/dashboard/stats`,);
        const result = await response.json();
        
        console.log('📊 API Response:', result);
        
        if (result.success && result.data) {
          // Format numbers
          const formatNumber = (num: number): string => {
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K+`;
            return num.toString();
          };
          
          setStats({
            organizations: formatNumber(result.data.organizations),
            users: formatNumber(result.data.users),
            uptime: result.data.uptime
          });
        } else {
          console.error('API returned error:', result.error);
          // Fallback data
          setStats({
            organizations: "500+",
            users: "1M+",
            uptime: "99.9%"
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        // Fallback data if fetch fails
        setStats({
          organizations: "500+",
          users: "1M+",
          uptime: "99.9%"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statItems = [
    { value: stats.organizations, label: "Organizations" },
    { value: stats.users, label: "Users" },
    { value: stats.uptime, label: "Uptime" },
  ];

  if (loading) {
    return (
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary flex-col items-center justify-center p-12 text-primary-foreground">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative z-10 text-center space-y-6 max-w-md">
          <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
            <Fingerprint className="h-10 w-10 text-white animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-8 bg-white/20 rounded-lg w-48 mx-auto"></div>
            <div className="h-4 bg-white/20 rounded-lg w-64 mx-auto"></div>
          </div>
          <div className="flex items-center justify-center gap-6 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-7 w-16 bg-white/20 rounded"></div>
                <div className="h-3 w-12 bg-white/20 rounded mt-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary flex-col items-center justify-center p-12 text-primary-foreground">
      {/* Background decorative circles */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-white/5" />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5" />

      <div className="relative z-10 text-center space-y-6 max-w-md">
        <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg">
          <Fingerprint className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-heading font-bold">CSM Platform</h1>
        <p className="text-white/80 font-body text-sm leading-relaxed">
          Centralized Service &amp; School Management — IoT-powered smart attendance tracking platform for schools and organizations across Rwanda and beyond.
        </p>
        <div className="flex items-center justify-center gap-6 pt-4">
          {statItems.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-heading font-bold">{stat.value}</div>
              <div className="text-xs text-white/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuthBrandPanel;