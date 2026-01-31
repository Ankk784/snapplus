import { AlertTriangle } from "lucide-react";

const DisclaimerBox = () => {
  return (
    <div className="disclaimer-box flex items-start gap-3 max-w-md">
      <AlertTriangle className="w-5 h-5 gold-text flex-shrink-0 mt-0.5" />
      <p className="text-sm gold-text leading-relaxed">
        Disclaimer: L'abonnement Snapchat+ ne vous sera pas facturé. L'abonnement est disponible uniquement pour les utilisateurs éligibles.
      </p>
    </div>
  );
};

export default DisclaimerBox;
