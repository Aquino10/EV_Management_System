import React, { useEffect } from 'react';
import type { ScreenType } from '../components/Navbar';

interface SplashScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onNavigate }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onNavigate('login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <video
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        onEnded={() => onNavigate('login')}
      >
        <source src="/ZeroStatic_splash_v2.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
