import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KanbanFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  assignees: string[];
  assigneesProfiles: Record<string, { name: string }>;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const KanbanFilters: React.FC<KanbanFiltersProps> = ({
  searchTerm,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  assignees,
  assigneesProfiles,
  onClearFilters,
  hasActiveFilters
}) => {
  return (
    <div className="p-4 rounded-lg border shadow-sm space-y-4 bg-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-medium">Filtros</span>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <X className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar tarefas..." 
              value={searchTerm} 
              onChange={e => onSearchChange(e.target.value)} 
              className="pl-10" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Prioridade</label>
          <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as prioridades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prioridades</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Responsável</label>
          <Select value={assigneeFilter} onValueChange={onAssigneeFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {assignees.map(assignee => (
                <SelectItem key={assignee} value={assignee}>
                  {assigneesProfiles[assignee]?.name || 'Usuário'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchTerm && (
            <Badge variant="secondary">
              Busca: "{searchTerm}"
            </Badge>
          )}
          {priorityFilter !== 'all' && (
            <Badge variant="secondary">
              Prioridade: {priorityFilter}
            </Badge>
          )}
          {assigneeFilter !== 'all' && (
            <Badge variant="secondary">
              Responsável: {assigneesProfiles[assigneeFilter]?.name || 'Usuário'}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default KanbanFilters;