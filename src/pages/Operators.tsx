import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Operator {
  id: string;
  name: string;
}

export default function Operators() {
  const { user } = useAuthStore();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<Partial<Operator>>({});

  const fetchOperators = async () => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[];
    setOperators(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOperators();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (currentOperator.id) {
      await updateDoc(doc(db, 'operators', currentOperator.id), currentOperator);
    } else {
      await addDoc(collection(db, 'operators'), {
        ...currentOperator,
        doctorId: user.uid,
        createdAt: new Date()
      });
    }
    setIsEditing(false);
    setCurrentOperator({});
    fetchOperators();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta operadora?')) {
      await deleteDoc(doc(db, 'operators', id));
      fetchOperators();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/configuracoes">
          <Button variant="outline">Voltar</Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Operadoras de Saúde</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{currentOperator.id ? 'Editar Operadora' : 'Nova Operadora'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Operadora (Ex: Unimed Goiânia, IPASGO)</Label>
                  <Input required value={currentOperator.name || ''} onChange={e => setCurrentOperator({...currentOperator, name: e.target.value})} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1">{currentOperator.id ? 'Salvar' : 'Adicionar'}</Button>
                  {isEditing && (
                    <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setCurrentOperator({}); }}>Cancelar</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Carregando operadoras...</div>
              ) : operators.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">Nenhuma operadora cadastrada.</div>
              ) : (
                operators.map(op => (
                  <div key={op.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <span className="font-medium">{op.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setCurrentOperator(op); setIsEditing(true); }}>
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(op.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
