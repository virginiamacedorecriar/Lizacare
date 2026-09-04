import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, UploadCloud, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Operator } from './Operators';

interface TableDef {
  id: string;
  name: string;
  operatorId: string;
  version: string;
  status: string;
  count?: number;
  createdAt?: any;
}

export default function Tables() {
  const { user } = useAuthStore();
  const [tables, setTables] = useState<TableDef[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importingState, setImportingState] = useState('');
  
  const [formData, setFormData] = useState({
    name: '', operatorId: '', version: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch operators
    const opsQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
    const opsSnap = await getDocs(opsQ);
    setOperators(opsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]);
    
    // Fetch tables
    const tabsQ = query(collection(db, 'tables'), where('doctorId', '==', user.uid));
    const tabsSnap = await getDocs(tabsQ);
    setTables(tabsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TableDef[]);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const processFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      } else if (ext === 'xls' || ext === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error("Formato não suportado"));
      }
    });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || !formData.name || !formData.operatorId) return;
    
    setIsImporting(true);
    setImportingState('Lendo arquivo...');
    
    try {
      const data = await processFile(selectedFile);
      setImportingState(`Processando ${data.length} procedimentos...`);
      
      // Create table document
      const tableRef = await addDoc(collection(db, 'tables'), {
        doctorId: user.uid,
        name: formData.name,
        operatorId: formData.operatorId,
        version: formData.version,
        status: 'Ativa',
        count: data.length,
        createdAt: new Date()
      });
      
      // Chunk insertions (500 limit for batch)
      const chunks = [];
      for (let i = 0; i < data.length; i += 400) {
        chunks.push(data.slice(i, i + 400));
      }
      
      let processed = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((row: any) => {
          // Try to find the keys case insensitively or commonly named
          const getVal = (possibleKeys: string[]) => {
            const key = Object.keys(row).find(k => possibleKeys.includes(k.toLowerCase().trim()));
            return key ? row[key] : '';
          };
          
          const code = getVal(['código', 'codigo', 'code', 'cd_procedimento']);
          const desc = getVal(['descrição', 'descricao', 'description', 'ds_procedimento']);
          const synonym = getVal(['sinônimo', 'sinonimo', 'synonym']);
          const group = getVal(['grupo', 'group']);
          const subgroup = getVal(['subgrupo', 'subgroup']);
          const defaultQuantity = getVal(['quantidade padrão', 'quantidade', 'quantidade_padrao', 'qtd', 'quantity']);
          const unit = getVal(['unidade', 'unit']);
          const observation = getVal(['observação', 'observacao', 'observation', 'obs']);
          const equivalentCode = getVal(['código equivalente', 'codigo equivalente', 'codigo_equivalente', 'eq_code']);
          const initialValidity = getVal(['vigência inicial', 'vigencia inicial', 'vigencia_inicial', 'start_date']);
          const finalValidity = getVal(['vigência final', 'vigencia final', 'vigencia_final', 'end_date']);
          
          if (code && desc) {
            const procRef = doc(collection(db, 'procedures'));
            batch.set(procRef, {
              doctorId: user.uid,
              tableId: tableRef.id,
              code: String(code),
              description: String(desc),
              synonym: synonym ? String(synonym) : '',
              group: group ? String(group) : '',
              subgroup: subgroup ? String(subgroup) : '',
              defaultQuantity: defaultQuantity ? Number(defaultQuantity) : 1,
              unit: unit ? String(unit) : '',
              observation: observation ? String(observation) : '',
              equivalentCode: equivalentCode ? String(equivalentCode) : '',
              initialValidity: initialValidity ? String(initialValidity) : '',
              finalValidity: finalValidity ? String(finalValidity) : '',
              createdAt: new Date()
            });
          }
        });
        await batch.commit();
        processed += chunk.length;
        setImportingState(`Salvando no banco (${processed}/${data.length})...`);
      }
      
      setImportingState('Concluído!');
      setTimeout(() => {
        setIsImporting(false);
        setFormData({ name: '', operatorId: '', version: '' });
        setSelectedFile(null);
        fetchData();
      }, 1500);

    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/configuracoes">
          <Button variant="outline">Voltar</Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tabelas de Procedimentos</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Importar Tabela</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImport} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Tabela</Label>
                  <Input 
                    required 
                    placeholder="Ex: TUSS ANS 202607" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Versão</Label>
                  <Input 
                    placeholder="Ex: 2026.1" 
                    value={formData.version} 
                    onChange={e => setFormData({...formData, version: e.target.value})} 
                  />
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
                <div className="space-y-2">
                  <Label>Arquivo (CSV, XLS, XLSX)</Label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative hover:bg-gray-50 transition-colors">
                    <div className="space-y-1 text-center">
                      <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                          <span>{selectedFile ? selectedFile.name : 'Selecionar arquivo'}</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="sr-only" 
                            accept=".csv, .xls, .xlsx"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      {!selectedFile && <p className="text-xs text-gray-500">Obrigatório: colunas "código" e "descrição"</p>}
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isImporting || !selectedFile}>
                  {isImporting ? importingState : 'Iniciar Importação'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Carregando tabelas...</div>
              ) : tables.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">Nenhuma tabela importada.</div>
              ) : (
                tables.map(table => {
                  const operatorName = operators.find(o => o.id === table.operatorId)?.name || 'Desconhecida';
                  return (
                    <div key={table.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{table.name}</h4>
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            {table.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Operadora: {operatorName} • Versão: {table.version || '-'} • Data: {table.createdAt?.toDate ? table.createdAt.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {table.count || 0} proc.
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
