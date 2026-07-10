import { User, Store, CreditCard, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@pos/shared/components/card";
import { Input } from "@pos/shared/components/input";
import { Label } from "@pos/shared/components/label";
import { Switch } from "@pos/shared/components/switch";
import { useSettings } from "../hooks/useSettings";

export default function Settings() {
  const { settings, update } = useSettings();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your shop settings</p>
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
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                value={settings.shopName}
                onChange={(e) => update("shopName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={settings.fullName}
                onChange={(e) => update("fullName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" placeholder="Leave blank to keep current" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Settings
            </CardTitle>
            <CardDescription>Configure payment methods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Cash Payments</Label>
                <p className="text-sm text-muted-foreground">Accept cash payments</p>
              </div>
              <Switch checked={settings.cashEnabled} onCheckedChange={(v) => update("cashEnabled", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>MTN Mobile Money</Label>
                <p className="text-sm text-muted-foreground">Accept MoMo payments</p>
              </div>
              <Switch checked={settings.momoEnabled} onCheckedChange={(v) => update("momoEnabled", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Card Payments</Label>
                <p className="text-sm text-muted-foreground">Accept card payments</p>
              </div>
              <Switch checked={settings.cardEnabled} onCheckedChange={(v) => update("cardEnabled", v)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="momoNumber">MoMo Number</Label>
              <Input
                id="momoNumber"
                value={settings.momoNumber}
                onChange={(e) => update("momoNumber", e.target.value)}
              />
            </div>
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
              <Switch checked={settings.lowStockAlerts} onCheckedChange={(v) => update("lowStockAlerts", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Sales Summary</Label>
                <p className="text-sm text-muted-foreground">Receive daily sales report</p>
              </div>
              <Switch checked={settings.dailySalesSummary} onCheckedChange={(v) => update("dailySalesSummary", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Receipts</Label>
                <p className="text-sm text-muted-foreground">Send receipts via SMS</p>
              </div>
              <Switch checked={settings.smsReceipts} onCheckedChange={(v) => update("smsReceipts", v)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                value={settings.lowStockThreshold}
                onChange={(e) => update("lowStockThreshold", Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receipt Settings</CardTitle>
            <CardDescription>Customize your receipt appearance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="receiptHeader">Receipt Header</Label>
                  <Input
                    id="receiptHeader"
                    value={settings.receiptHeader}
                    onChange={(e) => update("receiptHeader", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receiptFooter">Receipt Footer</Label>
                  <Input
                    id="receiptFooter"
                    value={settings.receiptFooter}
                    onChange={(e) => update("receiptFooter", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receiptNote">Additional Note</Label>
                  <Input
                    id="receiptNote"
                    value={settings.receiptNote}
                    onChange={(e) => update("receiptNote", e.target.value)}
                  />
                </div>
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
                  <div className="flex justify-between">
                    <span>Milk x2</span>
                    <span>GHS 50.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bread x1</span>
                    <span>GHS 18.00</span>
                  </div>
                  <div className="border-t my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>GHS 68.00</span>
                  </div>
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
    </div>
  );
}
