import { ChevronDown } from "lucide-react";

interface ModelSelectorProps {
  models: Array<{ id: string; name: string; provider: string }>;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({
  models,
  selectedModelId,
  onModelChange,
}: ModelSelectorProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedModelId}
        onChange={(e) => onModelChange(e.target.value)}
        className="appearance-none bg-transparent pl-0 pr-6 py-1 text-sm font-medium outline-none cursor-pointer"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 w-4 h-4 pointer-events-none text-muted-foreground" />
    </div>
  );
}
