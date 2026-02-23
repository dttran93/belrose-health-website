// src/components/site/Company/ui/TeamCard.tsx
import { Mail } from 'lucide-react';

export interface TeamMember {
  initials: string;
  name: string;
  role: string;
  title: string;
  bio: string;
  tags: string[];
  linkedin?: string;
  email?: string;
}

const TeamCard: React.FC<TeamMember> = ({
  initials,
  name,
  role,
  title,
  bio,
  tags,
  linkedin,
  email,
}) => (
  <div
    className="group rounded-2xl border border-gray-100 bg-white overflow-hidden
    transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
  >
    {/* Photo slot */}
    <div
      className="relative w-full aspect-square bg-gradient-to-br from-blue-50 to-indigo-100
      flex items-center justify-center overflow-hidden"
    >
      <span className="font-serif text-5xl font-bold text-primary/20 select-none">{initials}</span>
      {/* Role badge overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary/60 to-transparent
        px-4 pb-3 pt-6"
      >
        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/80">
          {role}
        </span>
      </div>
    </div>

    {/* Info */}
    <div className="p-5">
      <h3 className="font-bold text-[16px] text-gray-900 mb-0.5">{name}</h3>
      <p className="text-[11px] font-semibold text-pink-500 tracking-wide mb-3">{title}</p>
      <p className="text-[13px] text-gray-500 leading-relaxed mb-4">{bio}</p>

      {/* Credential tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map(tag => (
          <span
            key={tag}
            className="text-[11px] px-2.5 py-0.5 rounded-full border border-gray-200 text-gray-500"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Social links */}
      <div className="flex gap-2">
        {linkedin && (
          <a
            href={linkedin}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400
              px-3 py-1.5 rounded-full border border-gray-200
              hover:border-blue-300 hover:text-blue-600 transition-all duration-150"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400
              px-3 py-1.5 rounded-full border border-gray-200
              hover:border-gray-400 hover:text-gray-700 transition-all duration-150"
          >
            <Mail size={11} />
            Email
          </a>
        )}
      </div>
    </div>
  </div>
);

export default TeamCard;
