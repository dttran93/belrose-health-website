import React from "react";
import { Button } from "@/components/ui/Button";
import { X, Share2, } from 'lucide-react';
import { FileObject } from '@/types/core';
import { TabNavigation } from "@/features/AddRecord/components/ui/TabNavigation";

interface HealthRecordFullProps {
  record: FileObject;
  onView?: (record: FileObject) => void;
  onEdit?: (record: FileObject) => void;
  onDownload?: (record: FileObject) => void;
  onShare?: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
  className?: string;
  showActions?: boolean;
  showMenu?: boolean;
  onBack?: (record: FileObject) => void;
}

export const HealthRecordFull: React.FC<HealthRecordFullProps> = ({record}) => {
  return (
    <div className="max-w-7xl mw-auto bg-background rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary px-8 py-6">
        <div className=" flex items-center justify-between">
          <div className="flex items-center space-x-4 text-white">
            <h1 className="text-2xl font-bold">{record.belroseFields?.title}</h1>
            <p className="mt-1 text-sm">{record.belroseFields?.completedDate} • {record.belroseFields?.provider} • {record.belroseFields?.institution}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-red-500/20 text-red-100 rounded-full text-sm font-medium">
              Self Reported
            </span>
            <Button variant="default">
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="outline" className="px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              Edit Record
            </Button>
            <Button variant="outline" className="px-4 py-2 bg-white rounded-lg font-medium hover:bg-gray-50">
              <X className="w-5 h-5"/>
            </Button>
          </div>
        </div>
        <div className="flex justify left text-white/50">
        <p>{record.belroseFields?.summary}</p>
        </div>
      </div>


    </div>
  );
};

export default HealthRecordFull;
