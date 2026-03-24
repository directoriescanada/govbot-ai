"use client";

import { Tender } from "@/types/tender";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS, AI_CATEGORIES } from "@/lib/constants";
import { formatCurrency, daysUntil, getScoreBg, getUrgencyColor } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { AICategory } from "@/types/tender";
import { FileEdit } from "lucide-react";
import Link from "next/link";

interface TenderListProps {
  tenders: Tender[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function TenderList({ tenders, selectedId, onSelect }: TenderListProps) {
  if (tenders.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        No tenders match your filters.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tenders.map((tender) => {
        const days = daysUntil(tender.closingDate);
        const score = tender.computedScore || 0;
        const isSelected = selectedId === tender.id;

        return (
          <div
            key={tender.id}
            className={cn(
              "px-6 py-4 transition-colors",
              isSelected
                ? "bg-primary/4 border-l-[3px] border-l-primary"
                : "border-l-[3px] border-l-transparent hover:bg-muted/40"
            )}
          >
            <button
              onClick={() => onSelect(isSelected ? null : tender.id)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {tender.externalId}
                    </span>
                    <span className={cn("text-[11px] font-medium", getUrgencyColor(days))}>
                      {days}d left
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-foreground mb-1">
                    {tender.title}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {tender.department}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {tender.aiCategories.slice(0, 2).map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 font-normal",
                          CATEGORY_COLORS[cat]
                        )}
                      >
                        {AI_CATEGORIES[cat as AICategory]?.label || cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold",
                      getScoreBg(score)
                    )}
                  >
                    {score}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {formatCurrency(tender.estimatedValue)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {tender.source}
                  </span>
                </div>
              </div>
            </button>

            {/* Quick actions row */}
            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/60">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs px-3"
                asChild
              >
                <Link href={`/bid-generator?tender=${tender.id}&title=${encodeURIComponent(tender.title)}&dept=${encodeURIComponent(tender.department)}&desc=${encodeURIComponent(tender.description.slice(0, 500))}&value=${tender.estimatedValue}`}>
                  <FileEdit className="mr-1.5 h-3 w-3" />
                  Quick Bid
                </Link>
              </Button>
              <span className="text-[10px] text-muted-foreground">
                AI Score: {tender.aiScore}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
