"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, TrendingUp, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/scoring";

interface CompetitorIntelData {
  topWinners: Array<{ vendor: string; winCount: number; avgValue: number }>;
  avgContractValue: number;
  typicalBidderCount: number;
  departmentInsights: {
    totalAwards: number;
    uniqueVendors: number;
    avgValue: number;
    trend: string;
  };
}

interface CompetitorIntelProps {
  department: string;
  category: string;
  estimatedValue: number;
}

export function CompetitorIntel({ department, category, estimatedValue }: CompetitorIntelProps) {
  const [data, setData] = useState<CompetitorIntelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIntel() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          department,
          category,
          estimatedValue: String(estimatedValue),
        });
        const res = await fetch(`/api/award-intel/competitor?${params}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch competitor intel", err);
      } finally {
        setLoading(false);
      }
    }

    if (department) {
      fetchIntel();
    }
  }, [department, category, estimatedValue]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-xs text-muted-foreground">
        No competitor intelligence available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Trophy className="h-3.5 w-3.5" />
        Competitor Intelligence
      </h3>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-2.5 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Avg Contract
          </p>
          <p className="text-sm font-extrabold font-mono text-amber-600">
            {formatCurrency(data.avgContractValue)}
          </p>
        </Card>
        <Card className="p-2.5 bg-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Est. Bidders
          </p>
          <p className="text-sm font-extrabold font-mono text-blue-600">
            ~{data.typicalBidderCount}
          </p>
        </Card>
      </div>

      {/* Top Winners */}
      {data.topWinners.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            <Users className="h-3 w-3" />
            Top Winners
          </h4>
          <div className="space-y-1.5">
            {data.topWinners.map((winner, i) => (
              <div
                key={winner.vendor}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="truncate text-muted-foreground">{winner.vendor}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge variant="outline" className="text-[9px] px-1.5">
                    {winner.winCount} wins
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatCurrency(winner.avgValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Insights */}
      <div>
        <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          <Building2 className="h-3 w-3" />
          Department Insights
        </h4>
        <Card className="p-3 bg-muted/30 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total Awards</span>
            <span className="font-semibold">{data.departmentInsights.totalAwards}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Unique Vendors</span>
            <span className="font-semibold">{data.departmentInsights.uniqueVendors}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Avg Value</span>
            <span className="font-semibold font-mono">
              {formatCurrency(data.departmentInsights.avgValue)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Trend</span>
            <Badge
              variant="outline"
              className={`text-[9px] ${
                data.departmentInsights.trend === "growing"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : data.departmentInsights.trend === "declining"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              {data.departmentInsights.trend}
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
