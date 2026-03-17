import { useState, useCallback, useEffect } from 'react';
import { Search, FileDown, FileSpreadsheet, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, AlertTriangle } from 'lucide-react';
import TransactionTable from '@/components/TransactionTable';
import VerificationTable from '@/components/VerificationTable';
import VerificationDialog from '@/components/VerificationDialog';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useAuth } from '@/lib/auth';
import {
  Transaction, Verification,
  fetchTransactions, fetchVerifications, fetchProfiles,
  getSummary, getCurrentBalance, saveVerification, filterByDateRange, formatCurrency,
} from '@/lib/cashRegister';
import { exportPDF, exportXLSX } from '@/lib/exportUtils';
import { toast } from 'sonner';

export default function ConferentePage() {
  const { user, profile, signOut } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allVerifications, setAllVerifications] = useState<Verification[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [txs, vfs, profs] = await Promise.all([fetchTransactions(), fetchVerifications(), fetchProfiles()]);
      setAllTransactions(txs);
      setAllVerifications(vfs);
      setProfileMap(profs);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const transactions = filterByDateRange(allTransactions, dateFrom, dateTo);
  const verifications = filterByDateRange(allVerifications, dateFrom, dateTo);
  const summary = getSummary(transactions, verifications);
  const currentBalance = getCurrentBalance(allTransactions);

  const latestDifference = verifications.length > 0 ? verifications[verifications.length - 1].difference : 0;
  const hasDifference = Math.abs(latestDifference) > 0.01;

  const handleVerification = useCallback(async (data: { date: string; gaveta_value: number; observation: string }) => {
    if (!user) return;
    try {
      await saveVerification(data, currentBalance, user.id);
      await loadData();
      toast.success('Conferência registrada');
    } catch (e: any) { toast.error(e.message); }
  }, [user, currentBalance, loadData]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conferência de Caixa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile?.display_name} • <span className="text-warning font-medium">Conferente</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => exportPDF([], verifications, profileMap)}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportXLSX([], verifications, profileMap)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> XLSX
            </Button>
            <Button size="sm" onClick={() => setShowVerify(true)}>
              <Search className="h-4 w-4 mr-1" /> Conferir Caixa
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Saldo Atual</p>
                  <p className="text-2xl font-bold font-mono mt-1">{formatCurrency(summary.currentBalance)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${hasDifference ? 'border-l-warning' : 'border-l-success'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Última Diferença</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${hasDifference ? 'text-warning' : 'text-success'}`}>{formatCurrency(latestDifference)}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${hasDifference ? 'bg-warning/10' : 'bg-success/10'}`}>
                  <AlertTriangle className={`h-5 w-5 ${hasDifference ? 'text-warning' : 'text-success'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Conferências de Caixa</h2>
          <VerificationTable verifications={verifications} profileMap={profileMap} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Lançamentos (somente leitura)</h2>
          <TransactionTable transactions={transactions} profileMap={profileMap} canEdit={false} canDelete={false} />
        </div>
      </main>

      <VerificationDialog
        open={showVerify}
        onClose={() => setShowVerify(false)}
        onSubmit={handleVerification}
        currentBalance={currentBalance}
      />
    </div>
  );
}
