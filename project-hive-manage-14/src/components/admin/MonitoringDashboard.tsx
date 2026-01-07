import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Cpu, HardDrive, Database } from 'lucide-react';
import { monitorResources, monitorQueryPerformance } from '@/lib/supabase-backup';
import { toast } from 'sonner';

type ResourceMetrics = {
  cpu: number;
  memory: number;
  storage: number;
};

type QueryMetrics = {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
};

const MonitoringDashboard = () => {
  const [resources, setResources] = useState<ResourceMetrics | null>(null);
  const [queries, setQueries] = useState<QueryMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const [resourceData, queryData] = await Promise.all([
        monitorResources(),
        monitorQueryPerformance()
      ]);
      setResources(resourceData);
      setQueries(queryData);
    } catch (error: any) {
      toast.error('Erro ao carregar métricas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 60000); // Atualizar a cada minuto
    return () => clearInterval(interval);
  }, []);

  const getResourceColor = (value: number) => {
    if (value >= 90) return 'text-red-500';
    if (value >= 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Monitoramento do Sistema</h2>
          <p className="text-muted-foreground">
            Métricas de recursos e performance
          </p>
        </div>
        <Badge className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Atualizado a cada minuto
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uso</span>
                <span className={`text-sm font-medium ${getResourceColor(resources?.cpu || 0)}`}>
                  {resources?.cpu.toFixed(1)}%
                </span>
              </div>
              <Progress value={resources?.cpu || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Memória
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uso</span>
                <span className={`text-sm font-medium ${getResourceColor(resources?.memory || 0)}`}>
                  {resources?.memory.toFixed(1)}%
                </span>
              </div>
              <Progress value={resources?.memory || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Armazenamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Uso</span>
                <span className={`text-sm font-medium ${getResourceColor(resources?.storage || 0)}`}>
                  {resources?.storage.toFixed(1)}%
                </span>
              </div>
              <Progress value={resources?.storage || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queries Lentas</CardTitle>
          <CardDescription>
            Queries que estão afetando a performance do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Chamadas</TableHead>
                <TableHead>Tempo Total</TableHead>
                <TableHead>Tempo Médio</TableHead>
                <TableHead>Linhas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((query, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">
                    {query.query.length > 100
                      ? query.query.substring(0, 100) + '...'
                      : query.query}
                  </TableCell>
                  <TableCell>{query.calls}</TableCell>
                  <TableCell>{formatTime(query.total_time)}</TableCell>
                  <TableCell>{formatTime(query.mean_time)}</TableCell>
                  <TableCell>{query.rows}</TableCell>
                </TableRow>
              ))}
              {queries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Nenhuma query lenta detectada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringDashboard; 