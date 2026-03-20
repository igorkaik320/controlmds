import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, PlayCircle, FileDown, FileSpreadsheet, Search, LogOut, History, Users, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardCards from '@/components/DashboardCards';
import TransactionTable from '@/components/TransactionTable';
import VerificationTable from '@/components/VerificationTable';
import InitBalanceDialog from '@/components/InitBalanceDialog';
import NewTransactionDialog from '@/components/NewTransactionDialog';
import VerificationDialog from '@/components/VerificationDialog';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useAuth } from '@/lib/auth';
import {
  Transaction,
  TransactionType,
  Verification,
  fetchTransactions,
  saveTransactionToDB,
  updateTransactionInDB,
  deleteTransactionFromDB,
  recalculateAndSave,
  fetchVerifications,
  fetchProfiles,
  getSummary,
  getCurrentBalance,
  saveVerification,
  deleteVerificationFromDB,
  filterByDateRange,
} from '@/lib/cashRegister';
import { exportPDF, exportXLSX } from '@/lib/exportUtils';
import LogoSettings from '@/components/LogoSettings';
import { toast } from 'sonner';

export default function AdminPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allVerifications, setAllVerifications] = useState<Verification[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showInit, setShowInit] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showLogo, setShowLogo] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [txs, vfs, profs] = await Promise.all([
        fetchTransactions(),
        fetchVerifications(),
        fetchProfiles(),
      ]);

      setAllTransactions(txs);
      setAllVerifications(vfs);
      setProfileMap(profs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const transactions = filterByDateRange(allTransactions, dateFrom, dateTo);
  const verifications = filterByDateRange(allVerifications, dateFrom, dateTo);
  const summary = getSummary(transactions, verifications);
  const currentBalance = getCurrentBalance(allTransactions);

  const handleInit = useCallback(async (data: { date: string; value: number; observation: string }) => {
    if (!user) return;

    try {
      await saveTransactionToDB(
        {
          date: data.date,
          type: 'inicializacao',
          value: data.value,
          observation: data.observation,
          created_by: user.id,
        },
        user.id
      );

      const updatedTransactions = await recalculateAndSave();
      setAllTransactions(updatedTransactions);

      const updatedVerifications = await fetchVerifications();
      setAllVerifications(updatedVerifications);

      toast.success('Inicialização registrada');
      setShowInit(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user]);

  const handleNewTransaction = useCallback(async (data: {
    date: string;
    type: TransactionType;
    value: number;
    gaveta?: number | null;
    observation: string;
    obra?: string | null;
    fornecedor?: string | null;
    nota_numero?: string | null;
  }) => {
    if (!user) return;

    try {
      if (editingId) {
        const oldTx = allTransactions.find((t) => t.id === editingId);
        await updateTransactionInDB(editingId, data, user.id, oldTx);
        setEditingId(null);
      } else {
        await saveTransactionToDB({ ...data, created_by: user.id }, user.id);
      }

      const updatedTransactions = await recalculateAndSave();
      setAllTransactions(updatedTransactions);

      toast.success(editingId ? 'Lançamento atualizado' : 'Lançamento registrado');
      setShowNew(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user, editingId, allTransactions]);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setShowNew(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;

    try {
      const oldTx = allTransactions.find((t) => t.id === id);
      await deleteTransactionFromDB(id, user.id, oldTx);

      const updatedTransactions = await recalculateAndSave();
      setAllTransactions(updatedTransactions);

      toast.success('Lançamento excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user, allTransactions]);

  const handleDeleteVerification = useCallback(async (id: string) => {
    if (!user) return;
    if (!window.confirm('Tem certeza que deseja excluir esta conferência?')) return;

    try {
      const oldV = allVerifications.find((v) => v.id === id);
      await deleteVerificationFromDB(id, user.id, oldV);

      const updatedVerifications = await fetchVerifications();
      setAllVerifications(updatedVerifications);

      toast.success('Conferência excluída');
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user, allVerifications]);

  const handleVerification = useCallback(async (data: { date: string; gaveta_value: number; observation: string }) => {
    if (!user) return;

    try {
      await saveVerification(data, currentBalance, user.id);

      const updatedVerifications = await fetchVerifications();
      setAllVerifications(updatedVerifications);

      toast.success('Conferência registrada');
      setShowVerify(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [user, currentBalance]);

  const editingTx = editingId ? allTransactions.find((t) => t.id === editingId) : null;

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Controle de Caixa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile?.display_name} • <span className="text-destructive font-medium">Administrador</span>
            </p>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportPDF(transactions, verifications, profileMap)}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>

            <Button variant="outline" size="sm" onClick={() => exportXLSX(transactions, verifications, profileMap)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> XLSX
            </Button>

            <Button variant="outline" size="sm" onClick={() => setShowLogo(true)}>
              <ImagePlus className="h-4 w-4 mr-1" /> Logo
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate('/auditoria')}>
              <History className="h-4 w-4 mr-1" /> Auditoria
            </Button>

            <Button variant="outline" size="sm" onClick={() => setShowInit(true)}>
              <PlayCircle className="h-4 w-4 mr-1" /> Inicialização
            </Button>

            <Button variant="outline" size="sm" onClick={() => setShowVerify(true)}>
              <Search className="h-4 w-4 mr-1" /> Conferir Caixa
            </Button>

            <Button size="sm" onClick={() => { setEditingId(null); setShowNew(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Registro
            </Button>

            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        <DashboardCards summary={summary} />

        <div>
          <h2 className="text-lg font-semibold mb-3">Lançamentos</h2>
          <TransactionTable
            transactions={transactions}
            onEdit={handleEdit}
            onDelete={handleDelete}
            profileMap={profileMap}
            canEdit
            canDelete
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Conferências de Caixa</h2>
          <VerificationTable
            verifications={verifications}
            profileMap={profileMap}
            onDelete={handleDeleteVerification}
            canDelete
          />
        </div>
      </main>

      <InitBalanceDialog open={showInit} onClose={() => setShowInit(false)} onSubmit={handleInit} />

      <NewTransactionDialog
        open={showNew}
        onClose={() => {
          setShowNew(false);
          setEditingId(null);
        }}
        onSubmit={handleNewTransaction}
        editData={editingTx ? {
          date: editingTx.date,
          type: editingTx.type as TransactionType,
          value: editingTx.value,
          gaveta: editingTx.gaveta,
          observation: editingTx.observation,
          obra: editingTx.obra,
          fornecedor: editingTx.fornecedor,
          nota_numero: editingTx.nota_numero,
        } : null}
      />

      <VerificationDialog
        open={showVerify}
        onClose={() => setShowVerify(false)}
        onSubmit={handleVerification}
        currentBalance={currentBalance}
      />

      <LogoSettings open={showLogo} onClose={() => setShowLogo(false)} />
    </div>
  );
}
