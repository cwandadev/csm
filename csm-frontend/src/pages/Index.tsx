// csms-frontend/src/pages/Index.tsx
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Cpu, Users, BarChart3, Wifi, Globe } from "lucide-react";

const Index = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between p-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-md">
            <span className="text-primary-foreground font-heading font-bold text-lg">C</span>
          </div>
          <span className="font-heading font-bold text-xl text-foreground">CSM Platform</span>
        </div>
        <div className="flex gap-2">
          {isAuthenticated ? (
            <Link to="/dashboard"><Button className="gradient-primary text-primary-foreground">Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="outline">Sign In</Button></Link>
              <Link to="/register"><Button className="gradient-primary text-primary-foreground">Get Started</Button></Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" /> ESP32 Powered Smart Attendance
        </div>
        <h1 className="text-4xl md:text-6xl font-heading font-bold text-foreground leading-tight max-w-4xl mx-auto">
          Smart <span className="gradient-text">Card & Fingerprint</span> Attendance System
        </h1>
        <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
          A complete IoT-powered attendance management platform for schools and companies across Rwanda and beyond. Track hundreds of thousands of users in real-time.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link to="/register"><Button size="lg" className="gradient-primary text-primary-foreground font-semibold h-12 px-8">Start Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <a href="https://cwanda.site" target="_blank"><Button size="lg" variant="outline" className="h-12 px-8">Learn More</Button></a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <h2 className="text-3xl font-heading font-bold text-foreground text-center mb-12">Everything You Need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Cpu, title: "ESP32 Devices", desc: "RFID cards & fingerprint scanners powered by ESP32/ESP8266 microcontrollers." },
            { icon: Users, title: "User Management", desc: "Manage students, employees, departments, classes, and roles effortlessly." },
            { icon: BarChart3, title: "Real-time Analytics", desc: "Live dashboards with attendance trends, peak hours, and detailed reports." },
            { icon: Shield, title: "Secure Platform", desc: "Admin roles, session management, and encrypted card/fingerprint data." },
            { icon: Globe, title: "Live Display", desc: "Shareable real-time attendance display with custom URLs per organization." },
            { icon: Wifi, title: "Remote Config", desc: "Configure ESP Wi-Fi and API endpoints remotely from the dashboard." },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-foreground text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 CSM Platform by <a href="https://cwanda.site" className="text-primary hover:underline" target="_blank">Cwanda</a>. Smart Attendance for Africa.
      </footer>
    </div>
  );
};

export default Index;
