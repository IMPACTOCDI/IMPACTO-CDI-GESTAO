import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import EventDialog from './EventDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCalendarEvents, deleteCalendarEvent } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];

interface CalendarItem {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  color: string;
  type: 'event' | 'project' | 'task';
  project_id?: string;
  task_id?: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const { projects } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [allCalendarItems, setAllCalendarItems] = useState<CalendarItem[]>([]);

  useEffect(() => {
    const loadCalendarItems = async () => {
      if (!user?.id) return;

      try {
        // Buscar eventos do calendário
        const events = await getCalendarEvents(user.id);
        const calendarEvents = events.map(event => ({
          ...event,
          type: 'event' as const
        }));

        // Buscar prazos dos projetos
        const projectDeadlines = projects
          .filter(project => project.end_date)
          .map(project => ({
            id: `project-${project.id}`,
            title: `Prazo: ${project.name}`,
            description: `Prazo final do projeto ${project.name}`,
            start_time: project.end_date!,
            end_time: project.end_date!,
            color: 'bg-red-500',
            type: 'project' as const,
            project_id: project.id
          }));

        // Buscar prazos das tarefas
        const taskDeadlines = projects
          .flatMap(project => project.tasks)
          .filter(task => task.due_date)
          .map(task => ({
            id: `task-${task.id}`,
            title: `Prazo: ${task.title}`,
            description: `Prazo da tarefa ${task.title}`,
            start_time: task.due_date!,
            end_time: task.due_date!,
            color: 'bg-yellow-500',
            type: 'task' as const,
            task_id: task.id
          }));

        // Combinar todos os itens
        const allItems = [...calendarEvents, ...projectDeadlines, ...taskDeadlines];
        setAllCalendarItems(allItems);
      } catch (error) {
        console.error('Erro ao carregar itens do calendário:', error);
      }
    };

    loadCalendarItems();
  }, [user?.id, projects]);

  const getMonthData = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const monthData = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      monthData.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayItems = allCalendarItems.filter(item => {
        const itemDate = new Date(item.start_time);
        return itemDate.toISOString().split('T')[0] === dateStr;
      });
      monthData.push({ day, items: dayItems });
    }
    return monthData;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const monthData = getMonthData();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getItemTypeIcon = (item: CalendarItem) => {
    switch (item.type) {
      case 'project':
        return <CalendarIcon className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return '📅';
    }
  };

  const getItemsByDate = (dateStr: string) => {
    return allCalendarItems.filter(item => {
      const itemDate = new Date(item.start_time);
      return itemDate.toISOString().split('T')[0] === dateStr;
    });
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayItems = getItemsByDate(todayStr);

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteCalendarEvent(eventId);
    setAllCalendarItems(items => items.filter(item => item.id !== eventId));
  };

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground">Visualize prazos, eventos e marcos importantes</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedEvent(null);
            setIsEventDialogOpen(true);
          }}
          className="gradient-primary hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl text-card-foreground">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                  className="border-border hover:bg-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigateMonth('next')}
                  className="border-border hover:bg-accent"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                
                {monthData.map((item, index) => (
                  <div 
                    key={index}
                    className={`min-h-[100px] p-1 border border-border bg-card ${
                      item ? 'hover:bg-accent/50' : ''
                    }`}
                  >
                    {item && (
                      <>
                        <div className="text-sm font-medium mb-1 text-card-foreground">{item.day}</div>
                        <div className="space-y-1">
                          {item.items.slice(0, 3).map((calendarItem) => (
                            <div
                              key={calendarItem.id}
                              className={`p-1 rounded text-xs truncate cursor-pointer ${calendarItem.color}`}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger className="w-full text-left">
                                  <div className="flex items-center space-x-1">
                                    {getItemTypeIcon(calendarItem)}
                                    <span className="truncate">{calendarItem.title}</span>
                                  </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-popover border-border">
                                  <DropdownMenuItem disabled className="text-popover-foreground">
                                    <strong>{calendarItem.title}</strong>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled className="text-popover-foreground">
                                    {calendarItem.description}
                                  </DropdownMenuItem>
                                  {calendarItem.start_time && (
                                    <DropdownMenuItem disabled className="text-popover-foreground">
                                      Data: {new Date(calendarItem.start_time).toLocaleDateString('pt-BR')}
                                    </DropdownMenuItem>
                                  )}
                                  {calendarItem.type === 'event' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleEditEvent(calendarItem as CalendarEvent)} className="hover:bg-accent">
                                        Editar Evento
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteEvent(calendarItem.id)}
                                        className="text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir Evento
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                          {item.items.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{item.items.length - 3} mais
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {todayItems.length > 0 ? (
                <div className="space-y-2">
                  {todayItems.map((item) => (
                    <div key={item.id} className="p-2 border border-border rounded-lg bg-accent/30">
                      <p className="font-medium text-sm flex items-center text-card-foreground">
                        {getItemTypeIcon(item)} {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      {item.start_time && (
                        <p className="text-xs text-muted-foreground">Horário: {item.start_time}</p>
                      )}
                      <Badge 
                        variant="secondary"
                        className="text-xs mt-1"
                      >
                        {item.color ? 'Evento Colorido' : 'Evento'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item para hoje</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Próximos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allCalendarItems
                  .filter(item => new Date(item.start_time) >= today)
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.id} className="p-2 border border-border rounded-lg bg-accent/30">
                      <p className="font-medium text-sm flex items-center text-card-foreground">
                        {getItemTypeIcon(item)} {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.start_time).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ))}
                {allCalendarItems.filter(item => new Date(item.start_time) >= today).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum item próximo</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onSave={async () => {
          if (user?.id) {
            // Recarregar todos os itens do calendário
            const events = await getCalendarEvents(user.id);
            const calendarEvents = events.map(event => ({
              ...event,
              type: 'event' as const
            }));

            // Buscar prazos dos projetos
            const projectDeadlines = projects
              .filter(project => project.end_date)
              .map(project => ({
                id: `project-${project.id}`,
                title: `Prazo: ${project.name}`,
                description: `Prazo final do projeto ${project.name}`,
                start_time: project.end_date!,
                end_time: project.end_date!,
                color: 'bg-red-500',
                type: 'project' as const,
                project_id: project.id
              }));

            // Buscar prazos das tarefas
            const taskDeadlines = projects
              .flatMap(project => project.tasks)
              .filter(task => task.due_date)
              .map(task => ({
                id: `task-${task.id}`,
                title: `Prazo: ${task.title}`,
                description: `Prazo da tarefa ${task.title}`,
                start_time: task.due_date!,
                end_time: task.due_date!,
                color: 'bg-yellow-500',
                type: 'task' as const,
                task_id: task.id
              }));

            // Combinar todos os itens
            const allItems = [...calendarEvents, ...projectDeadlines, ...taskDeadlines];
            setAllCalendarItems(allItems);
          }
        }}
      />
    </div>
  );
};

export default Calendar;
