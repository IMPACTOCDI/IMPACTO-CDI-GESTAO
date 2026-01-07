import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';

type Checklist = Database['public']['Tables']['checklists']['Row'] & {
  items: Database['public']['Tables']['checklist_items']['Row'][];
  status: 'active' | 'completed';
};

interface ChecklistProps {
  projectId: string;
}

const Checklist: React.FC<ChecklistProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState('active');
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar checklists do projeto
  const { data: checklists, isLoading } = useQuery({
    queryKey: ['checklists', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists')
        .select('*, items(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Checklist[];
    }
  });

  // Verificar se um checklist está 100% concluído
  const isChecklistComplete = (checklist: Checklist) => {
    return checklist.items.length > 0 && checklist.items.every(item => item.completed);
  };

  // Mover checklist para concluídos quando estiver 100% completo
  useEffect(() => {
    const moveCompletedChecklists = async () => {
      if (!checklists) return;

      const completedChecklists = checklists.filter(checklist => 
        checklist.status === 'active' && isChecklistComplete(checklist)
      );

      for (const checklist of completedChecklists) {
        const { error } = await supabase
          .from('checklists')
          .update({ status: 'completed' })
          .eq('id', checklist.id);

        if (error) {
          toast({
            title: 'Erro',
            description: 'Erro ao atualizar status do checklist',
            variant: 'destructive'
          });
        }
      }

      if (completedChecklists.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
        toast({
          title: 'Sucesso',
          description: 'Checklists concluídos movidos automaticamente',
        });
      }
    };

    moveCompletedChecklists();
  }, [checklists, projectId, queryClient, toast]);

  // Funções de manipulação
  const handleDeleteChecklist = async (checklistId: string) => {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', checklistId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir checklist',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({
        title: 'Sucesso',
        description: 'Checklist excluído com sucesso',
      });
    }
  };

  const handleItemStatusChange = async (checklistId: string, itemId: string, completed: boolean) => {
    const { error } = await supabase
      .from('checklist_items')
      .update({ completed })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do item',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
    }
  };

  const handleStartEdit = (itemId: string, text: string) => {
    setEditingItemId(itemId);
    setEditText(text);
  };

  const handleSaveEdit = async (checklistId: string, itemId: string) => {
    const { error } = await supabase
      .from('checklist_items')
      .update({ text: editText })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar edição',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      setEditingItemId(null);
      toast({
        title: 'Sucesso',
        description: 'Item atualizado com sucesso',
      });
    }
  };

  const handleDeleteItem = async (checklistId: string, itemId: string) => {
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir item',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({
        title: 'Sucesso',
        description: 'Item excluído com sucesso',
      });
    }
  };

  const handleAddItem = async (checklistId: string) => {
    if (!newItemText.trim()) return;

    const { error } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: checklistId,
        text: newItemText,
        completed: false
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar item',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      setNewItemText('');
      toast({
        title: 'Sucesso',
        description: 'Item adicionado com sucesso',
      });
    }
  };

  const handleCreateChecklist = async () => {
    const { error } = await supabase
      .from('checklists')
      .insert({
        project_id: projectId,
        title: 'Novo Checklist',
        status: 'active'
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar checklist',
        variant: 'destructive'
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['checklists', projectId] });
      toast({
        title: 'Sucesso',
        description: 'Checklist criado com sucesso',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Checklist do Projeto</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Em Andamento</TabsTrigger>
            <TabsTrigger value="completed">Concluídos</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div>Carregando...</div>
            ) : (
              <>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="pending">Pendentes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all">
                    {checklists?.filter(c => c.status === 'active').map(checklist => (
                      <Card key={checklist.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">{checklist.title}</h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteChecklist(checklist.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {checklist.items.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={(checked) => handleItemStatusChange(checklist.id, item.id, checked as boolean)}
                              />
                              {editingItemId === item.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSaveEdit(checklist.id, item.id)}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingItemId(null)}
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
                                    onClick={() => handleStartEdit(item.id, item.text)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(checklist.id, item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Input
                            placeholder="Nova tarefa..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem(checklist.id);
                              }
                            }}
                          />
                          <Button onClick={() => handleAddItem(checklist.id)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                  <TabsContent value="pending">
                    {checklists?.filter(c => c.status === 'active' && !isChecklistComplete(c)).map(checklist => (
                      <Card key={checklist.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">{checklist.title}</h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteChecklist(checklist.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {checklist.items.filter(item => !item.completed).map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={(checked) => handleItemStatusChange(checklist.id, item.id, checked as boolean)}
                              />
                              {editingItemId === item.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSaveEdit(checklist.id, item.id)}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingItemId(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span>{item.text}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartEdit(item.id, item.text)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(checklist.id, item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Input
                            placeholder="Nova tarefa..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddItem(checklist.id);
                              }
                            }}
                          />
                          <Button onClick={() => handleAddItem(checklist.id)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateChecklist}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Checklist
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {isLoading ? (
              <div>Carregando...</div>
            ) : (
              checklists?.filter(c => c.status === 'completed').map(checklist => (
                <Card key={checklist.id} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{checklist.title}</h3>
                  </div>
                  <div className="space-y-2">
                    {checklist.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox checked={item.completed} disabled />
                        <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Checklist; 