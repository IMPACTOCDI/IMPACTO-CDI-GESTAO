import * as React from 'react';
import { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Users, Clock, Calendar } from 'lucide-react';
import OverviewAnalytics from '../components/analytics/OverviewAnalytics';
import ProjectAnalytics from '../components/analytics/ProjectAnalytics';
import TeamAnalytics from '../components/analytics/TeamAnalytics';
import TimeAnalytics from '../components/analytics/TimeAnalytics';
import AdminRoute from '@/components/auth/AdminRoute';

const Analytics = () => {
  const { projects } = useProject();
  const [dateRange, setDateRange] = useState('30');
  const [selectedProject, setSelectedProject] = useState('all');

  const activeProjects = projects.filter(p => p.status === 'active');

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics
              </h1>
              <p className="text-muted-foreground">
                Análise detalhada de performance e tendências dos projetos
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {activeProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 3 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-fit">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Projetos</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Equipe</span>
              </TabsTrigger>
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Tempo</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewAnalytics 
                projects={projects}
                dateRange={parseInt(dateRange)}
                selectedProject={selectedProject}
              />
            </TabsContent>

            <TabsContent value="projects" className="space-y-6">
              <ProjectAnalytics 
                projects={projects}
                dateRange={parseInt(dateRange)}
                selectedProject={selectedProject}
              />
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <TeamAnalytics 
                projects={projects}
                dateRange={parseInt(dateRange)}
                selectedProject={selectedProject}
              />
            </TabsContent>

            <TabsContent value="time" className="space-y-6">
              <TimeAnalytics 
                projects={projects}
                dateRange={parseInt(dateRange)}
                selectedProject={selectedProject}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminRoute>
  );
};

export default Analytics;
