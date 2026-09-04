import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { profile, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', crm: '', uf: '', cpf: '', specialty: '', cbo: '', phone: '', email: '', rqe: '', cnes: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        crm: profile.crm || '',
        uf: profile.uf || '',
        cpf: profile.cpf || '',
        specialty: profile.specialty || '',
        cbo: profile.cbo || '',
        phone: profile.phone || '',
        email: profile.email || '',
        rqe: profile.rqe || '',
        cnes: profile.cnes || ''
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile(formData);
    setSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Configurações</h1>
        <div className="space-x-3">
          <Link to="/configuracoes/operadoras">
            <Button variant="outline">Operadoras</Button>
          </Link>
          <Link to="/configuracoes/tabelas">
            <Button variant="outline">Gerenciar Tabelas</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meu Cadastro (Médico)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="crm">CRM</Label>
                <Input id="crm" name="crm" value={formData.crm} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF (CRM)</Label>
                <Input id="uf" name="uf" value={formData.uf} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidade</Label>
                <Input id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rqe">RQE (Opcional)</Label>
                <Input id="rqe" name="rqe" value={formData.rqe} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cbo">CBO (Opcional)</Label>
                <Input id="cbo" name="cbo" value={formData.cbo} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnes">CNES (Opcional)</Label>
                <Input id="cnes" name="cnes" value={formData.cnes} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar dados'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
