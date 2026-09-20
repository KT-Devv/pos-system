"use client";

import { FormEvent, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  ROLE_LABELS,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@pos/shared";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { type ThemeChoice, useTheme } from "@/components/theme";
import { useWorkspace } from "@/lib/workspace";
import { Field, type Feedback, fail } from "./common";
import { ShopSettings } from "./shop-settings";
import { Team } from "./team";

function Account({ onError, onNotice }: Feedback) {
  const { supabase, user, shop, role, signOut } = useWorkspace();
  const [name, setName] = useState(user.name);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { theme, setTheme } = useTheme();

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { onError("Name is required."); return; }
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    if (error) fail(onError, error);
    else onNotice("Profile updated.");
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) { onError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { onError("Passwords do not match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) fail(onError, error);
    else {
      setNewPassword("");
      setConfirmPassword("");
      onNotice("Account password updated successfully.");
    }
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{user.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
              <span className="text-xs text-muted-foreground">at {shop.name}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 border-t pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Display name" htmlFor="profile-name" hint={user.email ? `Signed in as ${user.email}` : undefined}>
              <Input id="profile-name" required value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the workspace looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <SegmentedControl<ThemeChoice>
            aria-label="Theme"
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: "system", label: "System", icon: <Monitor /> },
              { value: "light", label: "Light", icon: <Sun /> },
              { value: "dark", label: "Dark", icon: <Moon /> },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Use at least 6 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updatePassword} className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="new-password">
              <Input id="new-password" required type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input id="confirm-password" required type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="justify-self-start sm:col-span-2">Update password</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">Sign out</p>
            <p className="text-sm text-muted-foreground">End your session on this device.</p>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function Settings({ onError, onNotice }: Feedback) {
  const { isAdmin } = useWorkspace();
  const [tab, setTab] = useState("account");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description={isAdmin ? "Your account, your shop, and your team." : "Your profile, password, and appearance."}
      />

      {isAdmin ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="shop">Shop</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>
          <TabsContent value="account"><Account onError={onError} onNotice={onNotice} /></TabsContent>
          <TabsContent value="shop"><div className="max-w-3xl"><ShopSettings onError={onError} onNotice={onNotice} /></div></TabsContent>
          <TabsContent value="team"><div className="max-w-3xl"><Team onError={onError} onNotice={onNotice} /></div></TabsContent>
        </Tabs>
      ) : (
        <Account onError={onError} onNotice={onNotice} />
      )}
    </div>
  );
}
