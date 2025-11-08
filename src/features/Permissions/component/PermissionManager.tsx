import React, { useState } from 'react';
import { UserLock, ArrowLeft, CircleUser, HelpCircle, Users } from 'lucide-react';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';
import * as Tooltip from '@radix-ui/react-tooltip';

interface PermissionsManagerProps {
  record: FileObject;
  onBack: () => void;
}

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ record, onBack }) => {
  const [ownersExpanded, setOwnersExpanded] = useState(true);
  const [sharedExpanded, setSharedExpanded] = useState(true);

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <UserLock className="w-5 h-5" />
            Permissions
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
        </div>
      </div>

      {/* Subject ID */}
      <div className="bg-chart-4/10 rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 text-foreground mb-3">
          <CircleUser className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Record Subject</span>{' '}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className="inline-flex items-center ml-1 text-blue-700 hover:text-red-800">
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full flex items-center">
                    Ultimate Access
                    <HelpCircle className="w-4 h-4 ml-1" />
                  </span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                  sideOffset={5}
                >
                  <p className="font-semibold mb-2 text-sm">
                    Record Subject is the person this record is about. The Subject has special
                    permissions. Once set, the record subject:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>
                      Is automatically an owner of the record and can view, edit, share as needed
                    </li>
                    <li>Becomes the ONLY person allowed to delete the record</li>
                    <li>CANNOT be changed once set</li>
                    <li>
                      If a mistake is made in setting the subject, you will have to re-upload the
                      record
                    </li>
                  </ol>
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        {record.subjectId ? (
          <>
            <p className="text-xl font-bold text-gray-900">{record.subjectId}</p>
          </>
        ) : (
          <div className="flex justify-between">
            <p>No record subject</p>
            <Button>Set Record Subject</Button>
          </div>
        )}
      </div>

      {/* Owners */}
      <div className="bg-chart-3/10 rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 text-foreground mb-3">
          <Users className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Owners</span>{' '}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className="inline-flex items-center ml-1">
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full flex items-center">
                    Administrative Access
                    <HelpCircle className="w-4 h-4 ml-1" />
                  </span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                  sideOffset={5}
                >
                  <p className="font-semibold mb-2 text-sm">
                    Record Subject is the person this record is about. The Subject has special
                    permissions. Once set, the record subject:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>
                      Is automatically an owner of the record and can view, edit, share as needed
                    </li>
                    <li>Becomes the ONLY person allowed to delete the record</li>
                    <li>CANNOT be changed once set</li>
                    <li>
                      If a mistake is made in setting the subject, you will have to re-upload the
                      record
                    </li>
                  </ol>
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        {record.subjectId ? (
          <>
            <p className="text-xl font-bold text-gray-900">{record.subjectId}</p>
          </>
        ) : (
          <div className="flex justify-between">
            <p>No record subject</p>
            <Button>Set Record Subject</Button>
          </div>
        )}
      </div>

      {/* Shared With */}
      <div className="bg-chart-2/10 rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 text-foreground mb-3">
          <Users className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Shared With</span>{' '}
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button className="inline-flex items-center ml-1">
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full flex items-center">
                    View Access
                    <HelpCircle className="w-4 h-4 ml-1" />
                  </span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                  sideOffset={5}
                >
                  <p className="font-semibold mb-2 text-sm">
                    Record Subject is the person this record is about. The Subject has special
                    permissions. Once set, the record subject:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>
                      Is automatically an owner of the record and can view, edit, share as needed
                    </li>
                    <li>Becomes the ONLY person allowed to delete the record</li>
                    <li>CANNOT be changed once set</li>
                    <li>
                      If a mistake is made in setting the subject, you will have to re-upload the
                      record
                    </li>
                  </ol>
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        {record.subjectId ? (
          <>
            <p className="text-xl font-bold text-gray-900">{record.subjectId}</p>
          </>
        ) : (
          <div className="flex justify-between">
            <p>No record subject</p>
            <Button>Set Record Subject</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsManager;
