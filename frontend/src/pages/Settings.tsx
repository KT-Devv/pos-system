import { User, Store, CreditCard, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
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
              <Input id="shopName" defaultValue="Mom's Shop" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" defaultValue="+233 24 123 4567" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" defaultValue="Accra, Ghana" />
            </div>
            <Button>Save Changes</Button>
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
              <Input id="name" defaultValue="Admin User" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="admin@shop.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" placeholder="Leave blank to keep current" />
            </div>
            <Button>Update Profile</Button>
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
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>MTN Mobile Money</Label>
                <p className="text-sm text-muted-foreground">Accept MoMo payments</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Card Payments</Label>
                <p className="text-sm text-muted-foreground">Accept card payments</p>
              </div>
              <Switch />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="momoNumber">MoMo Number</Label>
              <Input id="momoNumber" defaultValue="+233 24 123 4567" />
            </div>
            <Button>Save Payment Settings</Button>
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
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Sales Summary</Label>
                <p className="text-sm text-muted-foreground">Receive daily sales report</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Receipts</Label>
                <p className="text-sm text-muted-foreground">Send receipts via SMS</p>
              </div>
              <Switch />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input id="lowStockThreshold" type="number" defaultValue="10" />
            </div>
            <Button>Save Notification Settings</Button>
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
                  <Input id="receiptHeader" defaultValue="Mom's Shop" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receiptFooter">Receipt Footer</Label>
                  <Input id="receiptFooter" defaultValue="Thank you for your purchase!" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receiptNote">Additional Note</Label>
                  <Input id="receiptNote" defaultValue="Exchange within 7 days with receipt" />
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-4">Receipt Preview</h4>
                <div className="bg-white p-4 rounded border text-sm space-y-2">
                  <div className="text-center font-bold text-lg">Mom's Shop</div>
                  <div className="text-center text-muted-foreground">+233 24 123 4567</div>
                  <div className="text-center text-muted-foreground">Accra, Ghana</div>
                  <div className="border-t my-2" />
                  <div className="text-center text-muted-foreground">15/01/2024 10:30 AM</div>
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
                  <div className="text-center text-muted-foreground">Thank you for your purchase!</div>
                  <div className="text-center text-xs text-muted-foreground">Exchange within 7 days with receipt</div>
                </div>
              </div>
            </div>
            <Button className="mt-4">Save Receipt Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
