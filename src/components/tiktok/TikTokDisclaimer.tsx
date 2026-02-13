import { AlertTriangle } from "lucide-react";

const TikTokDisclaimer = () => {
  return (
    <div className="flex items-start gap-3 max-w-md border border-[#FE2C55]/30 rounded-xl px-4 py-3 bg-gradient-to-br from-[#FE2C55]/10 to-[#25F4EE]/5">
      <AlertTriangle className="w-5 h-5 text-[#FE2C55] flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-300 leading-relaxed">
        Disclaimer : Les abonnés TikTok sont offerts gratuitement. Une vérification est nécessaire pour confirmer votre identité.
      </p>
    </div>
  );
};

export default TikTokDisclaimer;
