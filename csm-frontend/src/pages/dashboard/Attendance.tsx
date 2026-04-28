import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Download, Trash2, Loader2, RefreshCw, Plus, ClipboardCheck, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ScheduleCard from "@/components/attendance/ScheduleCard";
import ScheduleDialog from "@/components/attendance/ScheduleDialog";
import ManualAttendanceDialog from "@/components/attendance/ManualAttendanceDialog";
import AttendanceStats from "@/components/attendance/AttendanceStats";

const AttendancePage = () => {
  // Records state
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Schedules state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [deleteScheduleOpen, setDeleteScheduleOpen] = useState(false);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<any>(null);

  // Manual attendance
  const [manualOpen, setManualOpen] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState("records");

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendance({ status: statusFilter, method: methodFilter, page, limit: 50 });
      setRecords(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const data = await api.getSchedules();
      setSchedules(data || []);
    } catch {
      setSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [statusFilter, methodFilter, page]);
  useEffect(() => { fetchSchedules(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAttendance(deleteTarget.id);
      toast.success("Record deleted");
      fetchAttendance();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleSaveSchedule = async (data: any) => {
    if (editingSchedule) {
      await api.updateSchedule(editingSchedule.id, data);
      toast.success("Schedule updated");
    } else {
      await api.createSchedule(data);
      toast.success("Schedule created");
    }
    fetchSchedules();
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleTarget) return;
    try {
      await api.deleteSchedule(deleteScheduleTarget.id);
      toast.success("Schedule deleted");
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete schedule");
    } finally {
      setDeleteScheduleOpen(false);
      setDeleteScheduleTarget(null);
    }
  };

  const filtered = records.filter((a) =>
    `${a.first_name || ""} ${a.last_name || ""} ${a.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / 50);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      check_in: "bg-success/10 text-success",
      check_out: "bg-warning/10 text-warning",
      present: "bg-primary/10 text-primary",
      absent: "bg-destructive/10 text-destructive",
      late: "bg-warning/10 text-warning",
      early_leave: "bg-destructive/10 text-destructive",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-primary-bold">
            <ClipboardCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Attendance Management</h1>
            <p className="text-sm text-muted-foreground">Track attendance records, manage schedules, and view statistics.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { fetchAttendance(); fetchSchedules(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" className="gradient-primary-bold text-primary-foreground" onClick={() => setManualOpen(true)}>
            <ClipboardCheck className="w-4 h-4 mr-2" /> Manual Attendance
          </Button>
          <Button size="sm" className="gradient-primary-bold text-primary-foreground" onClick={() => { setEditingSchedule(null); setScheduleDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Schedule
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Schedules Section */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" />
            Attendance Schedules ({schedules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No schedules created. Click "New Schedule" to create one.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onEdit={(sc) => { setEditingSchedule(sc); setScheduleDialogOpen(true); }}
                  onDelete={(sc) => { setDeleteScheduleTarget(sc); setDeleteScheduleOpen(true); }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Records / Statistics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[300px] grid-cols-2">
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-36 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="check_in">Check-in</SelectItem>
                    <SelectItem value="check_out">Check-out</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="early_leave">Early Leave</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-36 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="fingerprint">Fingerprint</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="face_recognition">Face</SelectItem>
                    <SelectItem value="backup_code">Backup Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No attendance records found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Date & Time</TableHead>
                          <TableHead className="hidden sm:table-cell">Device</TableHead>
                          <TableHead className="hidden lg:table-cell">Type</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{a.user_role || a.role}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">{a.method?.replace("_", " ")}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`border-0 text-xs capitalize ${statusBadge(a.status)}`}>
                                {a.status?.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {new Date(a.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {a.device_name || "—"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {a.attendance_type_name || "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteTarget(a); setDeleteOpen(true); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                      <span className="flex items-center text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <AttendanceStats />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ManualAttendanceDialog open={manualOpen} onOpenChange={setManualOpen} onSuccess={fetchAttendance} />

      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSave={handleSaveSchedule}
        schedule={editingSchedule}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteScheduleOpen} onOpenChange={setDeleteScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteScheduleTarget?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AttendancePage;
