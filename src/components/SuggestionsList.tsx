import { format, parseISO } from "date-fns";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import type { TaskSuggestion } from "../services/taskEngine.ts";

interface SuggestionsListProps {
  suggestions: TaskSuggestion[];
  plantNames: Map<string, string>;
  onAccept: (suggestion: TaskSuggestion) => Promise<void>;
  onDismiss: (suggestion: TaskSuggestion) => Promise<void>;
  showBadge?: boolean;
}

export default function SuggestionsList({
  suggestions,
  plantNames,
  onAccept,
  onDismiss,
  showBadge = false,
}: SuggestionsListProps) {
  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <Card
          key={`${s.ruleId}-${s.plantInstanceId}`}
          className="border-green-200 bg-green-50/30"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {s.title}
                </span>
                {showBadge && <Badge variant="default">Suggested</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                {plantNames.get(s.plantInstanceId) ?? "Unknown plant"}
                {" \u00b7 "}Due {format(parseISO(s.dueDate), "MMM d")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                onClick={() => void onAccept(s)}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onDismiss(s)}
                className="text-text-secondary"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
