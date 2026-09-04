import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, UploadCloud, Edit3, Save, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Operator } from './Operators';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface TemplateField {
  id: string;
  name: string;
  mappedTo: string;
  x: number; // percentage
  y: number; // percentage
  width: number;
  height: number;
  fontSize: number;
  isRepetitive?: boolean;
}

interface Template {
  id: string;
  name: string;
  operatorId: string;
  category?: string;
  version?: string;
  validity?: string;
  tableId?: string;
  status?: string;
  pdfUrl?: string;
  pdfData?: string;
  fields: TemplateField[];
}

const AVAILABLE_MAPPINGS = [
  { label: 'Paciente > Nome Completo', value: 'patient.name' },
  { label: 'Paciente > CPF', value: 'patient.cpf' },
  { label: 'Paciente > Carteira', value: 'patient.healthPlanNumber' },
  { label: 'Paciente > Validade Carteira', value: 'patient.healthPlanValidity' },
  { label: 'Médico > Nome', value: 'doctor.name' },
  { label: 'Médico > CRM', value: 'doctor.crm' },
  { label: 'Médico > Especialidade', value: 'doctor.specialty' },
  { label: 'Solicitação > Indicação', value: 'clinicalData.indication' },
  { label: 'Solicitação > CID', value: 'clinicalData.cid' },
  { label: 'Solicitação > Justificativa', value: 'clinicalData.justification' },
  { label: 'Solicitação > Data', value: 'clinicalData.date' },
  { label: 'Procedimentos > Código (Repetitivo)', value: 'procedure.code' },
  { label: 'Procedimentos > Descrição (Repetitivo)', value: 'procedure.description' },
  { label: 'Procedimentos > Quantidade (Repetitivo)', value: 'procedure.quantity' },
];

