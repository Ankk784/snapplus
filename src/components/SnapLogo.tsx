import snapLogo from "@/assets/snap-logo.jpg";

const SnapLogo = () => {
  return (
    <div className="flex items-center justify-center">
      <img 
        src={snapLogo} 
        alt="Snap+" 
        className="w-24 h-24 rounded-2xl object-cover"
      />
    </div>
  );
};

export default SnapLogo;
