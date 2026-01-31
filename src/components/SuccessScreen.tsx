import { CheckCircle } from "lucide-react";

const SuccessScreen = () => {
  return (
    <div className="w-full max-w-md text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
      </div>
      <h2 className="text-xl font-semibold gold-text">
        Vérification réussie !
      </h2>
      <p className="text-muted-foreground">
        Vous allez recevoir votre abonnement Snap+ sous peu.
      </p>
    </div>
  );
};

export default SuccessScreen;
