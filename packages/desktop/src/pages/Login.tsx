import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Label } from '@pos/shared/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pos/shared/components/card';
import { KeyRound, Loader2, LogIn } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(pin);
    if (!success) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/90 via-primary/75 to-primary/60">
      <Card className="w-full max-w-sm shadow-2xl border-white/20 bg-background/95 backdrop-blur-md">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary shadow-inner">
            <KeyRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold">POS System</CardTitle>
          <CardDescription>Enter your Security PIN to sign in</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin-input" className="sr-only">Security PIN</Label>
              <Input
                id="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="h-14 text-center text-3xl tracking-widest font-mono border-input"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive text-center bg-destructive/10 p-2 rounded-md border border-destructive/20">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pin.length < 4 || loading}
              className="w-full h-11 text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
