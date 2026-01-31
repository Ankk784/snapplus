import snapLogo from "@/assets/snap-logo.jpg";

const SnapLogo = () => {
  return (
    <div className="flex items-center justify-center">
      <img 
        src={snapLogo} 
        alt="Snap+" 
        className="w-28 h-28 object-cover"
        style={{ 
          background: 'transparent',
          mixBlendMode: 'lighten'
        }}
      />
    </div>
  );
};

export default SnapLogo;
