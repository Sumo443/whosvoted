interface AdSlotProps {
  id: string;
  className?: string;
}

export default function AdSlot({ id, className = "" }: AdSlotProps) {
  return (
    <div
      id={id}
      className={`w-full bg-gray-50 border border-dashed border-gray-200 rounded-lg flex items-center justify-center ${className}`}
      style={{ minHeight: "90px" }}
    >
      {/* AdSense挿入箇所: {id} */}
      <span className="text-xs text-gray-200 select-none">Advertisement</span>
    </div>
  );
}
