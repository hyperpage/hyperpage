import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon?: string;
  color?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  icon,
}: MetricCardProps) {
  const getBadgeVariant = (change: number) => {
    if (change > 0) return "default";
    if (change < 0) return "destructive";
    return "secondary";
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return Minus;
  };

  const TrendIcon = change ? getTrendIcon(change.value) : null;

  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <span className="text-2xl" role="img" aria-label={title}>
            {icon}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">{value}</div>

        {change && TrendIcon && (
          <Badge variant={getBadgeVariant(change.value)} className="text-xs">
            <TrendIcon className="w-3 h-3 mr-1" />
            {Math.abs(change.value)}% {change.label}
          </Badge>
        )}

        {/* Simple sparkline placeholder */}
        <div className="mt-4">
          <div className="flex items-end space-x-1 h-8">
            {[0.4, 0.6, 0.8, 0.5, 0.9, 0.7, 1].map((height, i) => (
              <div
                key={i}
                className="bg-muted flex-1 rounded-sm"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