export default function Templates() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Editor State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', operatorId: '', category: '', version: '', validity: '', tableId: '', status: 'Ativo' 
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const opsQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
    const opsSnap = await getDocs(opsQ);
    setOperators(opsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]);
    
    const tabsQ = query(collection(db, 'tables'), where('doctorId', '==', user.uid));
    const tabsSnap = await getDocs(tabsQ);
    setTables(tabsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const tplQ = query(collection(db, 'templates'), where('doctorId', '==', user.uid));
    const tplSnap = await getDocs(tplQ);
    setTemplates(tplSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Template[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || !formData.name || !formData.operatorId) return;
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result;
        if (!base64Data) throw new Error("Erro ao ler o arquivo.");
        
        await addDoc(collection(db, 'templates'), {
          doctorId: user.uid,
          name: formData.name,
          operatorId: formData.operatorId,
          category: formData.category,
          version: formData.version,
          validity: formData.validity,
          tableId: formData.tableId,
          status: formData.status,
          pdfData: base64Data, // Save as Base64 string directly
          fields: [],
          createdAt: new Date()
        });
        
        setFormData({ name: '', operatorId: '', category: '', version: '', validity: '', tableId: '', status: 'Ativo' });
        setSelectedFile(null);
        fetchData();
        toast.success('Template enviado com sucesso');
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo.");
        setIsUploading(false);
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
      setIsUploading(false);
    }
  };

  const duplicateTemplate = async (template: Template) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'templates'), {
        doctorId: user.uid,
        name: `${template.name} (Cópia)`,
        operatorId: template.operatorId,
        category: template.category || '',
        version: template.version || '',
        validity: template.validity || '',
        tableId: template.tableId || '',
        status: 'Inativo',
        pdfData: template.pdfData || null,
        pdfUrl: template.pdfUrl || null,
        fields: template.fields || [],
        createdAt: new Date()
      });
      fetchData();
      toast.success('Template duplicado com sucesso');
    } catch (e: any) {
      toast.error('Erro ao duplicar: ' + e.message);
    }
  };

  const toggleStatus = async (template: Template) => {
    try {
      const newStatus = template.status === 'Ativo' ? 'Inativo' : 'Ativo';
      await updateDoc(doc(db, 'templates', template.id), { status: newStatus });
      fetchData();
      toast.success(`Status alterado para ${newStatus}`);
    } catch (e: any) {
      toast.error('Erro ao alterar status');
    }
  };

  const addField = (e: React.MouseEvent) => {
    if (!editingTemplate || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newField: TemplateField = {
      id: Date.now().toString(),
      name: 'Novo Campo',
      mappedTo: AVAILABLE_MAPPINGS[0].value,
      x, y,
      width: 15, height: 3,
      fontSize: 10
    };
    
    setEditingTemplate({
      ...editingTemplate,
      fields: [...(editingTemplate.fields || []), newField]
    });
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: editingTemplate.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    });
  };

  const removeField = (id: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: editingTemplate.fields.filter(f => f.id !== id)
    });
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await updateDoc(doc(db, 'templates', editingTemplate.id), {
        fields: editingTemplate.fields
      });
      setEditingTemplate(null);
      fetchData();
      toast.success('Mapeamento salvo com sucesso');
    } catch (e: any) {
      toast.error('Erro ao salvar mapeamento');
    }
  };

  if (editingTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingTemplate(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <h1 className="text-xl font-semibold">Mapeamento: {editingTemplate.name}</h1>
          </div>
          <Button onClick={saveTemplate} className="bg-green-600 hover:bg-green-700">
            <Save className="mr-2 h-4 w-4" /> Salvar Mapeamento
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 overflow-auto bg-gray-200 p-4 rounded-xl shadow-inner border border-gray-300">
            <div className="text-sm text-gray-500 mb-2">Clique no PDF para adicionar um campo.</div>
            <div 
              ref={containerRef} 
              className="relative inline-block cursor-crosshair shadow-lg"
              onClick={(e) => {
                // Only add if clicking directly on the container/pdf, not on an existing field
                if ((e.target as HTMLElement).closest('.pdf-field')) return;
                addField(e);
              }}
            >
              <Document file={editingTemplate.pdfData || editingTemplate.pdfUrl} loading="Carregando PDF...">
                <Page pageNumber={1} width={800} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
              
              {editingTemplate.fields?.map(field => (
                <div 
                  key={field.id}
                  className="pdf-field absolute border-2 border-blue-500 bg-blue-500/20 rounded cursor-move"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`
                  }}
                  title={field.mappedTo}
                >
                  <span className="absolute -top-5 left-0 bg-blue-600 text-white text-xs px-1 rounded whitespace-nowrap">
                    {field.mappedTo}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="xl:col-span-1 space-y-4">
            <h3 className="font-medium text-gray-900">Campos Mapeados</h3>
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
              {editingTemplate.fields?.map(field => (
                <Card key={field.id} className="p-3 text-sm">
                  <div className="space-y-2">
                    <Label>Atribuir para:</Label>
                    <select 
                      className="w-full text-xs p-1 border rounded"
                      value={field.mappedTo}
                      onChange={(e) => updateField(field.id, { mappedTo: e.target.value })}
                    >
                      {AVAILABLE_MAPPINGS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Largura (%)</Label>
                        <Input type="number" value={field.width} onChange={(e) => updateField(field.id, { width: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Altura (%)</Label>
                        <Input type="number" value={field.height} onChange={(e) => updateField(field.id, { height: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Tamanho Fonte</Label>
                        <Input type="number" value={field.fontSize} onChange={(e) => updateField(field.id, { fontSize: Number(e.target.value) })} className="h-7 text-xs" />
                      </div>
                    </div>
                    
                    <Button variant="destructive" size="sm" className="w-full h-7 mt-2 text-xs" onClick={() => removeField(field.id)}>
                      Remover Campo
                    </Button>
                  </div>
                </Card>
              ))}
              {(!editingTemplate.fields || editingTemplate.fields.length === 0) && (
                <div className="text-sm text-gray-500">Nenhum campo. Clique no documento.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Templates PDF</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Novo Template</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome (Ex: Solicitação Cirúrgica)</Label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Operadora Relacionada</Label>
                  <select 
                    required
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                    value={formData.operatorId}
                    onChange={e => setFormData({...formData, operatorId: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input placeholder="Ex: Internação" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Versão</Label>
                    <Input placeholder="Ex: 2026.1" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tabela Associada (Opcional)</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                    value={formData.tableId}
                    onChange={e => setFormData({...formData, tableId: e.target.value})}
                  >
                    <option value="">Nenhuma...</option>
                    {tables.filter(t => t.operatorId === formData.operatorId).map(t => (
                      <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Arquivo PDF Original</Label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative hover:bg-gray-50 transition-colors">
                    <div className="space-y-1 text-center">
                      <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                          <span>{selectedFile ? selectedFile.name : 'Selecionar arquivo'}</span>
                          <input type="file" className="sr-only" accept="application/pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isUploading || !selectedFile}>
                  {isUploading ? 'Enviando...' : 'Fazer Upload'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                      <Skeleton className="h-9 w-32 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <EmptyState 
                  icon={<LayoutTemplate className="h-8 w-8" />}
                  title="Nenhum template cadastrado"
                  description="Você ainda não enviou nenhum formulário PDF. Utilize a barra ao lado para fazer upload de um template em branco da operadora."
                />
              ) : (
                <div className="p-4 space-y-6">
                  {operators.map(operator => {
                    const operatorTemplates = templates.filter(t => t.operatorId === operator.id);
                    if (operatorTemplates.length === 0) return null;
                    
                    return (
                      <div key={operator.id} className="space-y-3">
                        <h3 className="font-semibold text-lg text-gray-900 border-b pb-2">{operator.name}</h3>
                        <div className="space-y-3">
                          {operatorTemplates.map(tpl => (
                            <div key={tpl.id} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm flex items-center justify-between hover:border-blue-300 transition-colors">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900">{tpl.name}</h4>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tpl.status === 'Ativo' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20'}`}>
                                    {tpl.status || 'Ativo'}
                                  </span>
                                  {tpl.version && (
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                      v{tpl.version}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {tpl.category && <span className="mr-3">Categoria: {tpl.category}</span>}
                                  <span>Campos: {tpl.fields?.length || 0}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => toggleStatus(tpl)} title={tpl.status === 'Ativo' ? 'Desativar' : 'Ativar'}>
                                  {tpl.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => duplicateTemplate(tpl)}>
                                  Duplicar
                                </Button>
                                <Button size="sm" onClick={() => setEditingTemplate(tpl)}>
                                  <Edit3 className="mr-2 h-4 w-4" /> Mapear
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
