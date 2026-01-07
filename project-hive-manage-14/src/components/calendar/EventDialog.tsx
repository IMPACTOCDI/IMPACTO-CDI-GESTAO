import * as React from 'react';
import { Database } from '@/integrations/supabase/types';
import { createCalendarEvent, updateCalendarEvent } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Database['public']['Tables']['calendar_events']['Row'] | null;
  onSave: () => Promise<void>;
}

const EventDialog: React.FC<EventDialogProps> = ({ isOpen, onClose, event, onSave }) => {
  const { user } = useAuth();
  const [title, setTitle] = React.useState(event?.title || '');
  const [description, setDescription] = React.useState(event?.description || '');
  const [date, setDate] = React.useState<Date | undefined>(event?.date ? new Date(event.date) : undefined);
  const [time, setTime] = React.useState(event?.start_time || '');
  const [color, setColor] = React.useState(event?.color || 'bg-blue-500');

  const colors = [
    { name: 'Azul', value: 'bg-blue-500' },
    { name: 'Verde', value: 'bg-green-500' },
    { name: 'Roxo', value: 'bg-purple-500' },
    { name: 'Vermelho', value: 'bg-red-500' },
    { name: 'Amarelo', value: 'bg-yellow-500' },
    { name: 'Rosa', value: 'bg-pink-500' },
    { name: 'Índigo', value: 'bg-indigo-500' },
    { name: 'Laranja', value: 'bg-orange-500' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !user?.id) return;
    
    // Combinar data e hora para criar start_time e end_time
    const startDateTime = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes));
    }
    
    // Definir end_time como 1 hora após start_time se não houver horário específico
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);
    
    const eventData = {
      title,
      description: description || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      project_id: null, // Opcional, pode ser adicionado depois
      created_by: user.id,
      color: color || 'bg-blue-500'
    };

    try {
      if (event) {
        await updateCalendarEvent(event.id, eventData);
      } else {
        await createCalendarEvent(eventData);
      }
      await onSave();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar evento:', err);
      alert('Erro ao salvar evento!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          <DialogDescription className="sr-only">
            {event ? 'Edite as informações do evento.' : 'Adicione um novo evento ao calendário.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do evento"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Digite a descrição do evento"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Horário (opcional)</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colors.map((colorOption) => (
                  <SelectItem key={colorOption.value} value={colorOption.value}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full ${colorOption.value}`}></div>
                      <span>{colorOption.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {event ? 'Salvar Alterações' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventDialog;
