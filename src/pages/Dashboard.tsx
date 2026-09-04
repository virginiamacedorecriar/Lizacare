import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, FileText, Calendar, Users, LayoutTemplate, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [operators, setOperators] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ totalRequests: 0, totalPatients: 0, totalTemplates: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      const [pSnap, oSnap, rSnap, tSnap] = await Promise.all([
        getDocs(query(collection(db, 'patients'), where('doctorId', '==', user.uid))),
        getDocs(query(collection(db, 'operators'), where('doctorId', '==', user.uid))),
        getDocs(query(collection(db, 'requests'), where('doctorId', '==', user.uid))),
        getDocs(query(collection(db, 'templates'), where('doctorId', '==', user.uid)))
      ]);
      
      const pDict: any = {};
      pSnap.docs.forEach(d => pDict[d.id] = d.data());
      setPatients(pDict);
      
      const oDict: any = {};
      oSnap.docs.forEach(d => oDict[d.id] = d.data());
      setOperators(oDict);
      
      const reqs = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setStats({
        totalRequests: reqs.length,
        totalPatients: pSnap.size,
        totalTemplates: tSnap.size
      });
      
      // Calculate chart data (Requests by Operator)
      const opCounts = reqs.reduce((acc: any, req: any) => {
        acc[req.operatorId] = (acc[req.operatorId] || 0) + 1;
        return acc;
      }, {});
      
      const chart = Object.keys(opCounts).map(opId => ({
        name: oDict[opId]?.name || 'Outros',
        total: opCounts[opId]
      })).sort((a, b) => b.total - a.total).slice(0, 5); // top 5
      
      setChartData(chart);
      
      const sortedReqs = [...reqs]
        .sort((a: any, b: any) => b.createdAt.toMillis() - a.createdAt.toMillis())
        .slice(0, 10);
        
      setRequests(sortedReqs);
      setLoading(false);
    };
    
    fetchData();
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
        <Link to="/nova-solicitacao">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nova solicitação
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Solicitações</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalRequests}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-full">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pacientes Cadastrados</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalPatients}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Templates Ativos</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalTemplates}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Solicitações recentes</h2>
          <Card>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <EmptyState 
                  icon={<FileText className="h-8 w-8" />}
                  title="Nenhuma solicitação"
                  description="Comece criando uma nova solicitação para um de seus pacientes. O processo leva apenas alguns minutos."
                  action={
                    <Link to="/nova-solicitacao">
                      <Button>Criar primeira solicitação</Button>
                    </Link>
                  }
                />
              ) : (
                requests.map(req => {
                  const date = req.createdAt?.toDate ? req.createdAt.toDate() : new Date();
                  return (
                    <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          {patients[req.patientId]?.name || 'Paciente desconhecido'}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {operators[req.operatorId]?.name || '-'} • {req.clinicalData?.indication || 'Sem indicação'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center text-gray-500">
                          <Calendar className="mr-1 h-4 w-4" />
                          {format(date, "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Gerado
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Volume por Operadora</h2>
          <Card>
            <CardContent className="p-6">
              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Activity className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Sem dados suficientes<br/>para exibir gráficos.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
