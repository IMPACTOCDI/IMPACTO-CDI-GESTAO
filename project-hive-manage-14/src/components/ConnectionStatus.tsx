import React, { useState } from 'react';
import { useConnection, useConnectionQuality } from '../contexts/ConnectionContext';
import { Wifi, WifiOff, AlertTriangle, Activity, RotateCcw, Settings } from 'lucide-react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { logger } from '../lib/logger';

interface ConnectionStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  compact = false,
  className = ''
}) => {
  const {
    isConnected,
    lastChecked,
    isReconnecting,
    failedAttempts,
    circuitBreakerOpen,
    metrics,
    reconnect,
    forceReconnect,
    resetMetrics
  } = useConnection();
  
  const { quality, status, color } = useConnectionQuality();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Função para obter o ícone baseado no status
  const getStatusIcon = () => {
    if (isReconnecting) {
      return <RotateCcw className="h-4 w-4 animate-spin" />;
    }
    
    if (!isConnected || circuitBreakerOpen) {
      return <WifiOff className="h-4 w-4" />;
    }
    
    if (status === 'poor' || failedAttempts > 0) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    
    return <Wifi className="h-4 w-4" />;
  };

  // Função para obter a cor do status
  const getStatusColor = () => {
    if (isReconnecting) return 'text-blue-500';
    if (!isConnected || circuitBreakerOpen) return 'text-red-500';
    if (status === 'poor') return 'text-orange-500';
    if (status === 'fair') return 'text-yellow-500';
    if (status === 'good') return 'text-blue-500';
    return 'text-green-500';
  };

  // Função para obter o texto do status
  const getStatusText = () => {
    if (isReconnecting) return 'Reconectando...';
    if (circuitBreakerOpen) return 'Circuit Breaker Ativo';
    if (!isConnected) return 'Desconectado';
    
    switch (status) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Boa';
      case 'fair': return 'Regular';
      case 'poor': return 'Ruim';
      default: return 'Desconhecido';
    }
  };

  // Função para formatar tempo
  const formatTime = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  // Função para formatar duração
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  // Função para lidar com reconexão
  const handleReconnect = async () => {
    try {
      logger.info('Reconexão manual iniciada', { context: 'ConnectionStatus' });
      await reconnect();
    } catch (error) {
      logger.error('Erro na reconexão manual:', error, { context: 'ConnectionStatus' });
    }
  };

  // Função para forçar reconexão
  const handleForceReconnect = async () => {
    try {
      logger.info('Reconexão forçada iniciada', { context: 'ConnectionStatus' });
      await forceReconnect();
    } catch (error) {
      logger.error('Erro na reconexão forçada:', error, { context: 'ConnectionStatus' });
    }
  };

  // Calcular taxa de sucesso
  const successRate = metrics.totalChecks > 0 
    ? Math.round((metrics.successfulChecks / metrics.totalChecks) * 100)
    : 100;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center space-x-1 ${className}`}>
              <div className={getStatusColor()}>
                {getStatusIcon()}
              </div>
              {showDetails && (
                <span className="text-xs text-muted-foreground">
                  {isNaN(quality) ? 0 : Math.round(quality)}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-medium">{getStatusText()}</div>
              <div className="text-muted-foreground">
                Qualidade: {isNaN(quality) ? 0 : Math.round(quality)}%
              </div>
              {lastChecked && (
                <div className="text-muted-foreground">
                  Última verificação: {formatTime(lastChecked)}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`flex items-center space-x-2 ${className}`}
        >
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          {showDetails && (
            <>
              <span className="text-sm">{getStatusText()}</span>
              <Badge variant="outline" className="text-xs">
                {isNaN(quality) ? 0 : Math.round(quality)}%
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={getStatusColor()}>
                {getStatusIcon()}
              </div>
              <span className="font-medium">Status da Conexão</span>
            </div>
            <Badge 
              variant={isConnected ? "default" : "destructive"}
              className="text-xs"
            >
              {getStatusText()}
            </Badge>
          </div>

          {/* Qualidade da Conexão */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Qualidade da Conexão</span>
              <span className="font-medium">{isNaN(quality) ? 0 : Math.round(quality)}%</span>
            </div>
            <Progress value={quality} className="h-2" />
          </div>

          <Separator />

          {/* Métricas */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Métricas</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Taxa de Sucesso</div>
                <div className="font-medium">{isNaN(successRate) ? 0 : successRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tempo Médio</div>
                <div className="font-medium">
                  {isNaN(metrics.averageResponseTime) ? 0 : Math.round(metrics.averageResponseTime)}ms
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total de Checks</div>
                <div className="font-medium">{metrics.totalChecks}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Falhas</div>
                <div className="font-medium text-red-500">{metrics.failedChecks}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Uptime</div>
                <div className="font-medium">{formatDuration(metrics.uptime)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Última Verificação</div>
                <div className="font-medium">{formatTime(lastChecked)}</div>
              </div>
            </div>
          </div>

          {/* Status Adicional */}
          {(failedAttempts > 0 || circuitBreakerOpen) && (
            <>
              <Separator />
              <div className="space-y-2">
                {failedAttempts > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tentativas Falhadas</span>
                    <span className="font-medium text-orange-500">{failedAttempts}</span>
                  </div>
                )}
                {circuitBreakerOpen && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Circuit Breaker</span>
                    <Badge variant="destructive" className="text-xs">Ativo</Badge>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Ações */}
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex-1"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reconectar
            </Button>
            
            {circuitBreakerOpen && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleForceReconnect}
                disabled={isReconnecting}
                className="flex-1"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Forçar
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={resetMetrics}
              className="px-2"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ConnectionStatus;