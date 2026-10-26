import React from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import type { ScreenType } from '../components/Navbar';

interface LandingPageProps {
  onNavigate: (screen: ScreenType) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background text "ZeroStatic" */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1 className="text-[15vw] md:text-[12vw] font-bold text-white/5 tracking-wider select-none">
          ZeroStatic
        </h1>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4 space-y-8 text-center">
        {/* Hero Image */}
        <div
          className="relative group cursor-pointer transition-transform duration-300 hover:scale-105"
          onClick={() => onNavigate('driver')}
        >
          <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
          <img
            src="/hero-station.jpg"
            alt="Charging Station"
            className="relative w-[85vw] md:w-[600px] h-[50vh] md:h-[400px] object-cover rounded-2xl shadow-2xl border border-white/10"
          />
          <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-2 text-white font-semibold">
              <span>Enter</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Punchline */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
            Power Your Journey, Smartly
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-md">
            Where innovation meets sustainable mobility. Experience the future of EV charging.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onNavigate('driver')}
          className="inline-flex items-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-full transition-all duration-300 shadow-lg hover:shadow-teal-500/25"
        >
          <Zap className="w-5 h-5" />
          <span>Start Charging</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 text-gray-500 text-xs">
        Click the image or button to enter
      </div>
    </div>
  );
};
