import snapLogo from "@/assets/snap-logo.jpg";

const SnapLogo = () => {
  return (
    <div className="flex items-center gap-3">
      <img 
        src={snapLogo} 
        alt="Snap+" 
        className="w-20 h-20 object-cover"
        style={{ 
          background: 'transparent',
          mixBlendMode: 'lighten'
        }}
      />
      <span className="text-2xl font-bold gold-text">Snap+</span>
    </div>
  );
};

export default SnapLogo;
