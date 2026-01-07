import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';
import { Send, Loader2 } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react';
import { useDeleteComment, useUpdateComment } from '@/hooks/useSupabaseMutations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';

interface Comment {
  id: string;
  task_id: string;
  project_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles: {
    id: string;
    name: string;
  };
}

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
  comments: Comment[];
  currentComment: string;
  onCommentChange: (comment: string) => void;
  onCommentSubmit: () => void;
}

const TaskComments: React.FC<TaskCommentsProps> = ({
  taskId,
  projectId,
  comments,
  currentComment,
  onCommentChange,
  onCommentSubmit,
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authors, setAuthors] = useState<Record<string, { id: string; name: string }>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const queryClient = useQueryClient();

  const deleteComment = useDeleteComment();
  const updateComment = useUpdateComment();

  const { data: taskComments = comments || [] } = useQuery({
    queryKey: queryKeys.comments(taskId),
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:created_by(*)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Comment[];
    },
    initialData: comments,
    enabled: !!taskId
  });

  useEffect(() => {
    const fetchAuthors = async () => {
      const authorIds = [...new Set(taskComments.map(comment => comment.created_by))];
      if (authorIds.length === 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);

      if (error) {
        logger.error('Erro ao buscar autores', { error, context: 'TaskComments' });
        return;
      }

      const authorsMap = data.reduce((acc, author) => {
        acc[author.id] = { id: author.id, name: author.name };
        return acc;
      }, {} as Record<string, { id: string; name: string }>);

      setAuthors(authorsMap);
    };

    fetchAuthors();
  }, [taskComments]);

  const handleSubmit = async () => {
    if (!currentComment.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O comentário não pode estar vazio"
      });
      return;
    }

    if (authLoading) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Aguarde a autenticação ser concluída"
      });
      return;
    }

    if (!user?.id) {
      logger.error('Tentativa de comentário sem usuário autenticado', {
        authLoading,
        hasUser: !!user,
        context: 'TaskComments'
      });
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário não autenticado. Por favor, faça login novamente."
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      logger.debug('Iniciando submissão de comentário', {
        taskId,
        projectId,
        userId: user.id,
        authLoading,
        context: 'TaskComments'
      });
      
      const comment = {
        id: crypto.randomUUID(),
        content: currentComment.trim(),
        task_id: taskId,
        project_id: projectId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      logger.debug('Dados do comentário', {
        comment,
        context: 'TaskComments'
      });

      const { data: insertedComment, error: insertError } = await supabase
        .from('comments')
        .insert(comment)
        .select()
        .single();

      if (insertError) {
        logger.error('Erro ao adicionar comentário', { 
          error: insertError,
          taskId,
          projectId,
          userId: user.id,
          context: 'TaskComments'
        });
        throw insertError;
      }

      const { data: commentWithProfile, error: selectError } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:created_by(*)
        `)
        .eq('id', insertedComment.id)
        .single();

      if (selectError) {
        logger.error('Erro ao buscar comentário com perfil', { 
          error: selectError,
          commentId: insertedComment.id,
          context: 'TaskComments'
        });
        throw selectError;
      }

      logger.debug('Comentário adicionado com sucesso', {
        commentId: insertedComment.id,
        taskId,
        context: 'TaskComments'
      });

      queryClient.setQueryData(queryKeys.comments(taskId), (old: Comment[] = []) => [...old, commentWithProfile]);
      
      onCommentSubmit();
      toast({
        title: "Sucesso",
        description: "Comentário adicionado com sucesso!"
      });
    } catch (error: any) {
      logger.error('Erro ao adicionar comentário', { 
        error,
        taskId,
        projectId,
        userId: user?.id,
        context: 'TaskComments'
      });
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao adicionar comentário. Tente novamente."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (error) {
      logger.error('Erro ao excluir comentário', { error, commentId, context: 'TaskComments' });
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedContent('');
  };

  const handleSaveEdit = async (commentId: string) => {
    try {
      if (!editedContent.trim()) return;
      
      await updateComment.mutateAsync({
        id: commentId,
        content: editedContent.trim()
      });
      
      setEditingCommentId(null);
      setEditedContent('');
    } catch (error) {
      logger.error('Erro ao atualizar comentário', { error, commentId, context: 'TaskComments' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" />
          Comentários
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
            {taskComments.map((comment) => (
              <div key={comment.id} className="flex space-x-4">
                <Avatar>
                  <AvatarImage src={`https://avatar.vercel.sh/${comment.profiles.id}`} />
                  <AvatarFallback>
                    {comment.profiles.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{comment.profiles.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(comment.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {(user?.id === comment.created_by || user?.role === 'admin') && (
                      <div className="flex gap-1">
                        {editingCommentId !== comment.id && (
                          <Button
                            onClick={() => handleEditComment(comment)}
                            className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                            disabled={deleteComment.isPending || updateComment.isPending}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          disabled={deleteComment.isPending || updateComment.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => handleSaveEdit(comment.id)}
                          size="sm"
                          className="flex items-center gap-1"
                          disabled={!editedContent.trim() || updateComment.isPending}
                        >
                          <Check className="h-3 w-3" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-line">{comment.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Textarea
              placeholder="Adicione um comentário..."
              value={currentComment}
              onChange={(e) => onCommentChange(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !currentComment.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskComments;
