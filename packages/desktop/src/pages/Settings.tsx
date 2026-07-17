import { User, Store, CreditCard, Bell, Check, Loader2, Printer, Users, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pos/shared/components/card';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Label } from '@pos/shared/components/label';
import { Switch } from '@pos/shared/components/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Badge } from '@pos/shared/components/badge';
import { useSettings } from '@/hooks/useSettings';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';

interface UserRow {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

export default function Settings() {
  const { settings, update, reset, loading } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState('cashier');
  const [userError, setUserError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.users.list() as UserRow[];
      setUsers(data || []);
    } catch {
      // admin-only, silently fail for non-admins
    }
    setUsersLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 300);
  };

  const handleTestPrint = async () => {
    try {
      const result = await api.receipt.testPrint() as { success: boolean; error?: string; message?: string };
      if (result.success) alert(result.message || 'Test print sent!');
      else alert(result.error || 'Test print failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Test print failed');
    }
  };

  const handleCreateUser = async () => {
    setUserError(null);
    if (!newUserName.trim()) { setUserError('Name is required'); return; }
    if (newUserPin.length < 4) { setUserError('PIN must be at least 4 digits'); return; }
    try {
      await api.users.create({ name: newUserName.trim(), pin: newUserPin, role: newUserRole });
      setNewUserName('');
      setNewUserPin('');
      setNewUserRole('cashier');
      setIsUserDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  if (loading) return <div className="p-6"><p className="text-muted-foreground">Loading settings...</p></div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your shop settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reset}>Reset Defaults</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : saved ? <><Check className="h-4 w-4 mr-2" /> Saved</> : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Shop Information</CardTitle><CardDescription>Update your shop details</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2"><Label>Shop Name</Label><Input value={settings.shopName} onChange={(e) => update('shopName', e.target.value)} /></div>
            <div className="grid gap-2"><Label>Phone Number</Label><Input value={settings.phone} onChange={(e) => update('phone', e.target.value)} /></div>
            <div className="grid gap-2"><Label>Address</Label><Input value={settings.address} onChange={(e) => update('address', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />User Profile</CardTitle><CardDescription>Manage your account</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2"><Label>Shop Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => update('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">GHS - Ghanaian Cedi</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                  <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Low Stock Threshold</Label><Input type="number" value={settings.lowStockThreshold} onChange={(e) => update('lowStockThreshold', Number(e.target.value))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Payment Settings</CardTitle><CardDescription>Configure payment methods</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Cash Payments</Label><p className="text-sm text-muted-foreground">Accept cash payments</p></div><Switch checked={settings.cashEnabled} onCheckedChange={(v) => update('cashEnabled', v)} /></div>
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>MTN Mobile Money</Label><p className="text-sm text-muted-foreground">Accept MoMo payments</p></div><Switch checked={settings.momoEnabled} onCheckedChange={(v) => update('momoEnabled', v)} /></div>
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Card Payments</Label><p className="text-sm text-muted-foreground">Accept card payments</p></div><Switch checked={settings.cardEnabled} onCheckedChange={(v) => update('cardEnabled', v)} /></div>
            <div className="grid gap-2"><Label>MoMo Number</Label><Input value={settings.momoNumber} onChange={(e) => update('momoNumber', e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</CardTitle><CardDescription>Configure alert preferences</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Low Stock Alerts</Label><p className="text-sm text-muted-foreground">Get notified when stock is low</p></div><Switch checked={settings.lowStockAlerts} onCheckedChange={(v) => update('lowStockAlerts', v)} /></div>
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Daily Sales Summary</Label><p className="text-sm text-muted-foreground">Receive daily sales report</p></div><Switch checked={settings.dailySalesSummary} onCheckedChange={(v) => update('dailySalesSummary', v)} /></div>
            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>SMS Receipts</Label><p className="text-sm text-muted-foreground">Send receipts via SMS</p></div><Switch checked={settings.smsReceipts} onCheckedChange={(v) => update('smsReceipts', v)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />Printer Settings</CardTitle><CardDescription>Configure receipt printer</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2"><Label>Printer Type</Label>
              <Select value={settings.printerType} onValueChange={(v) => update('printerType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Printer</SelectItem>
                  <SelectItem value="thermal">Thermal Printer</SelectItem>
                  <SelectItem value="pdf">PDF (Save to File)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Paper Size</Label>
              <Select value={settings.printerPaperSize} onValueChange={(v) => update('printerPaperSize', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80">80mm</SelectItem>
                  <SelectItem value="58">58mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleTestPrint}><Printer className="h-4 w-4 mr-2" />Test Print</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User Management</CardTitle>
            <CardDescription>Manage cashiers and admins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => setIsUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add User
            </Button>
            {usersLoading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">Created {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Receipt Settings</CardTitle><CardDescription>Customize your receipt appearance</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid gap-2"><Label>Receipt Header</Label><Input value={settings.receiptHeader} onChange={(e) => update('receiptHeader', e.target.value)} /></div>
                <div className="grid gap-2"><Label>Receipt Footer</Label><Input value={settings.receiptFooter} onChange={(e) => update('receiptFooter', e.target.value)} /></div>
                <div className="grid gap-2"><Label>Additional Note</Label><Input value={settings.receiptNote} onChange={(e) => update('receiptNote', e.target.value)} /></div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-4">Receipt Preview</h4>
                <div className="bg-white p-4 rounded border text-sm space-y-2">
                  <div className="text-center font-bold text-lg">{settings.receiptHeader}</div>
                  <div className="text-center text-muted-foreground">{settings.phone}</div>
                  <div className="text-center text-muted-foreground">{settings.address}</div>
                  <div className="border-t my-2" />
                  <div className="text-center text-muted-foreground">{new Date().toLocaleDateString()}</div>
                  <div className="border-t my-2" />
                  <div className="flex justify-between"><span>Milk x2</span><span>{settings.currency} 50.00</span></div>
                  <div className="flex justify-between"><span>Bread x1</span><span>{settings.currency} 18.00</span></div>
                  <div className="border-t my-2" />
                  <div className="flex justify-between font-bold"><span>Total</span><span>{settings.currency} 68.00</span></div>
                  <div className="text-center text-muted-foreground">Cash</div>
                  <div className="border-t my-2" />
                  <div className="text-center text-muted-foreground">{settings.receiptFooter}</div>
                  <div className="text-center text-xs text-muted-foreground">{settings.receiptNote}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle><DialogDescription>Create a new cashier or admin account.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            {userError && <p className="text-sm text-red-500">{userError}</p>}
            <div className="grid gap-2"><Label>Name</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Enter name" /></div>
            <div className="grid gap-2"><Label>PIN (4-6 digits)</Label><Input type="password" value={newUserPin} onChange={(e) => setNewUserPin(e.target.value)} placeholder="****" maxLength={6} /></div>
            <div className="grid gap-2"><Label>Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsUserDialogOpen(false); setUserError(null); }}>Cancel</Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
