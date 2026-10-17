import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  PieChart as PieIcon,
  Users,
} from "lucide-react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Shoot = Tables<"shoots">;
type TeamMember = Tables<"team_members">;
type Assignment = Tables<"shoot_assignments">;

interface AnalyticsSectionProps {
  shoots: Shoot[];
  team: TeamMember[];
  assignments: Assignment[];
}

const LUXURY_PALETTE = [
  "#c56c7d", // Rose
  "#e7a0ad", // Blush
  "#d9b98c", // Champagne
  "#762d40", // Burgundy
  "#91c1fa", // Muted Blue
  "#71d8aa", // Mint
  "#f1b75a", // Gold
  "#a08d96", // Mauve
];

export function AnalyticsSection({ shoots, team, assignments }: AnalyticsSectionProps) {
  const [roleFilter, setRoleFilter] = useState("All");
  const [dateRange, setDateRange] = useState<"all" | "past30" | "next30" | "thisYear">("all");

  // Date filtering logic
  const now = new Date();
  const filteredShoots = useMemo(() => {
    return shoots.filter((s) => {
      if (dateRange === "all") return true;
      const eventDate = parseISO(s.event_date);
      if (dateRange === "past30") {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return eventDate >= past && eventDate <= now;
      }
      if (dateRange === "next30") {
        const next = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return eventDate >= now && eventDate <= next;
      }
      if (dateRange === "thisYear") {
        return eventDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [shoots, dateRange]);

  const shootIdsSet = useMemo(() => new Set(filteredShoots.map((s) => s.id)), [filteredShoots]);
  const activeAssignments = useMemo(
    () => assignments.filter((a) => shootIdsSet.has(a.shoot_id)),
    [assignments, shootIdsSet]
  );

  // 1. Role Distribution (Pie / Donut)
  const roleDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    team.forEach((m) => {
      counts[m.role] = (counts[m.role] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [team]);

  // 2. Assignments by Worker (Bar Chart)
  const workerAssignmentData = useMemo(() => {
    const counts: Record<string, { name: string; onSite: number; postProd: number; total: number }> =
      {};
    team.forEach((m) => {
      counts[m.id] = { name: m.full_name, onSite: 0, postProd: 0, total: 0 };
    });

    activeAssignments.forEach((a) => {
      if (counts[a.team_member_id]) {
        if (a.assignment_type === "on_site") {
          counts[a.team_member_id].onSite += 1;
        } else {
          counts[a.team_member_id].postProd += 1;
        }
        counts[a.team_member_id].total += 1;
      }
    });

    return Object.values(counts)
      .filter((w) => w.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [team, activeAssignments]);

  // 3. Workload by Role
  const workloadByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    activeAssignments.forEach((a) => {
      const member = team.find((m) => m.id === a.team_member_id);
      if (member) {
        counts[member.role] = (counts[member.role] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([role, assignmentsCount]) => ({
      role,
      assignments: assignmentsCount,
    }));
  }, [activeAssignments, team]);

  // 4. Staffing Coverage by Shoot
  const staffingCoverage = useMemo(() => {
    return filteredShoots.slice(0, 8).map((s) => {
      const assigned = activeAssignments.filter((a) => a.shoot_id === s.id).length;
      const planned = s.planned_team_size;
      const coveragePct = Math.min(100, Math.round((assigned / planned) * 100));
      return {
        name: s.couple_name,
        planned,
        assigned,
        coveragePct,
        status: s.status,
      };
    });
  }, [filteredShoots, activeAssignments]);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#30282e] bg-[#151317] p-4">
        <div className="flex items-center gap-2 text-xs text-[#b8adb2]">
          <Filter className="size-4 text-[#e7a0ad]" />
          <span>Analytics Filter:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="rounded-lg border border-[#30282e] bg-[#1d171d] px-3 py-1.5 text-xs text-[#f7f0ee]"
          >
            <option value="all">All Dates</option>
            <option value="past30">Past 30 Days</option>
            <option value="next30">Next 30 Days</option>
            <option value="thisYear">This Year</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#82767d]">Total Shoots</p>
          <p className="mt-2 font-serif text-3xl text-[#f7f0ee]">{filteredShoots.length}</p>
          <p className="mt-1 text-[11px] text-[#b8adb2]">In selected timeframe</p>
        </div>
        <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#82767d]">
            Total Crew Assignments
          </p>
          <p className="mt-2 font-serif text-3xl text-[#c56c7d]">{activeAssignments.length}</p>
          <p className="mt-1 text-[11px] text-[#b8adb2]">Across all shoots</p>
        </div>
        <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#82767d]">Active Team Members</p>
          <p className="mt-2 font-serif text-3xl text-[#d9b98c]">{team.length}</p>
          <p className="mt-1 text-[11px] text-[#b8adb2]">In studio directory</p>
        </div>
        <div className="rounded-xl border border-[#30282e] bg-[#151317] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#82767d]">
            Avg Crew Per Shoot
          </p>
          <p className="mt-2 font-serif text-3xl text-[#71d8aa]">
            {filteredShoots.length > 0
              ? (activeAssignments.length / filteredShoots.length).toFixed(1)
              : "0"}
          </p>
          <p className="mt-1 text-[11px] text-[#b8adb2]">Assigned per celebration</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Role Distribution Donut Chart */}
        <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-[#f7f0ee]">Studio Role Distribution</h2>
            <p className="text-xs text-[#82767d]">Composition of studio roster by skill set</p>
          </div>
          {roleDistribution.length === 0 ? (
            <div className="grid h-64 place-items-center text-xs text-[#82767d]">
              No team members to display.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {roleDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={LUXURY_PALETTE[index % LUXURY_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1b181d",
                      borderColor: "#30282e",
                      borderRadius: "8px",
                      color: "#f7f0ee",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: "#b8adb2" }}
                    formatter={(value) => <span className="text-[#b8adb2]">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Worker Assignments Bar Chart */}
        <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-[#f7f0ee]">Top Worker Assignments</h2>
            <p className="text-xs text-[#82767d]">
              Number of assigned events per team member (volume only, not quality score)
            </p>
          </div>
          {workerAssignmentData.length === 0 ? (
            <div className="grid h-64 place-items-center text-xs text-[#82767d]">
              No assignments recorded yet.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerAssignmentData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="#82767d" fontSize={11} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#82767d"
                    fontSize={11}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1b181d",
                      borderColor: "#30282e",
                      borderRadius: "8px",
                      color: "#f7f0ee",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="onSite" name="On-site" stackId="a" fill="#c56c7d" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="postProd" name="Post-production" stackId="a" fill="#d9b98c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Staffing Coverage Table */}
        <section className="rounded-2xl border border-[#30282e] bg-[#151317] p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-serif text-xl text-[#f7f0ee]">Staffing Coverage by Shoot</h2>
            <p className="text-xs text-[#82767d]">
              Comparison between planned crew size and confirmed assignments
            </p>
          </div>
          {staffingCoverage.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#82767d]">
              No shoots found in the current selection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#30282e] text-[#82767d]">
                    <th className="py-2.5 font-medium">Shoot / Event</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="py-2.5 font-medium">Planned Crew</th>
                    <th className="py-2.5 font-medium">Assigned</th>
                    <th className="py-2.5 font-medium">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242026]">
                  {staffingCoverage.map((item) => (
                    <tr key={item.name} className="hover:bg-[#1b181d]">
                      <td className="py-3 font-medium text-[#f7f0ee]">{item.name}</td>
                      <td className="py-3 text-[#b8adb2]">{item.status}</td>
                      <td className="py-3 text-[#b8adb2]">{item.planned}</td>
                      <td className="py-3 text-[#f7f0ee]">{item.assigned}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-[#30282e] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${item.coveragePct}%`,
                                backgroundColor:
                                  item.coveragePct >= 100
                                    ? "#71d8aa"
                                    : item.coveragePct >= 60
                                      ? "#f1b75a"
                                      : "#f16c78",
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-[#b8adb2]">{item.coveragePct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
