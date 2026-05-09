import { Sparkles } from 'lucide-react';

export default function PrefilledIndicator() {
  return (
    <div className="group relative flex items-center justify-center">
      <Sparkles className="h-4 w-4 text-blue-400" />
      <div className="absolute bottom-full right-0 mb-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100]">
        <div className="bg-blue-600 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-xl whitespace-nowrap">
          PREFILLED FROM PFATC
        </div>
        <div className="w-2 h-2 bg-blue-600 rotate-45 absolute -bottom-1 right-2" />
      </div>
    </div>
  );
}
