"use client";

import { Badge } from "@/components/ui/badge";
import { AI_CATEGORIES } from "@/lib/constants";
import { AICategory } from "@/types/tender";
import { Tender } from "@/types/tender";
import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  tenders: Tender[];
  activeCategory: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ tenders, activeCategory, onChange }: CategoryFilterProps) {
  const categoryCounts: Record<string, number> = {};
  tenders.forEach((t) => {
    t.aiCategories.forEach((c) => {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        variant={activeCategory === "ALL" ? "default" : "outline"}
        className={cn(
          "cursor-pointer transition-colors text-xs",
          activeCategory === "ALL"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-accent"
        )}
        onClick={() => onChange("ALL")}
      >
        All ({tenders.length})
      </Badge>
      {(Object.entries(AI_CATEGORIES) as [AICategory, typeof AI_CATEGORIES[AICategory]][]).map(
        ([key, cat]) => {
          const count = categoryCounts[key] || 0;
          if (count === 0) return null;
          return (
            <Badge
              key={key}
              variant="outline"
              className={cn(
                "cursor-pointer transition-colors text-xs",
                activeCategory === key
                  ? "bg-primary/8 text-primary border-primary/30"
                  : "hover:bg-accent"
              )}
              onClick={() => onChange(activeCategory === key ? "ALL" : key)}
            >
              {cat.label} ({count})
            </Badge>
          );
        }
      )}
    </div>
  );
}
