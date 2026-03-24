"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AwardNotice } from "@/types/tender";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  DollarSign,
  Download,
  Loader2,
  Search,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";

interface IntelSummary {
  totalAwards: number;
  totalAwardValue: number;
  uniqueVendors: number;
  uniqueDepartments: number;
  avgContractValue: number;
  topCategory: string;
  topDepartment: string;
  dataFreshness: string;
}

interface VendorStat {
  name: string;
  count: number;
  total: number;
  departments: string[];
}

interface DeptStat {
  name: string;
  count: number;
  total: number;
  avgValue: number;
}

interface PricingRec {
  recommendedBidPrice: number;
  bidAsPercentOfEstimate: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  historicalRange: { low: number; high: number };
  sampleSize: number;
  competitionLevel: "low" | "medium" | "high";
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<IntelSummary | null>(null);
  const [vendors, setVendors] = useState<VendorStat[]>([]);
  const [departments, setDepartments] = useState<DeptStat[]>([]);
  const [awards, setAwards] = useState<AwardNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pricing tool state
  const [priceDept, setPriceDept] = useState("");
  const [priceCategory, setPriceCategory] = useState("");
  const [priceValue, setPriceValue] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceResult, setPriceResult] = useState<PricingRec | null>(null);

  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, vendorsRes, deptsRes, awardsRes] = await Promise.all([
        fetch("/api/award-intel?summary=true"),
        fetch("/api/award-intel?vendors=true&limit=10"),
        fetch("/api/award-intel?departments=true"),
        fetch("/api/award-intel"),
      ]);

      if (!summaryRes.ok || !vendorsRes.ok || !deptsRes.ok || !awardsRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const summaryData = await summaryRes.json();
      const vendorsData = await vendorsRes.json();
      const deptsData = await deptsRes.json();
      const awardsData = await awardsRes.json();

      setSummary(summaryData);
      setVendors(vendorsData);
      setDepartments(deptsData);
      setAwards(awardsData.awards || awardsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute vendor stats client-side from awards (as fallback if vendors endpoint returns different shape)
  const vendorStats = useMemo(() => {
    if (vendors.length > 0 && vendors[0].name) return vendors;
    // Fallback: compute from awards
    const map: Record<string, { name: string; count: number; total: number; departments: string[] }> = {};
    (Array.isArray(awards) ? awards : []).forEach((a: AwardNotice) => {
      if (!map[a.vendorName]) {
        map[a.vendorName] = { name: a.vendorName, count: 0, total: 0, departments: [] };
      }
      map[a.vendorName].count++;
      map[a.vendorName].total += a.contractValue;
      if (!map[a.vendorName].departments.includes(a.department)) {
        map[a.vendorName].departments.push(a.department);
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [vendors, awards]);

  const deptStats = useMemo(() => {
    if (departments.length > 0 && departments[0].name) return departments;
    const map: Record<string, { name: string; count: number; total: number; avgValue: number }> = {};
    (Array.isArray(awards) ? awards : []).forEach((a: AwardNotice) => {
      if (!map[a.department]) {
        map[a.department] = { name: a.department, count: 0, total: 0, avgValue: 0 };
      }
      map[a.department].count++;
      map[a.department].total += a.contractValue;
    });
    const vals = Object.values(map);
    vals.forEach((d) => { d.avgValue = d.count > 0 ? Math.round(d.total / d.count) : 0; });
    return vals.sort((a, b) => b.total - a.total);
  }, [departments, awards]);

  // Filtered awards by date range
  const filteredAwards = useMemo(() => {
    const list = Array.isArray(awards) ? awards : [];
    return list
      .filter((a) => {
        if (dateFrom && a.awardDate < dateFrom) return false;
        if (dateTo && a.awardDate > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.awardDate).getTime() - new Date(a.awardDate).getTime());
  }, [awards, dateFrom, dateTo]);

  const totalAwardValue = summary?.totalAwardValue ?? (Array.isArray(awards) ? awards : []).reduce((s, a) => s + a.contractValue, 0);
  const avgContract = summary?.avgContractValue ?? 0;
  const uniqueVendors = summary?.uniqueVendors ?? new Set((Array.isArray(awards) ? awards : []).map((a) => a.vendorName)).size;
  const repeatVendors = vendorStats.filter((v) => v.count > 1).length;

  async function handleGetRecommendation() {
    if (!priceDept && !priceCategory) return;
    setPriceLoading(true);
    setPriceResult(null);
    try {
      const params = new URLSearchParams({ recommend: "true" });
      if (priceDept) params.set("department", priceDept);
      if (priceCategory) params.set("category", priceCategory);
      if (priceValue) params.set("value", priceValue);
      const res = await fetch(`/api/award-intel?${params.toString()}`);
      if (!res.ok) throw new Error("Recommendation failed");
      const data = await res.json();
      setPriceResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation failed");
    } finally {
      setPriceLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  // Error state
  if (error && !summary && awards.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => { setLoading(true); setError(null); fetchData(); }}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Contract Analytics</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Historical award data analysis from CanadaBuys. Identifies incumbent vendors,
            pricing patterns, and recurring contract opportunities. Use this intelligence
            to price bids competitively and identify teaming partners.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?type=awards&format=csv" download>
              <Download className="mr-2 h-4 w-4" />
              Awards CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?type=analytics&format=csv" download>
              <Download className="mr-2 h-4 w-4" />
              Vendor CSV
            </a>
          </Button>
        </div>
      </div>

      {/* B. Pricing Intelligence Tool */}
      <Card className="p-5 bg-blue-50/50 border-blue-200 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-bold text-blue-900">Get Pricing Recommendation</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-blue-800">Department</Label>
            <Input
              placeholder="e.g., Statistics Canada"
              value={priceDept}
              onChange={(e) => setPriceDept(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-blue-800">Category</Label>
            <Input
              placeholder="e.g., TRANSLATION"
              value={priceCategory}
              onChange={(e) => setPriceCategory(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-blue-800">Estimated Value</Label>
            <Input
              type="number"
              placeholder="e.g., 250000"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              className="bg-white"
            />
          </div>
          <Button
            onClick={handleGetRecommendation}
            disabled={priceLoading || (!priceDept && !priceCategory)}
            className="h-9"
          >
            {priceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Get Recommendation
          </Button>
        </div>
        {priceResult && (
          <div className="mt-4 rounded-md border border-blue-200 bg-white p-4 space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold">
                Recommended Bid: <span className="font-mono text-blue-700">{formatCurrency(priceResult.recommendedBidPrice)}</span>
              </p>
              <Badge variant="outline" className={`text-[10px] ${
                priceResult.confidence === "high" ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : priceResult.confidence === "medium" ? "bg-amber-50 text-amber-700 border-amber-300"
                : "bg-red-50 text-red-700 border-red-300"
              }`}>
                {priceResult.confidence.charAt(0).toUpperCase() + priceResult.confidence.slice(1)} confidence
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{priceResult.reasoning}</p>
            <p className="text-xs text-muted-foreground">
              {priceResult.bidAsPercentOfEstimate}% of estimate | Historical range: {formatCurrency(priceResult.historicalRange.low)} &ndash; {formatCurrency(priceResult.historicalRange.high)} | {priceResult.sampleSize} similar awards
            </p>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Award Value
            </p>
          </div>
          <p className="text-xl font-extrabold font-mono text-primary">
            {formatCurrency(totalAwardValue)}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Avg Contract
            </p>
          </div>
          <p className="text-xl font-extrabold font-mono text-emerald-600">
            {formatCurrency(avgContract)}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Unique Vendors
            </p>
          </div>
          <p className="text-xl font-extrabold font-mono text-amber-600">
            {uniqueVendors}
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-purple-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Repeat Winners
            </p>
          </div>
          <p className="text-xl font-extrabold font-mono text-purple-600">
            {repeatVendors}
          </p>
          <p className="text-xs text-muted-foreground">won 2+ contracts</p>
        </Card>
      </div>

      {/* Top Vendors */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Trophy className="h-4 w-4" />
          Top Vendors by Total Award Value
        </h2>
        <Card className="bg-white shadow-sm overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Vendor</TableHead>
                <TableHead className="text-xs text-right">Awards</TableHead>
                <TableHead className="text-xs text-right">Total Value</TableHead>
                <TableHead className="text-xs text-right">Avg Value</TableHead>
                <TableHead className="text-xs">Departments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorStats.map((vendor, i) => (
                <TableRow key={vendor.name} className="border-border">
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-4">
                        {i + 1}
                      </span>
                      {vendor.name}
                      {vendor.count > 1 && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-500/20">
                          Repeat
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {vendor.count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-emerald-600">
                    {formatCurrency(vendor.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {formatCurrency(Math.round(vendor.total / vendor.count))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(vendor.departments || []).map((d: string) => (
                        <Badge key={d} variant="outline" className="text-[10px]">
                          {d.split(" ").slice(0, 2).join(" ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Department Spending */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Department Spending Analysis
        </h2>
        <div className="space-y-3">
          {deptStats.map((dept) => {
            const pct = totalAwardValue > 0 ? Math.round((dept.total / totalAwardValue) * 100) : 0;
            return (
              <Card key={dept.name} className="p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{dept.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {dept.count} contracts
                    </span>
                    <span className="text-sm font-bold font-mono text-primary">
                      {formatCurrency(dept.total)}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    Avg contract: {formatCurrency(dept.avgValue)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {pct}% of total
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Recent Awards Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            Recent Award History
          </h2>
          {/* C. Date range filter */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <Card className="bg-white shadow-sm overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Department</TableHead>
                <TableHead className="text-xs">Vendor</TableHead>
                <TableHead className="text-xs text-right">Value</TableHead>
                <TableHead className="text-xs text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAwards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No awards found for the selected date range.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAwards.map((award) => (
                  <TableRow key={award.id} className="border-border">
                    <TableCell className="text-sm font-medium max-w-[250px] truncate">
                      {award.title}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {award.department}
                    </TableCell>
                    <TableCell className="text-sm">{award.vendorName}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {formatCurrency(award.contractValue)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(award.awardDate).toLocaleDateString("en-CA")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
