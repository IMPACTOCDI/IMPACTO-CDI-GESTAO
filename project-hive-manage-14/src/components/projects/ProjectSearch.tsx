
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';

interface ProjectSearchProps {
  onSearch: (filters: SearchFilters) => void;
  className?: string;
}

export interface SearchFilters {
  query: string;
  status: string;
  visibility: string;
  dateRange: {
    start: string;
    end: string;
  };
}

const ProjectSearch: React.FC<ProjectSearchProps> = ({ onSearch, className }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const handleSearch = () => {
    onSearch({
      query,
      status,
      visibility,
      dateRange: {
        start: dateStart,
        end: dateEnd
      }
    });
  };

  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setVisibility('all');
    setDateStart('');
    setDateEnd('');
    onSearch({
      query: '',
      status: 'all',
      visibility: 'all',
      dateRange: { start: '', end: '' }
    });
  };

  const hasActiveFilters = query || status !== 'all' || visibility !== 'all' || dateStart || dateEnd;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar projetos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-10"
        />
      </div>
      
      <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filtros Avançados</h4>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="on-hold">Pausado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Visibilidade</label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="public">Público</SelectItem>
                    <SelectItem value="private">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Período</label>
                <div className="space-y-2">
                  <Input
                    type="date"
                    placeholder="Data início"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                  <Input
                    type="date"
                    placeholder="Data fim"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <Button onClick={handleSearch} className="w-full">
              Aplicar Filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ProjectSearch;
