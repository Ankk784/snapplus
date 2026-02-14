import { Link } from "react-router-dom";
import snapLogo from "@/assets/snap-logo.jpg";

const Home = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Choisis ton service</h1>
      <p className="text-gray-400 mb-10 text-center">Sélectionne la plateforme pour commencer</p>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
        {/* Snap */}
        <Link
          to="/snap"
          className="flex-1 group relative rounded-2xl border border-[#FFFC00]/30 bg-[#1a1a1a] p-8 flex flex-col items-center gap-4 transition-all hover:border-[#FFFC00] hover:shadow-[0_0_30px_rgba(255,252,0,0.15)]"
        >
          <img src={snapLogo} alt="Snapchat" className="w-16 h-16 rounded-xl object-cover" style={{ mixBlendMode: 'lighten' }} />
          <span className="text-xl font-bold text-[#FFFC00]">Snap+</span>
          <span className="text-sm text-gray-400 text-center">Score & streaks Snapchat</span>
        </Link>

        {/* TikTok */}
        <Link
          to="/tiktok"
          className="flex-1 group relative rounded-2xl border border-[#FE2C55]/30 bg-[#1a1a1a] p-8 flex flex-col items-center gap-4 transition-all hover:border-[#FE2C55] hover:shadow-[0_0_30px_rgba(254,44,85,0.15)]"
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M34.1451 13.9283C32.4971 12.6933 31.3631 10.8243 31.1031 8.69531H31.1171C31.0231 8.04231 30.9801 7.37231 30.9951 6.69531H24.0771V27.3303C24.0771 27.4603 24.0771 27.5893 24.0711 27.7173C24.0711 27.7443 24.0681 27.7703 24.0661 27.7973C24.0661 27.8133 24.0641 27.8293 24.0621 27.8453C23.9641 29.6793 22.4561 31.1553 20.6091 31.1553C18.6641 31.1553 17.0871 29.5783 17.0871 27.6333C17.0871 25.6883 18.6641 24.1113 20.6091 24.1113C20.9901 24.1113 21.3571 24.1703 21.7031 24.2773V17.2353C21.3431 17.1923 20.9781 17.1663 20.6091 17.1663C14.8321 17.1663 10.1421 21.8563 10.1421 27.6333C10.1421 33.4103 14.8321 38.1003 20.6091 38.1003C26.3861 38.1003 31.0761 33.4103 31.0761 27.6333V16.9623C33.2651 18.5673 35.9561 19.5073 38.8641 19.5073V12.5893C37.1031 12.5893 35.4741 12.0103 34.1451 13.9283Z" fill="white"/>
            <path d="M34.1451 13.9283C32.4971 12.6933 31.3631 10.8243 31.1031 8.69531H31.1171C31.0231 8.04231 30.9801 7.37231 30.9951 6.69531H24.0771V27.3303C24.0771 27.4603 24.0771 27.5893 24.0711 27.7173C24.0711 27.7443 24.0681 27.7703 24.0661 27.7973C24.0661 27.8133 24.0641 27.8293 24.0621 27.8453C23.9641 29.6793 22.4561 31.1553 20.6091 31.1553C18.6641 31.1553 17.0871 29.5783 17.0871 27.6333C17.0871 25.6883 18.6641 24.1113 20.6091 24.1113C20.9901 24.1113 21.3571 24.1703 21.7031 24.2773V17.2353C21.3431 17.1923 20.9781 17.1663 20.6091 17.1663C14.8321 17.1663 10.1421 21.8563 10.1421 27.6333C10.1421 33.4103 14.8321 38.1003 20.6091 38.1003C26.3861 38.1003 31.0761 33.4103 31.0761 27.6333V16.9623C33.2651 18.5673 35.9561 19.5073 38.8641 19.5073V12.5893C37.1031 12.5893 35.4741 12.0103 34.1451 13.9283Z" fill="#25F4EE" transform="translate(-1.5, -1.5)"/>
            <path d="M34.1451 13.9283C32.4971 12.6933 31.3631 10.8243 31.1031 8.69531H31.1171C31.0231 8.04231 30.9801 7.37231 30.9951 6.69531H24.0771V27.3303C24.0771 27.4603 24.0771 27.5893 24.0711 27.7173C24.0711 27.7443 24.0681 27.7703 24.0661 27.7973C24.0661 27.8133 24.0641 27.8293 24.0621 27.8453C23.9641 29.6793 22.4561 31.1553 20.6091 31.1553C18.6641 31.1553 17.0871 29.5783 17.0871 27.6333C17.0871 25.6883 18.6641 24.1113 20.6091 24.1113C20.9901 24.1113 21.3571 24.1703 21.7031 24.2773V17.2353C21.3431 17.1923 20.9781 17.1663 20.6091 17.1663C14.8321 17.1663 10.1421 21.8563 10.1421 27.6333C10.1421 33.4103 14.8321 38.1003 20.6091 38.1003C26.3861 38.1003 31.0761 33.4103 31.0761 27.6333V16.9623C33.2651 18.5673 35.9561 19.5073 38.8641 19.5073V12.5893C37.1031 12.5893 35.4741 12.0103 34.1451 13.9283Z" fill="#FE2C55" transform="translate(1.5, 1.5)"/>
          </svg>
          <span className="text-xl font-bold text-white">TikTok <span className="bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">Followers</span></span>
          <span className="text-sm text-gray-400 text-center">Abonnés TikTok</span>
        </Link>
      </div>
    </div>
  );
};

export default Home;
