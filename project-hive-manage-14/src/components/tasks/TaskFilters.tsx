import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X, Filter, Search } from 'lucide-react';

export interface TaskFilters {
  status?: string;
  priority?: string;
  overdue?: boolean;
  assignedTo?: string;
  title?: string;
}

interface TaskFiltersProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  teamMembers?: Array<{ id: string; name: string }>;
}

const TaskFiltersComponent: React.FC<TaskFiltersProps> = ({
  filters,
  onFiltersChange,
  teamMembers = []
}) => {
  const handleFilterChange = (key: keyof TaskFilters, value: string | boolean | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== undefined);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo':
        return 'Pendente';
      case 'doing':
        return 'Em Progresso';
      case 'done':
        return 'Concluída';
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Baixa';
      case 'medium':
        return 'Média';
      case 'high':
        return 'Alta';
      default:
        return priority;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro por Título */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar por título
          </label>
          <Input
            type="text"
            placeholder="Digite o título da tarefa..."
            value={filters.title || ''}
            onChange={(e) => handleFilterChange('title', e.target.value || undefined)}
            className="w-full"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro por Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="todo">Pendente</SelectItem>
                <SelectItem value="doing">Em Progresso</SelectItem>
                <SelectItem value="done">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Prioridade */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prioridade</label>
            <Select
              value={filters.priority || 'all'}
              onValueChange={(value) => handleFilterChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Responsável */}
          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsável</label>
              <Select
                value={filters.assignedTo || 'all'}
                onValueChange={(value) => handleFilterChange('assignedTo', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  <SelectItem value="unassigned">Não atribuída</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filtro por Tarefas Atrasadas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prazo</label>
            <Select
              value={filters.overdue ? 'overdue' : 'all'}
              onValueChange={(value) => handleFilterChange('overdue', value === 'overdue')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os prazos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os prazos</SelectItem>
                <SelectItem value="overdue">Apenas atrasadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtros Ativos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm font-medium text-muted-foreground">Filtros ativos:</span>
            {filters.status && (
              <Badge variant="secondary" className="text-xs">
                Status: {getStatusLabel(filters.status)}
                <button
                  onClick={() => handleFilterChange('status', undefined)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.priority && (
              <Badge variant="secondary" className="text-xs">
                Prioridade: {getPriorityLabel(filters.priority)}
                <button
                  onClick={() => handleFilterChange('priority', undefined)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.assignedTo && (
              <Badge variant="secondary" className="text-xs">
                Responsável: {filters.assignedTo === 'unassigned' ? 'Não atribuída' : 
                  teamMembers.find(m => m.id === filters.assignedTo)?.name || 'Desconhecido'}
                <button
                  onClick={() => handleFilterChange('assignedTo', undefined)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.overdue && (
              <Badge variant="secondary" className="text-xs">
                Apenas atrasadas
                <button
                  onClick={() => handleFilterChange('overdue', undefined)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.title && (
              <Badge variant="secondary" className="text-xs">
                Título: {filters.title}
                <button
                  onClick={() => handleFilterChange('title', undefined)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskFiltersComponent;