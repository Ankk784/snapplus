import SnapLogo from "@/components/SnapLogo";
import DisclaimerBox from "@/components/DisclaimerBox";
import SnapForm from "@/components/SnapForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <SnapLogo />
        <DisclaimerBox />
        <SnapForm />
      </div>
    </div>
  );
};

export default Index;
