import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Label } from '@pos/shared/components/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pos/shared/components/card';
import { Store, Loader2, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const { login, signup, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (isSignup) {
        const result = await signup(email, password, name);
        if (result === '__confirm_email__') {
          setSuccessMsg('Account created! Check your email to confirm, then sign in.');
          setIsSignup(false);
          setPassword('');
        } else if (result) {
          setError(result);
        }
      } else {
        const result = await login(email, password);
        if (result) {
          setError(result);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setSuccessMsg('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/90 via-primary/75 to-primary/60">
      <Card className="w-full max-w-md shadow-2xl border-white/20 bg-background/95 backdrop-blur-md">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary shadow-inner">
            <Store className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold">POS System</CardTitle>
          <CardDescription>
            {isSignup ? 'Create an account to get started' : 'Sign in to access your dashboard'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name *</Label>
                <Input
                  id="full-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email-address">Email Address *</Label>
              <Input
                id="email-address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoFocus={!isSignup}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive text-center bg-destructive/10 p-2 rounded-md border border-destructive/20">
                {error}
              </p>
            )}

            {successMsg && (
              <p className="text-sm font-medium text-green-600 text-center bg-green-50 dark:bg-green-950/40 p-2 rounded-md border border-green-200">
                {successMsg}
              </p>
            )}

            <Button
              type="submit"
              disabled={!email || !password || (isSignup && !name) || submitting}
              className="w-full h-11 text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Please wait...
                </>
              ) : isSignup ? (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground mt-6 pt-4 border-t">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={toggleMode}
              type="button"
              className="text-primary font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
