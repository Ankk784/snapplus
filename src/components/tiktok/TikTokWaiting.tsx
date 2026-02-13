import { Hourglass } from "lucide-react";

const TikTokWaiting = () => (
  <div className="w-full max-w-md text-center space-y-4">
    <div className="flex justify-center">
      <Hourglass className="w-16 h-16 text-[#FE2C55] animate-pulse" />
    </div>
    <h2 className="text-xl font-semibold text-white">En attente de validation</h2>
    <p className="text-gray-400">Un modérateur vérifie votre code.</p>
  </div>
);

export default TikTokWaiting;
