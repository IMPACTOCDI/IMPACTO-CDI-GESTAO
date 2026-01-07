import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Loader2, Pencil, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { checkSupabaseConnection } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';

interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  order_index: number;
  deleted_at: string | null;
}

interface Checklist {
  id: string;
  title: string;
  tasks?: {
    id: string;
    title: string;
    projects?: {
      id: string;
      name: string;
    };
  };
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export default function Checklists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [isAddingItem, setIsAddingItem] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);

  useEffect(() => {
    loadChecklists();
  }, []);

  const loadChecklists = async () => {
    if (!user?.id) {
      setError('Você precisa estar autenticado para ver os checklists');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Sem conexão com o banco de dados');
      }

      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          checklist_items(*),
          tasks(
            id,
            title,
            project_id,
            projects(
              id,
              name
            )
          )
        `)
        .eq('created_by', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Erro ao carregar checklists', { 
          error,
          context: 'ChecklistsPage'
        });
        throw error;
      }

      const processedChecklists = data.map(checklist => ({
        ...checklist,
        items: checklist.checklist_items?.filter(item => !item.deleted_at) || []
      }));

      setChecklists(processedChecklists);
    } catch (error: any) {
      logger.error('Erro ao carregar checklists', { 
        error: error.message,
        context: 'ChecklistsPage'
      });
      setError(error.message || 'Erro ao carregar checklists');
    } finally {
      setLoading(false);
    }
  };

  const getCompletionStats = (items: ChecklistItem[]) => {
    const total = items.length;
    const completed = items.filter(item => item.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  };

  const handleUpdateChecklist = async (checklistId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ title: newTitle })
        .eq('id', checklistId);

      if (error) throw error;

      setChecklists(prev => prev.map(checklist => 
        checklist.id === checklistId ? { ...checklist, title: newTitle } : checklist
      ));
      toast.success('Checklist atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar checklist: ' + error.message);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', checklistId);

      if (error) throw error;

      setChecklists(prev => prev.filter(checklist => checklist.id !== checklistId));
      toast.success('Checklist excluído com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao excluir checklist: ' + error.message);
    }
  };

  const handleUpdateItem = async (itemId: string, text: string) => {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({ text })
        .eq('id', itemId);

      if (error) throw error;

      setChecklists(prev => prev.map(checklist => ({
        ...checklist,
        items: checklist.items.map(item =>
          item.id === itemId ? { ...item, text } : item
        )
      })));
      toast.success('Item atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar item: ' + error.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;

      setChecklists(prev => prev.map(checklist => ({
        ...checklist,
        items: checklist.items.filter(item => item.id !== itemId)
      })));
      toast.success('Item excluído com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao excluir item: ' + error.message);
    }
  };

  const handleAddItem = async (checklistId: string) => {
    if (!newItemText.trim()) return;

    try {
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          checklist_id: checklistId,
          text: newItemText.trim(),
          completed: false,
          order_index: checklists.find(c => c.id === checklistId)?.items.length || 0
        })
        .select()
        .single();

      if (error) throw error;

      setChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? { ...checklist, items: [...checklist.items, data] }
          : checklist
      ));
      setNewItemText('');
      setIsAddingItem(null);
      toast.success('Item adicionado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao adicionar item: ' + error.message);
    }
  };

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({ 
          completed,
          completed_at: completed ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      if (error) throw error;

      setChecklists(prev => prev.map(checklist => ({
        ...checklist,
        items: checklist.items.map(item =>
          item.id === itemId ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null } : item
        )
      })));
    } catch (error: any) {
      toast.error('Erro ao atualizar item: ' + error.message);
    }
  };

  const handleCreateChecklist = async () => {
    if (!newChecklistTitle.trim() || newChecklistItems.length === 0) return;

    try {
      const { data: checklist, error: checklistError } = await supabase
        .from('checklists')
        .insert({
          title: newChecklistTitle.trim(),
          created_by: user?.id
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      const items = newChecklistItems
        .filter(text => text.trim())
        .map((text, index) => ({
          checklist_id: checklist.id,
          text: text.trim(),
          completed: false,
          order_index: index
        }));

      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(items);

      if (itemsError) throw itemsError;

      const { data: newItems, error: fetchError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklist.id)
        .is('deleted_at', null)
        .order('order_index');

      if (fetchError) throw fetchError;

      setChecklists(prev => [...prev, { ...checklist, items: newItems }]);
      setNewChecklistTitle('');
      setNewChecklistItems(['']);
      setIsCreatingChecklist(false);
      toast.success('Checklist criado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao criar checklist', { 
        error: error.message,
        context: 'ChecklistsPage'
      });
      toast.error('Erro ao criar checklist: ' + error.message);
    }
  };

  const addNewChecklistItem = () => {
    setNewChecklistItems(prev => [...prev, '']);
  };

  const removeNewChecklistItem = (index: number) => {
    setNewChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateNewChecklistItem = (index: number, value: string) => {
    setNewChecklistItems(prev => prev.map((item, i) => i === index ? value : item));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <p className="text-red-500">Erro ao carregar checklists. Tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus checklists em um só lugar
          </p>
        </div>
        <Dialog open={isCreatingChecklist} onOpenChange={setIsCreatingChecklist}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Checklist Independente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Checklist Independente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Checklist</Label>
                <Input
                  id="title"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder="Digite o título do checklist"
                />
              </div>
              <div className="space-y-2">
                <Label>Itens do Checklist</Label>
                {newChecklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateNewChecklistItem(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                    />
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNewChecklistItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addNewChecklistItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreatingChecklist(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateChecklist}>
                Criar Checklist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="active" value={filter} onValueChange={(value) => setFilter(value as 'active' | 'completed')}>
          <TabsList>
            <TabsTrigger value="active">Em Andamento</TabsTrigger>
            <TabsTrigger value="completed">Concluídos</TabsTrigger>
          </TabsList>
        </Tabs>

        {filter === 'active' && (
          <div className="grid gap-4">
            {checklists.filter(checklist => {
              const stats = getCompletionStats(checklist.items);
              return stats.percentage < 100;
            }).map((checklist) => {
              const stats = getCompletionStats(checklist.items);
              return (
                <Card key={checklist.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="h-5 w-5 text-primary" />
                          {editingChecklist?.id === checklist.id ? (
                            <Input
                              value={editingChecklist.title}
                              onChange={(e) => setEditingChecklist({ ...editingChecklist, title: e.target.value })}
                              onBlur={() => {
                                handleUpdateChecklist(checklist.id, editingChecklist.title);
                                setEditingChecklist(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateChecklist(checklist.id, editingChecklist.title);
                                  setEditingChecklist(null);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <CardTitle className="text-lg">{checklist.title}</CardTitle>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {checklist.tasks ? (
                            `${checklist.tasks.projects?.name || 'Projeto não encontrado'} - ${checklist.tasks.title || 'Tarefa não encontrada'}`
                          ) : (
                            'Checklist Independente'
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingChecklist(checklist)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChecklist(checklist.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge variant={stats.percentage === 100 ? 'default' : 'secondary'}>
                          {stats.completed}/{stats.total} ({stats.percentage}%)
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {checklist.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                          />
                          {editingItem?.id === item.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingItem.text}
                                onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                onBlur={() => {
                                  handleUpdateItem(item.id, editingItem.text);
                                  setEditingItem(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateItem(item.id, editingItem.text);
                                    setEditingItem(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingItem(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                                {item.text}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {isAddingItem === checklist.id ? (
                      <div className="flex items-center space-x-2 mt-4">
                        <Input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          placeholder="Digite o novo item..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddItem(checklist.id);
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsAddingItem(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-4"
                        onClick={() => setIsAddingItem(checklist.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar item
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {filter === 'completed' && (
          <div className="grid gap-4">
            {checklists.filter(checklist => {
              const stats = getCompletionStats(checklist.items);
              return stats.percentage === 100;
            }).map((checklist) => {
              const stats = getCompletionStats(checklist.items);
              return (
                <Card key={checklist.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="h-5 w-5 text-primary" />
                          {editingChecklist?.id === checklist.id ? (
                            <Input
                              value={editingChecklist.title}
                              onChange={(e) => setEditingChecklist({ ...editingChecklist, title: e.target.value })}
                              onBlur={() => {
                                handleUpdateChecklist(checklist.id, editingChecklist.title);
                                setEditingChecklist(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateChecklist(checklist.id, editingChecklist.title);
                                  setEditingChecklist(null);
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <CardTitle className="text-lg">{checklist.title}</CardTitle>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {checklist.tasks ? (
                            `${checklist.tasks.projects?.name || 'Projeto não encontrado'} - ${checklist.tasks.title || 'Tarefa não encontrada'}`
                          ) : (
                            'Checklist Independente'
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingChecklist(checklist)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChecklist(checklist.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge variant="default">
                          {stats.completed}/{stats.total} ({stats.percentage}%)
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {checklist.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                          />
                          {editingItem?.id === item.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingItem.text}
                                onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                                onBlur={() => {
                                  handleUpdateItem(item.id, editingItem.text);
                                  setEditingItem(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateItem(item.id, editingItem.text);
                                    setEditingItem(null);
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingItem(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                                {item.text}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {isAddingItem === checklist.id ? (
                      <div className="flex items-center space-x-2 mt-4">
                        <Input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          placeholder="Digite o novo item..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddItem(checklist.id);
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsAddingItem(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-4"
                        onClick={() => setIsAddingItem(checklist.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar item
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {checklists.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum checklist encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
} 