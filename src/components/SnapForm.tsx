import { useState } from "react";
import { Ghost } from "lucide-react";

const SnapForm = () => {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", { username, phone });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <h2 className="text-center text-lg font-medium text-foreground mb-6">
        Active Snap+ gratuitement pendant 1 an !
      </h2>

      <div className="relative">
        <Ghost className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Nom d'utilisateur Snapchat"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="gold-input w-full pl-12"
        />
      </div>

      <div className="flex gold-input p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-r border-border">
          <span className="text-lg">🇫🇷</span>
          <span className="text-muted-foreground font-medium">+33</span>
        </div>
        <input
          type="tel"
          placeholder="Numéro de téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <button type="submit" className="gold-button w-full mt-6">
        Continuer
      </button>
    </form>
  );
};

export default SnapForm;
