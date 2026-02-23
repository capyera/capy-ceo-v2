import { useState } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  Package,
  Truck,
  Calendar,
  Sparkles,
  X,
  ChevronRight,
  Zap,
  Bell,
  Eye,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { generateInsights, type AIInsight, type InsightPriority, type InsightType } from '../services/aiInsights';

const priorityStyles: Record<InsightPriority, { bg: string; border: string; icon: string; badge: string }> = {
  critical: { 
    bg: 'bg-red-50', 
    border: 'border-red-200', 
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-700'
  },
  high: { 
    bg: 'bg-orange-50', 
    border: 'border-orange-200', 
    icon: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700'
  },
  medium: { 
    bg: 'bg-yellow-50', 
    border: 'border-yellow-200', 
    icon: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-700'
  },
  low: { 
    bg: 'bg-blue-50', 
    border: 'border-blue-200', 
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700'
  },
};

const typeIcons: Record<InsightType, typeof AlertTriangle> = {
  stockout_warning: AlertTriangle,
  velocity_spike: TrendingUp,
  velocity_drop: TrendingDown,
  transfer_suggestion: Truck,
  reorder_reminder: Package,
  launch_prep: Calendar,
  overstock_alert: BarChart3,
  margin_opportunity: Zap,
  seasonal_prep: Sparkles,
  trend_alert: Bell,
};

interface AIInsightCardsProps {
  limit?: number;
  showHeader?: boolean;
  compact?: boolean;
  filter?: {
    types?: InsightType[];
    priority?: InsightPriority[];
  };
  onAction?: (action: NonNullable<AIInsight['action']>) => void;
}

export function AIInsightCards({ 
  limit = 5, 
  showHeader = true, 
  compact = false,
  filter,
  onAction 
}: AIInsightCardsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const allInsights = generateInsights();
  
  let insights = allInsights.filter(i => !dismissedIds.has(i.id));
  
  if (filter?.types?.length) {
    insights = insights.filter(i => filter.types!.includes(i.type));
  }
  if (filter?.priority?.length) {
    insights = insights.filter(i => filter.priority!.includes(i.priority));
  }
  
  insights = insights.slice(0, limit);
  
  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };
  
  const handleAction = (insight: AIInsight) => {
    if (insight.action && onAction) {
      onAction(insight.action);
    }
  };
  
  const criticalCount = allInsights.filter(i => i.priority === 'critical').length;
  const highCount = allInsights.filter(i => i.priority === 'high').length;

  if (compact) {
    return (
      <div className="space-y-2">
        {insights.map((insight) => {
          const Icon = typeIcons[insight.type];
          const styles = priorityStyles[insight.priority];
          
          return (
            <div
              key={insight.id}
              className={cn(
                "p-3 rounded-lg border flex items-center gap-3 transition-all hover:shadow-sm cursor-pointer",
                styles.bg,
                styles.border
              )}
              onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", styles.icon)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{insight.title}</p>
                {insight.sku && (
                  <p className="text-xs text-gray-500">{insight.sku}</p>
                )}
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-gray-400 transition-transform",
                expandedId === insight.id && "rotate-90"
              )} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Insights</h3>
              <p className="text-sm text-gray-500">{allInsights.length} active recommendations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="danger">{criticalCount} critical</Badge>
            )}
            {highCount > 0 && (
              <Badge variant="warning">{highCount} high priority</Badge>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {insights.map((insight) => {
          const Icon = typeIcons[insight.type];
          const styles = priorityStyles[insight.priority];
          const isExpanded = expandedId === insight.id;
          
          return (
            <Card 
              key={insight.id} 
              className={cn(
                "border-2 transition-all overflow-hidden",
                styles.border,
                styles.bg,
                "hover:shadow-md"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "p-3 rounded-xl",
                    insight.priority === 'critical' ? 'bg-red-100' :
                    insight.priority === 'high' ? 'bg-orange-100' :
                    insight.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                  )}>
                    <Icon className={cn("w-6 h-6", styles.icon)} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", styles.badge)}>
                            {insight.priority}
                          </span>
                        </div>
                        {insight.sku && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{insight.sku}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => handleDismiss(insight.id)}
                        className="p-1 hover:bg-white/50 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-700 mt-2">{insight.message}</p>
                    
                    {insight.impact && (
                      <p className="text-sm font-medium text-gray-900 mt-2 flex items-center gap-1">
                        <Zap className="w-4 h-4 text-amber-500" />
                        {insight.impact}
                      </p>
                    )}
                    
                    {/* Metrics */}
                    {insight.metrics && insight.metrics.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-4">
                        {insight.metrics.map((metric, idx) => (
                          <div key={idx} className="text-center">
                            <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                              {metric.value}
                              {metric.change !== undefined && (
                                <span className={cn(
                                  "text-xs font-medium",
                                  metric.isPositive ? "text-green-600" : "text-red-600"
                                )}>
                                  {metric.change > 0 ? '+' : ''}{Math.round(metric.change)}%
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{metric.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Action Button */}
                    {insight.action && (
                      <div className="mt-4 flex items-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleAction(insight)}
                          className="gap-1"
                        >
                          {insight.action.label}
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {isExpanded ? 'Less' : 'Details'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium capitalize">{insight.type.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium">{insight.createdAt.toLocaleString()}</p>
                      </div>
                      {insight.expiresAt && (
                        <div>
                          <p className="text-gray-500">Expires</p>
                          <p className="font-medium">{insight.expiresAt.toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {insights.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No active insights</p>
            <p className="text-sm text-gray-400 mt-1">All inventory looks healthy!</p>
          </CardContent>
        </Card>
      )}
      
      {allInsights.length > limit && (
        <div className="text-center">
          <Button variant="outline" size="sm">
            View all {allInsights.length} insights
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Widget version for dashboard
export function AIInsightWidget() {
  const insights = generateInsights().slice(0, 3);
  const criticalCount = insights.filter(i => i.priority === 'critical').length;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          AI Insights
        </CardTitle>
        {criticalCount > 0 && (
          <Badge variant="danger" className="animate-pulse">{criticalCount}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <AIInsightCards limit={3} showHeader={false} compact />
      </CardContent>
    </Card>
  );
}
