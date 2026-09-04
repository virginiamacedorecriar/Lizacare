import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Search, Edit2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const patientSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(11, 'CPF inválido').max(14, 'CPF inválido'),
  birthDate: z.string().min(1, 'A data de nascimento é obrigatória'),
  gender: z.string().optional(),
  healthPlanName: z.string().optional(),
  healthPlanNumber: z.string().optional(),
  healthPlanValidity: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type PatientFormData = z.infer<typeof patientSchema>;

export interface Patient extends PatientFormData {
  id: string;
}

export default function Patients() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema)
  });

  const fetchPatients = async () => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'patients'), where('doctorId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
    setPatients(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatients();
  }, [user]);

  const handleSave = async (data: PatientFormData) => {
    if (!user) return;
    
    try {
      if (editingId) {
        const patientRef = doc(db, 'patients', editingId);
        await updateDoc(patientRef, { ...data });
        toast.success('Paciente atualizado com sucesso');
      } else {
        await addDoc(collection(db, 'patients'), {
          ...data,
          doctorId: user.uid,
          createdAt: new Date()
        });
        toast.success('Paciente cadastrado com sucesso');
      }
      setIsEditing(false);
      setEditingId(null);
      reset();
      fetchPatients();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar paciente');
    }
  };

  const startEditing = (patient?: Patient) => {
    if (patient) {
      setEditingId(patient.id);
      reset(patient);
    } else {
      setEditingId(null);
      reset({
        name: '', cpf: '', birthDate: '', gender: '',
        healthPlanName: '', healthPlanNumber: '', healthPlanValidity: '',
        phone: '', email: ''
      });
    }
    setIsEditing(true);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.cpf && p.cpf.includes(searchTerm))
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pacientes</h1>
        <Button onClick={() => startEditing()}>
          <Plus className="mr-2 h-4 w-4" /> Novo Paciente
        </Button>
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Editar Paciente' : 'Novo Paciente'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input {...register('name')} className={errors.name ? 'border-red-500' : ''} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input {...register('cpf')} className={errors.cpf ? 'border-red-500' : ''} />
                  {errors.cpf && <p className="text-xs text-red-500">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento *</Label>
                  <Input type="date" {...register('birthDate')} className={errors.birthDate ? 'border-red-500' : ''} />
                  {errors.birthDate && <p className="text-xs text-red-500">{errors.birthDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Sexo</Label>
                  <select 
                    {...register('gender')}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                  >
                    <option value="">Selecione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Convênio (Nome)</Label>
                  <Input {...register('healthPlanName')} />
                </div>
                <div className="space-y-2">
                  <Label>Número da Carteira</Label>
                  <Input {...register('healthPlanNumber')} />
                </div>
                <div className="space-y-2">
                  <Label>Validade da Carteira</Label>
                  <Input type="date" {...register('healthPlanValidity')} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" {...register('email')} className={errors.email ? 'border-red-500' : ''} />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input {...register('phone')} />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button type="submit">Salvar Paciente</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center">
            <Search className="h-5 w-5 text-gray-400 mr-2" />
            <Input 
              placeholder="Buscar por nome ou CPF..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
            />
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <EmptyState 
                icon={<Users className="h-8 w-8" />}
                title="Nenhum paciente cadastrado"
                description="Você ainda não tem pacientes salvos. Adicione o seu primeiro paciente para começar a gerar solicitações."
                action={
                  <Button onClick={() => startEditing()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Paciente
                  </Button>
                }
              />
            ) : (
              filteredPatients.map(patient => (
                <div key={patient.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-gray-900">{patient.name}</h4>
                    <p className="text-sm text-gray-500">
                      {patient.healthPlanName} {patient.healthPlanNumber ? `- ${patient.healthPlanNumber}` : ''}
                      {patient.cpf && ` • CPF: ${patient.cpf}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => startEditing(patient)}>
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
