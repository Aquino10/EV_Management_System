import React, { useState } from 'react';
import { ShieldCheck, User, X } from 'lucide-react';
import type { UserProfile } from '../services/dataService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSignOut: () => Promise<{ error: string | null }>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignOut,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const result = await onSignOut();
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-lg p-6 shadow-lg text-gray-900">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account dialog"
          className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-xs font-mono mb-2 border border-teal-200">
            {currentUser.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            Account
          </div>
          <h2 className="text-lg font-bold tracking-tight">Your account</h2>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-1">
          <p className="text-sm font-semibold">{currentUser.name}</p>
          {currentUser.email && <p className="text-xs text-gray-600">{currentUser.email}</p>}
          <p className="text-xs text-gray-500 capitalize">Role: {currentUser.role}</p>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={isSigningOut}
          className="w-full mt-5 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white font-medium text-sm rounded-md"
        >
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  );
};
