import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Search, Plus, Trash2, FileText, CheckCircle2, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import { toast } from 'react-hot-toast';
import { normalizeText } from '../lib/utils';
import { cid10Data, CID10 } from '../data/cid10';

export default function NewRequest() {
  const { user, profile } = useAuthStore();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  const [clinicalData, setClinicalData] = useState({
    indication: '', cid: '', justification: '', date: new Date().toISOString().split('T')[0]
  });
  
  const [allProcedures, setAllProcedures] = useState<any[]>([]);
  const [procSearch, setProcSearch] = useState('');
  
  const [cidSearch, setCidSearch] = useState('');
  const [showCidResults, setShowCidResults] = useState(false);
  
  const [selectedProcedures, setSelectedProcedures] = useState<any[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchInitialData = async () => {
      const pQ = query(collection(db, 'patients'), where('doctorId', '==', user.uid));
      const pSnap = await getDocs(pQ);
      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const oQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
      const oSnap = await getDocs(oQ);
      setOperators(oSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Load all procedures for client-side normalized search
      const procQ = query(collection(db, 'procedures'), where('doctorId', '==', user.uid));
      const procSnap = await getDocs(procQ);
      setAllProcedures(procSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedOperatorId) {
      setTemplates([]);
      return;
    }
    const fetchTemplates = async () => {
      const tQ = query(collection(db, 'templates'), where('doctorId', '==', user.uid), where('operatorId', '==', selectedOperatorId));
      const tSnap = await getDocs(tQ);
      setTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchTemplates();
  }, [user, selectedOperatorId]);

  const procResults = useMemo(() => {
    if (procSearch.length < 2) return [];
    const searchNorm = normalizeText(procSearch);
    return allProcedures.filter(p => 
      normalizeText(p.code).includes(searchNorm) || 
      normalizeText(p.description).includes(searchNorm) ||
      (p.synonym && normalizeText(p.synonym).includes(searchNorm))
    ).slice(0, 15);
  }, [procSearch, allProcedures]);

  const cidResults = useMemo(() => {
    if (cidSearch.length < 2) return [];
    const searchNorm = normalizeText(cidSearch);
    return cid10Data.filter(c => 
      normalizeText(c.code).includes(searchNorm) || 
      normalizeText(c.description).includes(searchNorm)
    ).slice(0, 10);
  }, [cidSearch]);

  const addProcedure = (proc: any) => {
    // If it's the first one, mark as principal
    const isPrincipal = selectedProcedures.length === 0;
    setSelectedProcedures([...selectedProcedures, { ...proc, quantity: proc.defaultQuantity || 1, isPrincipal }]);
    setProcSearch('');
  };
  
  const updateProcQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    const newProcs = [...selectedProcedures];
    newProcs[index].quantity = qty;
    setSelectedProcedures(newProcs);
  };
  
  const removeProcedure = (index: number) => {
    const newProcs = [...selectedProcedures];
    const removedWasPrincipal = newProcs[index].isPrincipal;
    newProcs.splice(index, 1);
    
    // If we removed the principal, make the new first one principal if it exists
    if (removedWasPrincipal && newProcs.length > 0) {
      newProcs[0].isPrincipal = true;
    }
    
    setSelectedProcedures(newProcs);
  };
  
  const setPrincipalProcedure = (index: number) => {
    const newProcs = selectedProcedures.map((p, i) => ({
      ...p,
      isPrincipal: i === index
    }));
    setSelectedProcedures(newProcs);
  };
  
  const moveProcedure = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedProcedures.length - 1) return;
    
    const newProcs = [...selectedProcedures];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newProcs[index];
    newProcs[index] = newProcs[targetIndex];
    newProcs[targetIndex] = temp;
    
    setSelectedProcedures(newProcs);
  };

  const generatePDF = async () => {
    if (!selectedPatientId || !selectedOperatorId || !selectedTemplateId) {
      toast.error("Preencha Paciente, Operadora e Template.");
      return;
    }

    
    setIsGenerating(true);
    try {
      const patient = patients.find(p => p.id === selectedPatientId);
      const template = templates.find(t => t.id === selectedTemplateId);
      
      let pdfDoc;
      if (template.pdfData) {
        // pdfData is a Data URL: data:application/pdf;base64,....
        pdfDoc = await PDFDocument.load(template.pdfData);
      } else if (template.pdfUrl) {
        // Fallback for older formats (might fail without Storage rules)
        const res = await fetch(template.pdfUrl);
        const existingPdfBytes = await res.arrayBuffer();
        pdfDoc = await PDFDocument.load(existingPdfBytes);
      } else {
        throw new Error("O template não possui um arquivo PDF válido.");
      }
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      const getValue = (mappedTo: string, loopIndex = 0) => {
        if (mappedTo === 'patient.name') return patient?.name || '';
        if (mappedTo === 'patient.cpf') return patient?.cpf || '';
        if (mappedTo === 'patient.healthPlanNumber') return patient?.healthPlanNumber || '';
        if (mappedTo === 'patient.healthPlanValidity') return patient?.healthPlanValidity || '';
        
        if (mappedTo === 'doctor.name') return profile?.name || '';
        if (mappedTo === 'doctor.crm') return profile?.crm || '';
        if (mappedTo === 'doctor.specialty') return profile?.specialty || '';
        
        if (mappedTo === 'clinicalData.indication') return clinicalData.indication || '';
        if (mappedTo === 'clinicalData.cid') return clinicalData.cid || '';
        if (mappedTo === 'clinicalData.justification') return clinicalData.justification || '';
        if (mappedTo === 'clinicalData.date') return clinicalData.date || '';
        
        if (mappedTo === 'procedure.code') return selectedProcedures[loopIndex]?.code || '';
        if (mappedTo === 'procedure.description') return selectedProcedures[loopIndex]?.description || '';
        if (mappedTo === 'procedure.quantity') return selectedProcedures[loopIndex] ? String(selectedProcedures[loopIndex].quantity) : '';
        
        return '';
      };
      
      // We assume each field can be repeated if it's a procedure field.
      // For simplicity in MVP, if it's a procedure field, we'll draw it as many times as we have procedures,
      // moving it down by 15 points each time.
      template.fields.forEach((field: any) => {
        const isProcField = field.mappedTo.startsWith('procedure.');
        const maxLoops = isProcField ? selectedProcedures.length : 1;
        
        for (let i = 0; i < maxLoops; i++) {
          const text = getValue(field.mappedTo, i);
          if (text) {
            const x = (field.x / 100) * width;
            // standard spacing for repetitive fields (e.g. 15 points per row)
            const yOffset = isProcField ? (i * 15) : 0;
            // pdf-lib y is from bottom
            const y = height - ((field.y / 100) * height) - field.fontSize - yOffset;
            
            firstPage.drawText(text, {
              x, y, size: field.fontSize || 10, color: rgb(0, 0, 0)
            });
          }
        }
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `Solicitacao_${patient?.name.replace(/\s+/g, '_')}_${clinicalData.date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Save request to history
      await addDoc(collection(db, 'requests'), {
        doctorId: user.uid,
        patientId: selectedPatientId,
        operatorId: selectedOperatorId,
        templateId: selectedTemplateId,
        clinicalData,
        procedures: selectedProcedures,
        status: 'PDF gerado',
        createdAt: new Date()
      });
      
      toast.success('PDF gerado e salvo com sucesso!');
    } catch (err: any) {
      toast.error("Erro ao gerar PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nova Solicitação</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <select 
            className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
            value={selectedPatientId}
            onChange={e => setSelectedPatientId(e.target.value)}
          >
            <option value="">Selecione o paciente...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} - {p.healthPlanName}</option>
            ))}
          </select>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Convênio e Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Operadora</Label>
            <select 
              className="flex h-10 w-full mt-1 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
              value={selectedOperatorId}
              onChange={e => setSelectedOperatorId(e.target.value)}
            >
              <option value="">Selecione a operadora...</option>
              {operators.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          
          {selectedOperatorId && (
            <div>
              <Label>Template (Formulário PDF)</Label>
              <select 
                className="flex h-10 w-full mt-1 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Selecione o template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {templates.length === 0 && <p className="text-xs text-red-500 mt-1">Nenhum template cadastrado para esta operadora.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Indicação Clínica</Label>
                <Input value={clinicalData.indication} onChange={e => setClinicalData({...clinicalData, indication: e.target.value})} />
              </div>
              <div className="space-y-2 relative">
                <Label>CID-10 Principal</Label>
                <Input 
                  placeholder="Ex: M17, K40 ou gonartrose" 
                  value={cidSearch}
                  onChange={e => {
                    setCidSearch(e.target.value);
                    if (!showCidResults) setShowCidResults(true);
                  }}
                  onFocus={() => setShowCidResults(true)}
                  onBlur={() => setTimeout(() => setShowCidResults(false), 200)}
                />
                
                {showCidResults && cidResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                    {cidResults.map(cid => (
                      <div 
                        key={cid.code} 
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex flex-col"
                        onClick={() => {
                          setClinicalData({...clinicalData, cid: cid.code});
                          setCidSearch(`${cid.code} - ${cid.description}`);
                          setShowCidResults(false);
                        }}
                      >
                        <span className="font-medium text-sm text-gray-900">{cid.code}</span>
                        <span className="text-xs text-gray-500">{cid.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Justificativa Clínica</Label>
              <textarea 
                className="flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 min-h-[80px]"
                value={clinicalData.justification}
                onChange={e => setClinicalData({...clinicalData, justification: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:w-1/3">
              <Label>Data da Solicitação</Label>
              <Input type="date" value={clinicalData.date} onChange={e => setClinicalData({...clinicalData, date: e.target.value})} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Procedimentos Solicitados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar procedimento por código, descrição ou sinônimo..." 
                className="pl-9"
                value={procSearch}
                onChange={e => setProcSearch(e.target.value)}
              />
              
              {procResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {procResults.map(proc => (
                    <div 
                      key={proc.id} 
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex flex-col"
                      onClick={() => addProcedure(proc)}
                    >
                      <span className="font-medium text-sm text-gray-900">{proc.code} - {proc.description}</span>
                      {proc.synonym && <span className="text-xs text-gray-500">Sinônimo: {proc.synonym}</span>}
                      {proc.group && <span className="text-xs text-blue-500">{proc.group}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2 mt-4">
              {selectedProcedures.map((proc, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded-md border ${proc.isPrincipal ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1 flex flex-col gap-1">
                    <p className="font-medium text-sm text-gray-900 flex items-center gap-2">
                      {proc.isPrincipal ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> : null}
                      {proc.code} - {proc.description}
                    </p>
                    <div className="flex gap-2">
                      {!proc.isPrincipal && (
                        <button type="button" onClick={() => setPrincipalProcedure(index)} className="text-xs text-blue-600 hover:underline">
                          Tornar principal
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1 mr-2">
                      <button type="button" disabled={index === 0} onClick={() => moveProcedure(index, 'up')} className="text-gray-400 hover:text-gray-900 disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={index === selectedProcedures.length - 1} onClick={() => moveProcedure(index, 'down')} className="text-gray-400 hover:text-gray-900 disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Qtd.</Label>
                      <div className="flex items-center bg-white border border-gray-300 rounded-md">
                        <button type="button" className="px-2 py-1 text-gray-500 hover:text-gray-900" onClick={() => updateProcQuantity(index, proc.quantity - 1)}>-</button>
                        <span className="px-2 text-sm">{proc.quantity}</span>
                        <button type="button" className="px-2 py-1 text-gray-500 hover:text-gray-900" onClick={() => updateProcQuantity(index, proc.quantity + 1)}>+</button>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeProcedure(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {selectedProcedures.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
                  Nenhum procedimento adicionado
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg" onClick={generatePDF} disabled={isGenerating}>
          {isGenerating ? 'Gerando...' : (
            <>
              <FileText className="mr-2 h-5 w-5" /> GERAR PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
