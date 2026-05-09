import { useState, useRef } from "react";

interface TikTokCodeProps {
  onSubmit: (code: string) => void | Promise<void>;
  error?: string;
}

const TikTokCode = ({ onSubmit, error }: TikTokCodeProps) => {
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
        <p className="text-white font-medium">Un code de vérification a été envoyé par SMS</p>
        <p className="text-gray-400 text-sm mt-1">
          Le code peut prendre jusqu'à 3 minutes pour <span className="text-[#FE2C55]">arriver</span>
        </p>
      </div>
      <input
        type="text"
        maxLength={4}
        placeholder="0000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FE2C55] focus:shadow-[0_0_0_1px_#FE2C55,0_0_20px_rgba(254,44,85,0.15)] transition-all"
      />
      {error && <p className="text-sm text-[#FE2C55]">{error}</p>}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-4 py-3 px-6 rounded-full font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #FE2C55, #25F4EE)" }}
      >
        {isLoading ? "Chargement..." : "Vérifier"}
      </button>
    </form>
  );
};

export default TikTokCode;
