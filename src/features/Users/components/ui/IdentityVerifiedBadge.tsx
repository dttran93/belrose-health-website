// src/features/HealthProfile/components/ui/IdentityVerifiedBadge.tsx

import * as Tooltip from '@radix-ui/react-tooltip';
import { Check } from 'lucide-react';

export const IdentityVerifiedBadge: React.FC = () => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 cursor-help flex-shrink-0 leading-none select-none">
          <Check className="w-3 h-3 text-white translate-y-[1px]" strokeWidth={3} />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 max-w-xs shadow-lg"
          sideOffset={5}
        >
          This user's identity has been verified by Belrose Health
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);
