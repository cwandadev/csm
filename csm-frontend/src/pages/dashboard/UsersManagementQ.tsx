import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Search, Edit, Trash2, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usersApi } from "@/lib/api";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  card_uid: string;
  is_active: number;
  department?: string;
  class?: string;
}

const UsersManagement = () => {
  const { admin } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const tabs = admin?.organizationType === "company"
    ? [
        { view: "list", label: "Users List" },
        { view: "departments", label: "Department" },
        { view: "categories", label: "Category" },
      ]
    : [
        { view: "list", label: "Users List" },
        { view: "trades", label: "Trades" },
        { view: "classes", label: "Classes" },
      ];

  const selectedView = searchParams.get("view") || "list";
  const activeView = tabs.some((tab) => tab.view === selectedView) ? selectedView : "list";

  useEffect(() => {
    if (admin?.organizationId) {
      fetchUsers();
    }
  }, [admin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getUsers(admin?.organizationId || "");
      if (res.success && res.data) {
        const data = res.data as any[];
        const formatted = data.map((user: any) => ({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email || "",
          phone: user.phone || "",
          role: user.role,
          card_uid: user.card_uid || "Not assigned",
          is_active: user.is_active,
          department: user.department || (user.role === "student" ? "General" : "Staff"),
        }));
        setUsers(formatted);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = `${u.first_name} ${u.last_name} ${u.email} ${u.card_uid}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const scopedUsers = useMemo(() => {
    if (activeView === "departments" || activeView === "classes") {
      return filtered.filter((u) => u.role === "student");
    }
    if (activeView === "categories" || activeView === "trades") {
      return filtered.filter((u) => u.role === "employee");
    }
    return filtered;
  }, [activeView, filtered]);

  const grouped = useMemo(() => {
    return scopedUsers.reduce<Record<string, number>>((acc, user) => {
      const key = user.department || "General";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [scopedUsers]);

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Role", "Card UID", "Status"];
    const csvData = scopedUsers.map(u => [
      `${u.first_name} ${u.last_name}`,
      u.email,
      u.phone,
      u.role,
      u.card_uid,
      u.is_active ? "Active" : "Inactive"
    ]);
    
    const csvContent = [headers, ...csvData].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Users Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{tabs.find((tab) => tab.view === activeView)?.label} segment.</p>
        </div>
        <div className="flex gap-2">
          <Button className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add User
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button 
            key={tab.view} 
            asChild 
            variant={activeView === tab.view ? "default" : "outline"} 
            className={activeView === tab.view ? "gradient-primary text-primary-foreground" : ""}
          >
            <Link to={`/dashboard/users?view=${tab.view}`}>{tab.label}</Link>
          </Button>
        ))}
      </div>

      {activeView !== "list" && Object.keys(grouped).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(grouped).map(([name, count]) => (
            <Card key={name} className="border border-border/60 bg-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{name}</p>
                <p className="text-2xl font-heading font-bold text-foreground">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, email, card UID..." 
                className="pl-9" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Card UID</TableHead>
                <TableHead>Dept/Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                scopedUsers.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        {u.first_name} {u.last_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "student" ? "secondary" : "default"} 
                        className={u.role === "student" ? "" : "gradient-primary text-primary-foreground border-0"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{u.card_uid}</TableCell>
                    <TableCell className="text-muted-foreground">{u.department || "General"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? "text-success" : "text-destructive"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-success" : "bg-destructive"}`} />
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersManagement;