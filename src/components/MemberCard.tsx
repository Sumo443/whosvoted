import Link from "next/link";
import InitialAvatar from "./InitialAvatar";
import type { Member } from "@/lib/data-loader";

interface Props {
  member: Member;
}

export default function MemberCard({ member }: Props) {
  return (
    <Link
      href={`/member/${member.id || ""}`}
      className="flex-shrink-0 w-36 border border-gray-100 rounded-xl p-4 text-center hover:border-[#1D9E75] hover:shadow-sm transition-all"
    >
      <div className="flex justify-center mb-2">
        <InitialAvatar name={member.member_name} size={40} faction={member.faction || member.party} />
      </div>
      <p className="text-sm font-medium text-gray-800 truncate">
        {member.member_name}
      </p>
      <p className="text-xs text-gray-400 truncate mt-0.5">
        {member.party || member.faction || ""}
      </p>
    </Link>
  );
}
