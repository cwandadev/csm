import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Home, IdCard, Moon, Sun, User, CheckCircle } from "lucide-react";

const mockLiveData = [
  { id: 1, name: "Jean Baptiste", role: "student", class: "S1 Science", image: null, time: "08:02 AM", method: "card" },
  { id: 2, name: "Marie Claire", role: "student", class: "S2 Arts", image: null, time: "08:05 AM", method: "fingerprint" },
  { id: 3, name: "Emmanuel Nsabimana", role: "employee", class: "Engineering", image: null, time: "08:10 AM", method: "card" },
  { id: 4, name: "Diane Uwase", role: "student", class: "S3 MPC", image: null, time: "08:12 AM", method: "card" },
  { id: 5, name: "Patrick Niyonzima", role: "employee", class: "HR", image: null, time: "08:15 AM", method: "fingerprint" },
];

const LiveDisplay = () => {
  const { orgSlug } = useParams();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [latestEntry, setLatestEntry] = useState(mockLiveData[0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let idx = 0;
    const cycle = setInterval(() => {
      idx = (idx + 1) % mockLiveData.length;
      setActiveIndex(idx);
      setLatestEntry(mockLiveData[idx]);
    }, 4000);
    return () => clearInterval(cycle);
  }, []);

  const attendanceRate = useMemo(() => {
    const expectedPeople = 500;
    const checkedIn = 430 + activeIndex * 4;
    return Math.min(99, Math.round((checkedIn / expectedPeople) * 100));
  }, [activeIndex]);

  const handleToggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-accent flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-4 left-4 z-20">
      <Link to="/dashboard">
        <Button asChild variant="ghost" size="10px" className="rounded-full bg-card/80 backdrop-blur border border-border">
            <i className="bx bxs-pie-chart-alt-2 p-2.5" style={{ fontSize: '28px' }}/>
        </Button> 
        </Link>
      </div>

      <div className="absolute top-4 right-4 z-20" >
        <Button variant="ghost" size="10px" className="rounded-full bg-card/80 backdrop-blur border border-border" onClick={handleToggleTheme}>
          {dark ? <i className="bx bxs-sun p-2" style={{ fontSize: '28px' }} /> : <i className="bx bxs-moon p-2" style={{ fontSize: '28px' }} /> }
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
        {/* Enhanced ID Card Icon */}
        <div className="relative">
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 shadow-lg flex items-center justify-center backdrop-blur-sm">
            <i className="bx bx-id-card text-white" style={{ fontSize: '60px'}}/>
          </div>
          <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1.5 shadow-lg">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Enhanced Speech Bubble */}
        <div className="relative max-w-md w-full">
          <div className="bg-card rounded-2xl px-8 py-6 border-2 border-primary/20 shadow-xl">
            <p className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              Hey! Tap Your Card...
            </p>
            
            <div className="flex items-center justify-center gap-1 mt-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-300" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-r-2 border-b-2 border-primary/20 rotate-45" />
        </div>

        {/* Enhanced User Card */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-lg max-w-md w-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
              <User className="h-7 w-7 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-bold text-foreground">{latestEntry.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last scan • {latestEntry.time}
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">Organization API {orgSlug?.replace(/-/g, " ") || "demo-organization"}</p>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-1 rounded-full ${latestEntry.method === 'card' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'}`}>
                {latestEntry.method === 'card' ? 'With Card' : 'By Fingerprint'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="text-sm font-semibold text-foreground capitalize">{latestEntry.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Class/Category</p>
              <p className="text-sm font-semibold text-foreground">{latestEntry.class}</p>
            </div>
            <button className="px-4 py-1.5 rounded-full gradient-primary text-primary-foreground text-xs font-bold shadow-md hover:shadow-lg transition-shadow">
              CHECKED IN
            </button>
          </div>
        </div>

        {/* Stats Cards */}
       {/* <div className="grid grid-cols-2 gap-3 max-w-md w-full">

          <Card className="border border-border/60 bg-card/90 shadow-md">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
              <p className="text-2xl font-bold text-primary">{attendanceRate}%</p>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${attendanceRate}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/90 shadow-md">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground text-center">Current Time</p>
              <p className="text-lg font-bold text-foreground text-center">
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1 truncate">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </CardContent>
          </Card>
        </div>*/}
      </div>

      <footer className="text-center p-3 text-xs text-muted-foreground border-t border-border/60">
        Powered by <strong className="text-primary">CSM Platform</strong>
      </footer>
    </div>
  );
};

export default LiveDisplay;