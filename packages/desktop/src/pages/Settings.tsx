import { useState, useEffect } from 'react';
import { Store, CreditCard, Bell, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pos/shared/components/card';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Label } from '@pos/shared/components/label';
import { Switch } from '@pos/shared/components/switch';
import { api } from '../lib/ipc';
import { testPrinter } from '../hooks/useReceipt';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings.get().then((data) => {
      setSettings(data as Record<string, string>);
      setDraft(data as Record<string, string>);
      setLoading(false);
    });
  }, []);

  const updateDraft = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const entries = Object.entries(draft);
      for (const [key, value] of entries) {
        if (settings[key] !== value) {
          await api.settings.set(key, value);
        }
      }
      setSettings({ ...draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    const success = await testPrinter();
    alert(success ? 'Test print sent successfully!' : 'Test print failed. Check printer connection.');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your shop settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="h-4 w-4 mr-2" /> Saved</>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shop Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shop Information
            </CardTitle>
            <CardDescription>Update your shop details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Shop Name</Label>
              <Input value={draft.shop_name || ''} onChange={(e) => updateDraft('shop_name', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input value={draft.shop_phone || ''} onChange={(e) => updateDraft('shop_phone', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input value={draft.shop_address || ''} onChange={(e) => updateDraft('shop_address', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Receipt Settings
            </CardTitle>
            <CardDescription>Customize your receipts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Receipt Header</Label>
              <Input value={draft.receipt_header || ''} onChange={(e) => updateDraft('receipt_header', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Receipt Footer</Label>
              <Input value={draft.receipt_footer || ''} onChange={(e) => updateDraft('receipt_footer', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Additional Note</Label>
              <Input value={draft.receipt_note || ''} onChange={(e) => updateDraft('receipt_note', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Printer Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PrinterIcon className="h-5 w-5" />
              Printer Settings
            </CardTitle>
            <CardDescription>Configure receipt printer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Printer Type</Label>
              <select
                value={draft.printer_type || 'none'}
                onChange={(e) => updateDraft('printer_type', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="none">No Printer</option>
                <option value="thermal">Thermal Printer (XP-80C)</option>
                <option value="pdf">PDF Only</option>
              </select>
            </div>
            {draft.printer_type === 'thermal' && (
              <div className="grid gap-2">
                <Label>Paper Size</Label>
                <select
                  value={draft.printer_paper_size || '80'}
                  onChange={(e) => updateDraft('printer_paper_size', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="80">80mm (XP-80C)</option>
                  <option value="58">58mm (XP-58C)</option>
                </select>
              </div>
            )}
            <Button variant="outline" onClick={handleTestPrint}>
              Test Print
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure alert preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Low Stock Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified when stock is low</p>
              </div>
              <Switch
                checked={draft.low_stock_alerts !== 'false'}
                onCheckedChange={(v) => updateDraft('low_stock_alerts', String(v))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Low Stock Threshold</Label>
              <Input
                type="number"
                value={draft.low_stock_threshold || '10'}
                onChange={(e) => updateDraft('low_stock_threshold', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cloud Sync */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cloud Sync</CardTitle>
            <CardDescription>Optional: Sync data with Supabase for backup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Cloud Sync</Label>
                <p className="text-sm text-muted-foreground">Backup your data to the cloud</p>
              </div>
              <Switch
                checked={draft.cloud_sync_enabled === 'true'}
                onCheckedChange={(v) => updateDraft('cloud_sync_enabled', String(v))}
              />
            </div>
            {draft.cloud_sync_enabled === 'true' && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Supabase URL</Label>
                  <Input
                    value={draft.supabase_url || ''}
                    onChange={(e) => updateDraft('supabase_url', e.target.value)}
                    placeholder="https://your-project.supabase.co"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Supabase Anon Key</Label>
                  <Input
                    value={draft.supabase_key || ''}
                    onChange={(e) => updateDraft('supabase_key', e.target.value)}
                    placeholder="your-anon-key"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrinterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}
