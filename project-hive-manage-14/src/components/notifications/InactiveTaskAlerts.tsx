import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Clock, 
  Eye, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  User
} from 'lucide-react';
import { useInactiveTaskAlerts, useInactiveTaskMessages } from '@/hooks/useInactiveTaskAlerts';
import { InactiveTaskAlert } from '@/lib/taskInactivity';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InactiveTaskAlertsProps {
  maxAlerts?: number;
  showDetails?: boolean;
  onTaskClick?: (taskId: string) => void;
}

const InactiveTaskAlerts: React.FC<InactiveTaskAlertsProps> = ({
  maxAlerts = 5,
  showDetails = true,
  onTaskClick
}) => {
  const { alerts, counts, isLoading, error } = useInactiveTaskAlerts();
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  
  // Todos os hooks devem ser chamados antes de qualquer return condicional
  const messages = useInactiveTaskMessages(alerts);
  const displayedAlerts = showAll ? alerts : alerts.slice(0, maxAlerts);

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedAlerts(newExpanded);
  };

  const handleTaskClick = (taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Verificando Tarefas Inativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Erro ao Verificar Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível verificar as tarefas inativas: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (counts.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Clock className="h-5 w-5" />
            Tarefas Ativas
          </CardTitle>
          <CardDescription>
            Todas as tarefas estão com atividade recente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma tarefa inativa encontrada</p>
            <p className="text-sm">Continue mantendo os projetos em movimento!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Tarefas sem interação há mais de 7 dias
          <Badge variant="destructive" className="ml-2">
            {counts.total}
          </Badge>
        </CardTitle>
        <CardDescription>
          Tarefas criadas por você que precisam de atenção
          {counts.critical > 0 && (
            <span className="text-destructive ml-2">
              ({counts.critical} críticas)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {displayedAlerts.map((alert, index) => {
          const isExpanded = expandedAlerts.has(alert.task.id);
          const isCritical = alert.alertType === 'critical';
          
          return (
            <Alert key={alert.task.id} variant={isCritical ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{alert.task.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Projeto: {alert.task.projectName}
                        </span>
                      </div>
                      <Badge variant={isCritical ? 'destructive' : 'secondary'}>
                        {alert.daysSinceLastActivity} dias
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(alert.task.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTaskClick(alert.task.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </div>
                  
                  {isExpanded && showDetails && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Última atividade: {formatDistanceToNow(alert.lastActivityDate, { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Projeto: {alert.task.projectName}</span>
                        </div>
                      </div>
                      
                      {alert.task.description && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Descrição:</strong> {alert.task.description}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Status: {alert.task.status}
                        </Badge>
                        <Badge variant="outline">
                          Prioridade: {alert.task.priority}
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/tasks/${alert.task.id}`}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Adicionar Comentário
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/projects/${alert.task.project_id}`}>
                            Ver Projeto
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
        
        {alerts.length > maxAlerts && !showAll && (
          <div className="text-center pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAll(true)}
            >
              Ver todas as {alerts.length} tarefas inativas
            </Button>
          </div>
        )}
        
        {showAll && alerts.length > maxAlerts && (
          <div className="text-center pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAll(false)}
            >
              Mostrar menos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InactiveTaskAlerts;
