import { cn } from "@/lib/utils";

interface PusulaLogoProps {
  className?: string;
}

export const PusulaLogo = ({ className }: PusulaLogoProps) => (
  <svg
    viewBox="0 0 96 80"
    role="img"
    aria-label="Pusula"
    className={cn("h-10 w-12 overflow-visible", className)}
  >
    <defs>
      <linearGradient id="pusula-ring-light" x1="16" y1="12" x2="80" y2="68" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9fd9e8" />
        <stop offset="0.52" stopColor="#45b7f3" />
        <stop offset="1" stopColor="#35d4be" />
      </linearGradient>
      <linearGradient id="pusula-ring-dark" x1="16" y1="12" x2="80" y2="68" gradientUnits="userSpaceOnUse">
        <stop stopColor="#59e6ff" />
        <stop offset="0.5" stopColor="#1f7cff" />
        <stop offset="1" stopColor="#4ff7c8" />
      </linearGradient>
      <linearGradient id="pusula-wing-top-light" x1="18" y1="13" x2="76" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#35c5ff" />
        <stop offset="0.58" stopColor="#1499f3" />
        <stop offset="1" stopColor="#0f72ce" />
      </linearGradient>
      <linearGradient id="pusula-wing-bottom-light" x1="20" y1="42" x2="76" y2="63" gradientUnits="userSpaceOnUse">
        <stop stopColor="#55e2b2" />
        <stop offset="0.55" stopColor="#19c2b3" />
        <stop offset="1" stopColor="#0c8ea4" />
      </linearGradient>
      <linearGradient id="pusula-wing-top-dark" x1="18" y1="13" x2="76" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38e9ff" />
        <stop offset="0.5" stopColor="#086bff" />
        <stop offset="1" stopColor="#2c41e8" />
      </linearGradient>
      <linearGradient id="pusula-wing-bottom-dark" x1="20" y1="42" x2="76" y2="63" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6ff5af" />
        <stop offset="0.5" stopColor="#18d4b9" />
        <stop offset="1" stopColor="#0b82ff" />
      </linearGradient>
      <linearGradient id="pusula-needle" x1="46" y1="7" x2="50" y2="71" gradientUnits="userSpaceOnUse">
        <stop stopColor="#20d7ff" />
        <stop offset="0.44" stopColor="#f4fbff" />
        <stop offset="1" stopColor="#b5efff" />
      </linearGradient>
      <filter id="pusula-logo-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="2.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="pusula-logo-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#06131f" floodOpacity="0.28" />
      </filter>
    </defs>

    <g className="dark:hidden" filter="url(#pusula-logo-soft-shadow)">
      <circle cx="48" cy="40" r="31" fill="#eaf7f8" fillOpacity="0.45" />
      <circle cx="48" cy="40" r="30" fill="none" stroke="url(#pusula-ring-light)" strokeWidth="2.6" strokeOpacity="0.55" />
      <circle cx="48" cy="40" r="24" fill="none" stroke="#4f8ea0" strokeWidth="1" strokeOpacity="0.22" />
      <path d="M48 9l3.4 15.7L67 28l-15.6 3.3L48 47l-3.4-15.7L29 28l15.6-3.3L48 9Z" fill="#d7e8ed" stroke="#66828d" strokeWidth="0.8" opacity="0.62" />
      <path d="M48 33h29l-8 4.6L77 42H48V33ZM48 33H19l8 4.6L19 42h29V33Z" fill="#c8d9de" opacity="0.55" />

      <path d="M46.6 35.2C30 30.8 18.3 26.7 15.4 15.2c13.5-1.8 26.9 1.5 34 15.6l-2.8 4.4Z" fill="url(#pusula-wing-top-light)" stroke="#17648c" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M49.4 35.2C66 30.8 77.7 26.7 80.6 15.2c-13.5-1.8-26.9 1.5-34 15.6l2.8 4.4Z" fill="url(#pusula-wing-top-light)" stroke="#17648c" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M46 43.5C31.4 44.3 22 48.3 19.8 60c11.5 4.7 22.8-1.3 29.6-15.4L46 43.5Z" fill="url(#pusula-wing-bottom-light)" stroke="#0a6d72" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M50 43.5c14.6.8 24 4.8 26.2 16.5-11.5 4.7-22.8-1.3-29.6-15.4l3.4-1.1Z" fill="url(#pusula-wing-bottom-light)" stroke="#0a6d72" strokeWidth="1.7" strokeLinejoin="round" />

      <path d="M22.5 23.5c8.6 1.1 16.4 3.8 23.4 8M74 23.5c-8.6 1.1-16.4 3.8-23.4 8M27.2 53.4c7.2-3.4 13.4-5.7 18.8-7.1M68.8 53.4c-7.2-3.4-13.4-5.7-18.8-7.1" stroke="#d9fbff" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
      <path d="M48 11l6.3 30.5L48 69l-6.3-27.5L48 11Z" fill="url(#pusula-needle)" stroke="#0a4260" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M48 41.5V69l-6.3-27.5H48Z" fill="#f8fdff" opacity="0.86" />
      <circle cx="48" cy="41" r="6.1" fill="#f4fbff" stroke="#0a4260" strokeWidth="1.7" />
    </g>

    <g className="hidden dark:block" filter="url(#pusula-logo-glow)">
      <circle cx="48" cy="40" r="33" fill="#050d18" stroke="#081522" strokeWidth="2" />
      <circle cx="48" cy="40" r="30" fill="none" stroke="url(#pusula-ring-dark)" strokeWidth="3.2" />
      <circle cx="48" cy="40" r="23" fill="none" stroke="#7defff" strokeWidth="1.2" strokeOpacity="0.36" />
      <path d="M48 7l3.5 17.7L69 28.4l-17.5 3.7L48 50l-3.5-17.9L27 28.4l17.5-3.7L48 7Z" fill="#d9fbff" stroke="#03101c" strokeWidth="1.2" />
      <path d="M48 33h33l-8.5 5L81 43H48V33ZM48 33H15l8.5 5L15 43h33V33Z" fill="#d9fbff" stroke="#03101c" strokeWidth="1.2" />

      <path d="M46.6 35.2C30 30.8 18.3 26.7 15.4 15.2c13.5-1.8 26.9 1.5 34 15.6l-2.8 4.4Z" fill="url(#pusula-wing-top-dark)" stroke="#041223" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M49.4 35.2C66 30.8 77.7 26.7 80.6 15.2c-13.5-1.8-26.9 1.5-34 15.6l2.8 4.4Z" fill="url(#pusula-wing-top-dark)" stroke="#041223" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M46 43.5C31.4 44.3 22 48.3 19.8 60c11.5 4.7 22.8-1.3 29.6-15.4L46 43.5Z" fill="url(#pusula-wing-bottom-dark)" stroke="#041223" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M50 43.5c14.6.8 24 4.8 26.2 16.5-11.5 4.7-22.8-1.3-29.6-15.4l3.4-1.1Z" fill="url(#pusula-wing-bottom-dark)" stroke="#041223" strokeWidth="2.1" strokeLinejoin="round" />

      <path d="M22.5 23.5c8.6 1.1 16.4 3.8 23.4 8M74 23.5c-8.6 1.1-16.4 3.8-23.4 8M27.2 53.4c7.2-3.4 13.4-5.7 18.8-7.1M68.8 53.4c-7.2-3.4-13.4-5.7-18.8-7.1" stroke="#a7ffff" strokeWidth="1.35" strokeLinecap="round" opacity="0.7" />
      <path d="M48 9l6.6 32.4L48 71l-6.6-29.6L48 9Z" fill="url(#pusula-needle)" stroke="#041223" strokeWidth="2" strokeLinejoin="round" />
      <path d="M48 41.5V71l-6.6-29.6H48Z" fill="#f8fdff" opacity="0.9" />
      <circle cx="48" cy="41" r="6.4" fill="#eaffff" stroke="#041223" strokeWidth="2" />
    </g>
  </svg>
);
