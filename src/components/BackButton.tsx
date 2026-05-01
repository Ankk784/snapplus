import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  variant?: "snap" | "tiktok";
}

const BackButton = ({ onClick, variant = "snap" }: BackButtonProps) => {
  const styles =
    variant === "tiktok"
      ? "text-gray-300 hover:text-white border-[#333] hover:border-[#FE2C55]"
      : "text-muted-foreground hover:text-foreground border-border hover:border-primary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-transparent text-sm font-medium transition-all hover:-translate-y-0.5 ${styles}`}
    >
      <ArrowLeft className="w-4 h-4" />
      Retour
    </button>
  );
};

export default BackButton;
