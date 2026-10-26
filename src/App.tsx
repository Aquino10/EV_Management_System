import { useState } from 'react';
import { useLenis } from './components/SmoothScroll';
import { useFacility } from './services/useFacility';
import { Navbar, type ScreenType } from './components/Navbar';
import { MobileTabBar } from './components/MobileTabBar';
import { AuthModal } from './pages/AuthModal';
import { DriverDashboard } from './pages/DriverDashboard';
import { QueueScreen } from './pages/QueueScreen';
import { LoginPage } from './pages/LoginPage';
import { ProfileScreen } from './pages/ProfileScreen';
import { LiveUpdatesScreen } from './pages/LiveUpdatesScreen';
import { AdminDashboard } from './pages/AdminDashboard';
import { useAuth } from './services/useAuth';

export function App() {
  useLenis();

  const auth = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('driver');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const {
    state,
    addEV,
    departBay,
    removeEV,
    updateConfig,
    isLoading: isFacilityLoading,
    error: facilityError,
    clearError: clearFacilityError,
  } = useFacility(auth.profile?.id);

  const queuedCount = state.evs.filter((e) => e.bayId === null && e.energyNeededKwh > 0).length;

  if (!auth.ready && auth.configured) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Checking your session...
      </div>
    );
  }

  if (!auth.profile) {
    if (auth.session) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4 px-4 text-center text-white">
          <p role="alert" className="max-w-lg text-red-200">
            {auth.error ?? 'Your account profile is not available. Apply the Supabase database migration and try again.'}
          </p>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="rounded-lg bg-teal-600 px-4 py-2 font-medium hover:bg-teal-700"
          >
            Sign out
          </button>
        </div>
      );
    }

    return (
      <LoginPage
        configured={auth.configured}
        isSubmitting={false}
        error={auth.error}
        notice={null}
        onSignIn={async (email, password) => {
          const result = await auth.signIn(email, password);
          return result.error;
        }}
        onSignUp={async (name, email, password) => {
          return auth.signUp(name, email, password);
        }}
      />
    );
  }

  const currentUser = auth.profile;

  if (isFacilityLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading shared facility data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans selection:bg-teal-700/10 selection:text-teal-900">
      {/* Top Header - Hide on login and splash */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        state={state}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {facilityError && (
          <div role="alert" className="max-w-4xl mx-auto mt-4 px-4 w-full">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span>{facilityError}</span>
              <button type="button" onClick={clearFacilityError} className="font-semibold hover:underline">
                Dismiss
              </button>
            </div>
          </div>
        )}
        {currentScreen === 'driver' && (
          <DriverDashboard
            state={state}
            currentUser={currentUser}
            onAddEV={addEV}
            onDepartBay={departBay}
            onNavigate={setCurrentScreen}
          />
        )}
        {currentScreen === 'queue' && (
          <QueueScreen
            state={state}
            currentUser={currentUser}
            onNavigate={setCurrentScreen}
          />
        )}
        {currentScreen === 'profile' && (
          <ProfileScreen state={state} currentUser={currentUser} />
        )}
        {currentScreen === 'live-updates' && (
          <LiveUpdatesScreen state={state} currentUser={currentUser} />
        )}
        {currentScreen === 'admin' && currentUser.role === 'admin' && (
          <AdminDashboard
            state={state}
            currentUser={currentUser}
            onUpdatePower={(powerKw) => updateConfig({ totalPowerKw: powerKw })}
            onRemoveEV={removeEV}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Navigation - Hide on login and splash */}
      <MobileTabBar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        queuedCount={queuedCount}
        currentUser={currentUser}
      />

      {/* Account Profile Switcher */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onSignOut={auth.signOut}
      />
    </div>
  );
}

export default App;
