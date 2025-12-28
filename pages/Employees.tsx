
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Employee, Role, SalaryType, PayFrequency, EmployeePaymentEvent, View 
} from '../types';
import { 
  UserCheck, Plus, Search, Camera, Phone, Mail, IdCard, Calendar, 
  DollarSign, Zap, Receipt, History, Trash2, Edit3, X, Save, 
  CheckCircle, AlertCircle, Info, ChevronRight, Briefcase, FileText
} from 'lucide-react';

export const Employees: React.FC = () => {
  const { 
    employees, addEmployee, updateEmployee, deleteEmployee, addEmployeePayment, 
    sales, users, notify, businessConfig 
  } = useStore();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'PAYMENTS' | 'ACTIVITY'>('DETAILS');
  
  // Borrador para creación/edición
  const [draft, setDraft] = useState<Partial<Employee>>({});
  const [rawPin, setRawPin] = useState('');

  // Borrador para pagos
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', note: '' });

  const filteredEmployees = useMemo(() => employees.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    (e.ci || '').includes(search)
  ), [employees, search]);

  const activeEmployee = useMemo(() => 
    employees.find(e => e.id === draft.id) || draft as Employee
  , [employees, draft.id, draft]);

  // Actividad TPV: Filtramos ventas donde el nombre del vendedor coincida con el empleado
  const employeeSales = useMemo(() => {
    if (!activeEmployee.id) return [];
    return sales.filter(s => s.sellerName === activeEmployee.name);
  }, [sales, activeEmployee.name]);

  const handleSave = async () => {
    if (!draft.name?.trim()) { notify("Nombre obligatorio", "error"); return; }
    if (!draft.role) { notify("Seleccione un rol", "error"); return; }
    if (!draft.hireDate) { notify("Fecha de contratación obligatoria", "error"); return; }
    if (!draft.id && !rawPin) { notify("PIN TPV obligatorio", "error"); return; }
    if (rawPin && rawPin.length !== 4) { notify("El PIN debe ser de 4 dígitos", "error"); return; }

    // Validar Unicidad
    const others = employees.filter(e => e.id !== draft.id);
    if (draft.ci && others.some(e => e.ci === draft.ci)) { notify("Carnet de Identidad ya registrado", "error"); return; }
    if (draft.phone && others.some(e => e.phone === draft.phone)) { notify("Teléfono ya registrado", "error"); return; }
    if (draft.email && others.some(e => e.email === draft.email)) { notify("Correo electrónico ya registrado", "error"); return; }

    const finalEmployee: Employee = {
      id: draft.id || crypto.randomUUID().toUpperCase(),
      userId: draft.userId || '', // Se asignará en el context si es nuevo
      name: draft.name,
      photo: draft.photo,
      ci: draft.ci,
      phone: draft.phone,
      email: draft.email,
      hireDate: draft.hireDate,
      terminationDate: draft.terminationDate,
      role: draft.role,
      salaryType: draft.salaryType || SalaryType.FIXED,
      salaryFixedAmount: Number(draft.salaryFixedAmount) || 0,
      salaryPercent: Number(draft.salaryPercent) || 0,
      payFrequency: draft.payFrequency || PayFrequency.MONTHLY,
      paymentHistory: draft.paymentHistory || [],
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (draft.id) {
      await updateEmployee(finalEmployee, rawPin || undefined);
    } else {
      await addEmployee(finalEmployee, rawPin);
    }

    setIsModalOpen(false);
    setDraft({});
    setRawPin('');
  };

  const handleAddPayment = () => {
    const amt = parseFloat(paymentDraft.amount);
    if (!amt || amt <= 0) { notify("Monto inválido", "error"); return; }

    const event: EmployeePaymentEvent = {
      id: crypto.randomUUID().toUpperCase(),
      timestamp: new Date().toISOString(),
      amount: amt,
      currency: businessConfig.primaryCurrency,
      note: paymentDraft.note
    };

    addEmployeePayment(activeEmployee.id, event);
    setPaymentDraft({ amount: '', note: '' });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 524288) { notify("Máx 512KB", "error"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setDraft(prev => ({ ...prev, photo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 h-full overflow-y-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Empleados</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Capital Humano y Control Salarial</p>
        </div>
        <button 
          onClick={() => { 
            setDraft({ hireDate: new Date().toISOString().slice(0, 10), role: Role.DEPENDENT, salaryType: SalaryType.FIXED, payFrequency: PayFrequency.MONTHLY }); 
            setRawPin('');
            setIsModalOpen(true); 
          }} 
          className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-600 transition-all flex items-center gap-3"
        >
          <Plus size={20}/> Nuevo Empleado
        </button>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-gray-100 flex gap-4 items-center mb-8">
        <Search className="text-gray-300" size={24} />
        <input 
          className="flex-1 outline-none bg-transparent font-bold text-slate-700 placeholder:text-gray-300 text-sm" 
          placeholder="Buscar empleado por nombre o CI..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredEmployees.map((emp) => (
          <div key={emp.id} className="bg-white rounded-[3rem] border border-gray-100 hover:shadow-2xl transition-all p-4 group relative flex flex-col items-center text-center">
            <div className={`absolute top-6 right-6 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${emp.terminationDate ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {emp.terminationDate ? 'Inactivo (Baja)' : 'Activo'}
            </div>
            <div className="p-6 w-full">
              <div className="w-24 h-24 rounded-[2rem] bg-gray-50 flex-shrink-0 overflow-hidden mb-5 mx-auto ring-4 ring-white shadow-xl">
                {emp.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50"><UserCheck size={48} /></div>}
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-1 truncate w-full tracking-tighter uppercase">{emp.name}</h3>
              <div className="text-[9px] font-black text-brand-500 uppercase tracking-widest mb-4">{emp.role}</div>
              
              <div className="space-y-1 mb-6 text-slate-400 font-bold text-[10px] uppercase">
                <div className="flex items-center justify-center gap-2"><Briefcase size={12}/> Contratado: {new Date(emp.hireDate).toLocaleDateString()}</div>
                {emp.ci && <div className="flex items-center justify-center gap-2"><IdCard size={12}/> {emp.ci}</div>}
              </div>

              <button 
                onClick={() => { setDraft(emp); setRawPin(''); setIsDetailOpen(true); setActiveTab('DETAILS'); }} 
                className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-colors shadow-lg"
              >
                Gestionar Ficha
              </button>
            </div>
          </div>
        ))}
        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-xs">Sin registros de personal</div>
        )}
      </div>

      {/* MODAL CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in h-auto max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <h2 className="text-2xl font-black uppercase tracking-tighter">{draft.id ? 'Editar Empleado' : 'Registro de Personal'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-4 flex flex-col items-center">
                  <div className="w-40 h-40 rounded-[2.5rem] bg-gray-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden mb-4 relative group">
                    {draft.photo ? <img src={draft.photo} alt="Empleado" className="w-full h-full object-cover" /> : <UserCheck size={64} className="text-slate-200" />}
                    <label className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                      <Camera className="text-white" size={32} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identidad Visual</p>
                </div>

                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Nombre Completo *</label>
                    <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-slate-800 outline-none focus:ring-2 focus:ring-brand-500" value={draft.name || ''} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="Ej: Mario Díaz" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Carnet de Identidad</label>
                    <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none" value={draft.ci || ''} onChange={e => setDraft({...draft, ci: e.target.value.replace(/\D/g, '')})} placeholder="11 dígitos" maxLength={11} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Teléfono</label>
                    <input className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none" value={draft.phone || ''} onChange={e => setDraft({...draft, phone: e.target.value})} placeholder="Móvil / Casa" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Rol del Sistema *</label>
                    <select className="w-full bg-slate-50 border-none p-5 rounded-3xl font-black text-xs uppercase outline-none" value={draft.role} onChange={e => setDraft({...draft, role: e.target.value as Role})}>
                      {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">PIN TPV (4 dígitos) {draft.id ? '(Opcional para cambio)' : '*'}</label>
                    <input className="w-full bg-slate-900 text-white border-none p-5 rounded-3xl font-black text-center text-xl tracking-[0.5em] outline-none" type="password" value={rawPin} onChange={e => setRawPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} placeholder="••••" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-gray-100">
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest mb-6 flex items-center gap-2"><DollarSign size={16} className="text-emerald-500"/> Definición Salarial</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Tipo de Salario</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-2xl font-bold text-xs uppercase" value={draft.salaryType} onChange={e => setDraft({...draft, salaryType: e.target.value as SalaryType})}>
                      <option value={SalaryType.FIXED}>Fijo</option>
                      <option value={SalaryType.PERCENT}>Porcentaje</option>
                      <option value={SalaryType.BOTH}>Fijo + Porcentaje</option>
                    </select>
                  </div>
                  {(draft.salaryType === SalaryType.FIXED || draft.salaryType === SalaryType.BOTH) && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Monto Fijo ({businessConfig.primaryCurrency})</label>
                      <input type="number" className="w-full bg-white border border-gray-200 p-4 rounded-2xl font-black" value={draft.salaryFixedAmount} onChange={e => setDraft({...draft, salaryFixedAmount: Number(e.target.value)})} />
                    </div>
                  )}
                  {(draft.salaryType === SalaryType.PERCENT || draft.salaryType === SalaryType.BOTH) && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Porcentaje (%)</label>
                      <input type="number" className="w-full bg-white border border-gray-200 p-4 rounded-2xl font-black" value={draft.salaryPercent} onChange={e => setDraft({...draft, salaryPercent: Number(e.target.value)})} min={0} max={100} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Frecuencia de Pago</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-2xl font-bold text-xs uppercase" value={draft.payFrequency} onChange={e => setDraft({...draft, payFrequency: e.target.value as PayFrequency})}>
                      <option value={PayFrequency.DAILY}>Diario</option>
                      <option value={PayFrequency.WEEKLY}>Semanal</option>
                      <option value={PayFrequency.BIWEEKLY}>Quincenal</option>
                      <option value={PayFrequency.MONTHLY}>Mensual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Fecha Contratación *</label>
                  <input type="date" className="w-full bg-slate-50 border-none p-5 rounded-3xl font-bold outline-none" value={draft.hireDate} onChange={e => setDraft({...draft, hireDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 pl-2">Fecha Baja Laboral</label>
                  <input type="date" className="w-full bg-red-50 border-none p-5 rounded-3xl font-bold text-red-600 outline-none" value={draft.terminationDate || ''} onChange={e => setDraft({...draft, terminationDate: e.target.value || undefined})} />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row gap-4">
                <button onClick={handleSave} className="flex-1 bg-slate-900 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-brand-600 transition-all uppercase tracking-[0.2em] text-xs">
                  Guardar Empleado
                </button>
                {draft.id && (
                  <button 
                    onClick={() => { if(confirm('¿Eliminar empleado? Perderá acceso TPV.')) { deleteEmployee(draft.id!); setIsModalOpen(false); }}} 
                    className="px-8 bg-red-50 text-red-500 font-black rounded-3xl uppercase text-[10px] tracking-widest"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHA DETALLADA / PERFIL */}
      {isDetailOpen && activeEmployee.id && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[160] flex items-end md:items-center justify-center p-0 md:p-10 animate-in fade-in">
          <div className="bg-white md:rounded-[4rem] w-full max-w-6xl h-full md:h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in">
            {/* Sidebar Perfil */}
            <div className="w-full md:w-80 bg-slate-900 text-white p-8 flex flex-col items-center shrink-0">
              <div className="relative mb-6">
                <div className="w-28 h-28 md:w-40 md:h-40 rounded-[2.5rem] md:rounded-[3.5rem] bg-white/10 overflow-hidden shadow-2xl border-4 border-slate-800">
                  {activeEmployee.photo ? <img src={activeEmployee.photo} className="w-full h-full object-cover" /> : <UserCheck size={80} className="m-auto mt-6 text-slate-700" />}
                </div>
                {activeEmployee.terminationDate ? (
                   <div className="absolute -bottom-2 -right-2 bg-red-500 text-white p-2 rounded-xl shadow-lg border-4 border-slate-900"><X size={18}/></div>
                ) : (
                   <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-4 border-slate-900"><CheckCircle size={18}/></div>
                )}
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-center mb-1">{activeEmployee.name}</h2>
              <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-10">{activeEmployee.role}</p>

              <div className="w-full space-y-4 mb-10">
                <button 
                  onClick={() => setActiveTab('DETAILS')} 
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'DETAILS' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  <FileText size={18}/> Datos Ficha
                </button>
                <button 
                  onClick={() => setActiveTab('PAYMENTS')} 
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'PAYMENTS' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  <DollarSign size={18}/> Pagos
                </button>
                <button 
                  onClick={() => setActiveTab('ACTIVITY')} 
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'ACTIVITY' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  <History size={18}/> Actividad TPV
                </button>
              </div>

              <div className="mt-auto w-full space-y-2">
                <button onClick={() => { setIsModalOpen(true); setIsDetailOpen(false); }} className="w-full bg-white/10 hover:bg-white text-white hover:text-slate-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Editar Ficha</button>
                <button onClick={() => setIsDetailOpen(false)} className="w-full bg-slate-800 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cerrar</button>
              </div>
            </div>

            {/* Contenido Dinámico */}
            <div className="flex-1 bg-gray-50 overflow-y-auto p-6 md:p-12">
              {activeTab === 'DETAILS' && (
                <div className="space-y-10 animate-in fade-in">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-2"><Info size={20} className="text-brand-500"/> Información de Empleado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Identificación CI</p>
                        <p className="font-bold text-slate-800">{activeEmployee.ci || 'No registrada'}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Email Corporativo / Personal</p>
                        <p className="font-bold text-slate-800 lowercase">{activeEmployee.email || 'No registrado'}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Móvil</p>
                        <p className="font-bold text-slate-800">{activeEmployee.phone || 'No registrado'}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Frecuencia Pago</p>
                        <p className="font-bold text-slate-800 uppercase">{activeEmployee.payFrequency}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fecha Contratación</p>
                        <p className="font-bold text-slate-800">{new Date(activeEmployee.hireDate).toLocaleDateString()}</p>
                      </div>
                      {activeEmployee.terminationDate && (
                        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm">
                          <p className="text-[9px] font-black text-red-400 uppercase mb-1">Fecha de Baja</p>
                          <p className="font-bold text-red-600">{new Date(activeEmployee.terminationDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 text-white/5"><DollarSign size={150}/></div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-400 mb-8">Esquema Remunerativo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo de Salario</p>
                        <p className="text-2xl font-black uppercase">{activeEmployee.salaryType}</p>
                      </div>
                      <div className="flex gap-10">
                        {(activeEmployee.salaryType === SalaryType.FIXED || activeEmployee.salaryType === SalaryType.BOTH) && (
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Base Fija</p>
                            <p className="text-3xl font-black text-emerald-400">${activeEmployee.salaryFixedAmount?.toFixed(2)}</p>
                          </div>
                        )}
                        {(activeEmployee.salaryType === SalaryType.PERCENT || activeEmployee.salaryType === SalaryType.BOTH) && (
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Comisión</p>
                            <p className="text-3xl font-black text-brand-400">{activeEmployee.salaryPercent}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'PAYMENTS' && (
                <div className="space-y-10 animate-in fade-in">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex-1">
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-2"><DollarSign size={20} className="text-emerald-500"/> Registrar Pago Manual</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <input 
                            type="number" 
                            className="bg-gray-50 border-none p-5 rounded-2xl font-black text-2xl outline-none focus:ring-2 focus:ring-emerald-500" 
                            placeholder="Monto $0.00" 
                            value={paymentDraft.amount} 
                            onChange={e => setPaymentDraft({...paymentDraft, amount: e.target.value})} 
                          />
                          <textarea 
                            className="bg-gray-50 border-none p-5 rounded-2xl font-bold text-xs h-24 outline-none resize-none" 
                            placeholder="Notas o descripción del pago..." 
                            value={paymentDraft.note} 
                            onChange={e => setPaymentDraft({...paymentDraft, note: e.target.value})} 
                          />
                        </div>
                        <button onClick={handleAddPayment} className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-700 transition-all">Confirmar Pago</button>
                      </div>
                    </div>

                    <div className="bg-slate-900 text-white p-10 rounded-[3rem] w-full md:w-80 shadow-2xl flex flex-col justify-center items-center text-center">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Total Pagado Histórico</p>
                       <h4 className="text-4xl font-black text-emerald-400 tracking-tighter mb-4">
                        ${activeEmployee.paymentHistory.reduce((acc, p) => acc + p.amount, 0).toFixed(2)}
                       </h4>
                       <p className="text-[8px] font-bold text-slate-500 uppercase">Último pago: {activeEmployee.paymentHistory[0] ? new Date(activeEmployee.paymentHistory[0].timestamp).toLocaleDateString() : 'Nunca'}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[9px] font-black uppercase text-slate-400 border-b border-gray-100">
                        <tr><th className="p-6">Fecha / Hora</th><th className="p-6">Nota</th><th className="p-6 text-right">Monto</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {activeEmployee.paymentHistory.map(p => (
                          <tr key={p.id} className="text-xs">
                            <td className="p-6">
                              <p className="font-bold text-slate-800">{new Date(p.timestamp).toLocaleDateString()}</p>
                              <p className="text-[9px] text-slate-400">{new Date(p.timestamp).toLocaleTimeString()}</p>
                            </td>
                            <td className="p-6 font-medium text-slate-500 italic max-w-xs truncate">{p.note || '-'}</td>
                            <td className="p-6 text-right font-black text-emerald-600">${p.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                        {activeEmployee.paymentHistory.length === 0 && (
                          <tr><td colSpan={3} className="p-10 text-center text-slate-300 font-black uppercase text-[10px]">Sin movimientos de pago</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'ACTIVITY' && (
                <div className="space-y-10 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas Realizadas</p>
                       <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{employeeSales.length}</h4>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Facturado</p>
                       <h4 className="text-4xl font-black text-brand-600 tracking-tighter">${employeeSales.reduce((acc, s) => acc + s.total, 0).toFixed(2)}</h4>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
                       <h4 className="text-4xl font-black text-slate-900 tracking-tighter">
                        ${employeeSales.length ? (employeeSales.reduce((acc, s) => acc + s.total, 0) / employeeSales.length).toFixed(2) : '0.00'}
                       </h4>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[9px] font-black uppercase text-slate-400 border-b border-gray-100">
                        <tr><th className="p-6">Folio Ticket</th><th className="p-6">Fecha</th><th className="p-6">Ítems</th><th className="p-6 text-right">Monto Total</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {employeeSales.reverse().slice(0, 50).map(s => (
                          <tr key={s.id} className="text-xs">
                            <td className="p-6 font-black text-slate-800">#{s.id.slice(-6)}</td>
                            <td className="p-6 font-bold text-slate-500">{new Date(s.timestamp).toLocaleDateString()}</td>
                            <td className="p-6 font-bold text-slate-500">{s.items.length}</td>
                            <td className="p-6 text-right font-black text-slate-900">${s.total.toFixed(2)} <span className="text-[8px] text-slate-400">{s.currency}</span></td>
                          </tr>
                        ))}
                        {employeeSales.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center text-slate-300 font-black uppercase text-[10px]">Sin actividad de venta registrada</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
