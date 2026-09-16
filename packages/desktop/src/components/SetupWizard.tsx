import { useState } from 'react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Label } from '@pos/shared/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pos/shared/components/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { api } from '../lib/ipc';
import { Store, User, CreditCard, Cloud, Check, Loader2 } from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'shop' | 'admin' | 'printer' | 'cloud' | 'complete';

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [shopName, setShopName] = useState("Mom's Shop");
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [printerType, setPrinterType] = useState('none');
  const [paperSize, setPaperSize] = useState('80');
  const [cloudSync, setCloudSync] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (adminName.trim().length === 0) {
        alert('Please enter the admin name.');
        return;
      }
      if (adminPin.length < 4 || adminPin.length > 6) {
        alert('PIN must be 4 to 6 digits.');
        setStep('admin');
        return;
      }
      await api.settings.setup({
        shop_name: shopName,
        shop_phone: shopPhone,
        shop_address: shopAddress,
        currency,
        admin_name: adminName,
        admin_pin: adminPin,
        printer_type: printerType,
        printer_paper_size: paperSize,
      });
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {step === 'welcome' && <Store className="h-12 w-12 text-primary" />}
            {step === 'shop' && <Store className="h-12 w-12 text-primary" />}
            {step === 'admin' && <User className="h-12 w-12 text-primary" />}
            {step === 'printer' && <CreditCard className="h-12 w-12 text-primary" />}
            {step === 'cloud' && <Cloud className="h-12 w-12 text-primary" />}
            {step === 'complete' && <Check className="h-12 w-12 text-green-500" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === 'welcome' && 'Welcome to POS System'}
            {step === 'shop' && 'Shop Information'}
            {step === 'admin' && 'Admin Account'}
            {step === 'printer' && 'Receipt Printer'}
            {step === 'cloud' && 'Cloud Sync'}
            {step === 'complete' && 'Setup Complete!'}
          </CardTitle>
          <CardDescription>
            {step === 'welcome' && "Let's set up your shop in a few quick steps."}
            {step === 'shop' && 'Tell us about your shop.'}
            {step === 'admin' && 'Create your admin account.'}
            {step === 'printer' && 'Configure your receipt printer.'}
            {step === 'cloud' && 'Optional: Enable cloud backup.'}
            {step === 'complete' && 'Your POS system is ready to use!'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'welcome' && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                This wizard will help you configure your point of sale system.
                You can change these settings later in Settings.
              </p>
              <Button className="w-full" onClick={() => setStep('shop')}>
                Get Started
              </Button>
            </div>
          )}

          {step === 'shop' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="shopName">Shop Name *</Label>
                <Input id="shopName" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Mom's Shop" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shopPhone">Phone Number</Label>
                <Input id="shopPhone" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="+233 24 123 4567" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shopAddress">Address</Label>
                <Input id="shopAddress" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} placeholder="Accra, Ghana" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">Ghana Cedi (GHS)</SelectItem>
                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    <SelectItem value="NGN">Nigerian Naira (NGN)</SelectItem>
                    <SelectItem value="KES">Kenyan Shilling (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => setStep('admin')} disabled={!shopName.trim()}>
                Next
              </Button>
            </div>
          )}

          {step === 'admin' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="adminName">Your Name *</Label>
                <Input id="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Enter your name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminPin">PIN Code (4-6 digits) *</Label>
                <Input id="adminPin" type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" maxLength={6} />
              </div>
              <Button className="w-full" onClick={() => setStep('printer')} disabled={!adminName.trim() || adminPin.length < 4}>
                Next
              </Button>
            </div>
          )}

          {step === 'printer' && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Receipt Printer</Label>
                <div className="space-y-2">
                  {[
                    { value: 'thermal', label: 'Thermal Printer (XP-80C / XP-58C)' },
                    { value: 'pdf', label: 'PDF Only (Save to file)' },
                    { value: 'none', label: 'No Printer' },
                  ].map((option) => (
                    <div
                      key={option.value}
                      onClick={() => setPrinterType(option.value)}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        printerType === option.value
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="printer"
                        value={option.value}
                        checked={printerType === option.value}
                        onChange={() => setPrinterType(option.value)}
                        className="accent-primary"
                      />
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {printerType === 'thermal' && (
                <div className="grid gap-2">
                  <Label>Paper Size</Label>
                  <Select value={paperSize} onValueChange={setPaperSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80">80mm (XP-80C)</SelectItem>
                      <SelectItem value="58">58mm (XP-58C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" onClick={() => setStep('cloud')}>
                Next
              </Button>
            </div>
          )}

          {step === 'cloud' && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Enable cloud sync to backup your data and access it from multiple devices.
                You can set this up later in Settings.
              </p>
              <div className="space-y-2">
                <div
                  onClick={() => setCloudSync(false)}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    !cloudSync ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="cloud"
                    checked={!cloudSync}
                    onChange={() => setCloudSync(false)}
                    className="accent-primary"
                  />
                  <div>
                    <span className="font-medium block">No, local only</span>
                    <p className="text-xs text-muted-foreground">Data stays on this computer</p>
                  </div>
                </div>
                <div
                  onClick={() => setCloudSync(true)}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    cloudSync ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="cloud"
                    checked={cloudSync}
                    onChange={() => setCloudSync(true)}
                    className="accent-primary"
                  />
                  <div>
                    <span className="font-medium block">Yes, enable cloud sync</span>
                    <p className="text-xs text-muted-foreground">Backup and multi-device access</p>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleComplete} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up...</> : 'Complete Setup'}
              </Button>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Your shop <strong>{shopName}</strong> is all set up!
              </p>
              <p className="text-sm text-muted-foreground">
                You can start adding products and making sales.
              </p>
              <Button className="w-full" onClick={onComplete}>
                Start Using POS System
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
