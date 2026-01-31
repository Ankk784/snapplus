import { Ghost } from "lucide-react";

const SnapLogo = () => {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-5 py-3">
      <div className="relative">
        <Ghost className="w-8 h-8 gold-text" strokeWidth={2.5} />
        <span className="absolute -top-1 -right-1 text-xs gold-text font-bold">+</span>
      </div>
      <span className="text-xl font-bold gold-text">Snap+</span>
    </div>
  );
};

export default SnapLogo;
