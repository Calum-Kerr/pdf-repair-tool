import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Alert, Card, Grid, Typography } from '@mui/material';

interface PerformanceMetrics {
  timestamp: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  processStats: {
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
  resourceStats: {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    activeResources: number;
  };
  timing: {
    averageProcessingTime: number;
    maxProcessingTime: number;
    minProcessingTime: number;
  };
}

interface Alert {
  type: 'memory' | 'cpu' | 'queue' | 'error' | 'performance';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface PerformanceDashboardProps {
  metricsHistory: PerformanceMetrics[];
  recentAlerts: Alert[];
  refreshInterval?: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  metricsHistory,
  recentAlerts,
  refreshInterval = 5000
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>(metricsHistory);
  const [alerts, setAlerts] = useState<Alert[]>(recentAlerts);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/performance/metrics');
        const data = await response.json();
        setMetrics(data.metrics);
        setAlerts(data.alerts);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    // Initial fetch
    fetchMetrics();

    // Set up polling with bounded interval
    const interval = setInterval(fetchMetrics, Math.max(1000, refreshInterval));
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <Grid container spacing={3}>
      {/* System Resources */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" padding={2}>Memory Usage</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(time: number) => new Date(time).toLocaleTimeString()}
              />
              <YAxis tickFormatter={formatBytes} />
              <Tooltip
                formatter={(value: number) => formatBytes(value)}
                labelFormatter={(time: string) => new Date(Number(time)).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="memoryUsage.heapUsed"
                name="Heap Used"
                stroke="#8884d8"
              />
              <Line
                type="monotone"
                dataKey="memoryUsage.heapTotal"
                name="Heap Total"
                stroke="#82ca9d"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Grid>

      {/* CPU Usage */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" padding={2}>CPU Usage</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(time: number) => new Date(time).toLocaleTimeString()}
              />
              <YAxis unit="%" />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)}%`}
                labelFormatter={(time: string) => new Date(Number(time)).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="cpuUsage.user"
                name="User CPU"
                stroke="#8884d8"
              />
              <Line
                type="monotone"
                dataKey="cpuUsage.system"
                name="System CPU"
                stroke="#82ca9d"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Grid>

      {/* Job Statistics */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" padding={2}>Job Statistics</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(time: number) => new Date(time).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(time: string) => new Date(Number(time)).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="processStats.activeJobs"
                name="Active Jobs"
                stroke="#8884d8"
              />
              <Line
                type="monotone"
                dataKey="processStats.queuedJobs"
                name="Queued Jobs"
                stroke="#82ca9d"
              />
              <Line
                type="monotone"
                dataKey="processStats.completedJobs"
                name="Completed Jobs"
                stroke="#ffc658"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Grid>

      {/* Cache Performance */}
      <Grid item xs={12} md={6}>
        <Card>
          <Typography variant="h6" padding={2}>Cache Performance</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(time: number) => new Date(time).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(time: string) => new Date(Number(time)).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="resourceStats.cacheHits"
                name="Cache Hits"
                stroke="#8884d8"
              />
              <Line
                type="monotone"
                dataKey="resourceStats.cacheMisses"
                name="Cache Misses"
                stroke="#82ca9d"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Grid>

      {/* Recent Alerts */}
      <Grid item xs={12}>
        <Card>
          <Typography variant="h6" padding={2}>Recent Alerts</Typography>
          {alerts.map((alert, index) => (
            <Alert
              key={`${alert.timestamp}-${index}`}
              severity={
                alert.type === 'error' ? 'error' :
                alert.type === 'memory' || alert.type === 'cpu' ? 'warning' :
                'info'
              }
              sx={{ margin: 1 }}
            >
              {alert.message} (at {new Date(alert.timestamp).toLocaleString()})
            </Alert>
          ))}
        </Card>
      </Grid>
    </Grid>
  );
}; 