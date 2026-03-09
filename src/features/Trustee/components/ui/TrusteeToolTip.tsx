import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';

export const TrusteeToolTip = () => {
  return (
    <div>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button className="inline-flex items-center">
              <HelpCircle className="w-4 h-4 text-gray-500" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
              sideOffset={5}
            >
              <p className="font-semibold mb-2 text-sm">
                Trustees are other Belrose users who you allow to act on your records. There are
                three categories of trustees:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Observers have read-only access to your records</li>
                <li>
                  Custodians can manage your records at the same role level as you, up to
                  administrator
                </li>
                <li>Controllers have full access including ownership actions</li>
              </ol>
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
};
