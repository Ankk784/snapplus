import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface TikTokFormProps {
  onSubmit: (data: { username: string; phone: string; plan: string }) => Promise<void> | void;
  externalError?: string;
}

const plans = [
  { value: "1000", label: "1 000 abonnés" },
  { value: "2500", label: "2 500 abonnés" },
  { value: "5000", label: "5 000 abonnés" },
  { value: "10000", label: "10 000 abonnés" },
];

const TikTokForm = ({ onSubmit, externalError }: TikTokFormProps) => {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submittingRef.current) return;
    setError("");

    if (!username.trim()) {
      setError("Veuillez entrer un nom d'utilisateur TikTok");
      return;
    }
    if (!plan) {
      setError("Veuillez sélectionner un nombre d'abonnés");
      return;
    }

    const phoneClean = phone.replace(/\s/g, "");
    if (!/^0[67]\d{8}$/.test(phoneClean)) {
      setError("Le numéro doit commencer par 06 ou 07 et contenir 10 chiffres.");
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    try {
      await onSubmit({ username, phone: phoneClean, plan });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const selectedPlan = plans.find(p => p.value === plan);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <h2 className="text-center text-lg font-medium text-white mb-6">
        Obtiens des abonnés TikTok <span className="text-[#FE2C55]">gratuitement</span> !
      </h2>

      <input
        type="text"
        placeholder="@ Nom d'utilisateur TikTok"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FE2C55] focus:shadow-[0_0_0_1px_#FE2C55,0_0_20px_rgba(254,44,85,0.15)] transition-all"
      />

      {/* Dropdown plan */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 text-left flex items-center justify-between focus:outline-none focus:border-[#FE2C55] focus:shadow-[0_0_0_1px_#FE2C55,0_0_20px_rgba(254,44,85,0.15)] transition-all"
        >
          <span className={selectedPlan ? "text-white" : "text-gray-500"}>
            {selectedPlan ? selectedPlan.label : "Nombre d'abonnés souhaité"}
          </span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden shadow-xl">
            {plans.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPlan(p.value); setDropdownOpen(false); }}
                className={`w-full px-4 py-3 text-left hover:bg-[#FE2C55]/20 transition-colors ${plan === p.value ? "bg-[#FE2C55]/10 text-[#FE2C55]" : "text-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden focus-within:border-[#FE2C55] focus-within:shadow-[0_0_0_1px_#FE2C55,0_0_20px_rgba(254,44,85,0.15)] transition-all">
        <div className="flex items-center gap-2 px-4 border-r border-[#333]">
          <span className="text-lg">🇫🇷</span>
          <span className="text-gray-400 font-medium">+33</span>
        </div>
        <input
          type="tel"
          placeholder="Numéro de téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          maxLength={10}
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      {(error || externalError) && (
        <p className="text-sm text-[#FE2C55]">{error || externalError}</p>
      )}

      <button
        type="submit"
        className="w-full mt-6 py-3 px-6 rounded-full font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #FE2C55, #25F4EE)" }}
        disabled={isLoading}
      >
        {isLoading ? "Chargement..." : "Continuer"}
      </button>
    </form>
  );
};

export default TikTokForm;
