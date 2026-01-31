import { Hourglass } from "lucide-react";

const WaitingValidation = () => {
  return (
    <div className="w-full max-w-md text-center space-y-4">
      <div className="flex justify-center">
        <Hourglass className="w-16 h-16 gold-text animate-pulse" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        En attente de validation
      </h2>
      <p className="text-muted-foreground">
        Un modérateur vérifie votre code.
      </p>
    </div>
  );
};

export default WaitingValidation;
