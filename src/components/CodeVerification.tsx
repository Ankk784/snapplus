import { useState, useRef } from "react";

interface CodeVerificationProps {
  onSubmit: (code: string) => void | Promise<void>;
  error?: string;
}

const CodeVerification = ({ onSubmit, error }: CodeVerificationProps) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submittingRef.current) return;
    if (code.length !== 4) return;
    submittingRef.current = true;
    setIsLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div className="text-center mb-6">
        <p className="text-foreground font-medium">
          Un code de vérification a été envoyé par SMS
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Le code peut prendre jusqu'à 3 minutes pour <span className="gold-text">arriver</span>
        </p>
      </div>

      <input
        type="text"
        maxLength={4}
        placeholder="0000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="gold-input w-full text-center text-xl tracking-[0.5em] font-mono"
      />

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <button type="submit" className="gold-button w-full mt-4" disabled={isLoading}>
        {isLoading ? "Chargement..." : "Vérifier"}
      </button>
    </form>
  );
};

export default CodeVerification;
