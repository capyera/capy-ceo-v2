import { Menu, X } from 'lucide-react';

interface MobileNavProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileMenuButton({ isOpen, onToggle }: MobileNavProps) {
  return (
    <button
      onClick={onToggle}
      className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-slate-700" />
      ) : (
        <Menu className="w-6 h-6 text-slate-700" />
      )}
    </button>
  );
}

export function MobileOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="md:hidden fixed inset-0 bg-black/50 z-30"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
