import { CheckCircle } from "lucide-react";

const TikTokSuccess = () => (
  <div className="w-full max-w-md text-center space-y-4">
    <div className="flex justify-center">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
    </div>
    <h2 className="text-xl font-semibold bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">
      Vérification réussie !
    </h2>
    <p className="text-gray-400">Vos abonnés TikTok seront ajoutés sous peu.</p>
  </div>
);

export default TikTokSuccess;
