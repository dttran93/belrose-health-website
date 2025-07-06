import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Paperclip, Download, Edit, Copy, Share, Archive, Trash, X, Save, Plus, Trash2 } from 'lucide-react';
import HealthRecordCardMenu from './HealthRecordCardMenu';

const HealthRecordCard = ({ 
  subject, 
  provider, 
  institutionName, 
  institutionAddress, 
  date, 
  clinicNotes,
  attachments = [],
  isBlockchainVerified = false,
  onUpdate,
  onEdit,
  onCopy,
  onShare,
  onArchive,
  onDelete,
  isEditable = true,
}) => {

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData ] = useState({
    subject: subject || '',
    provider: provider || '',
    institutionName: institutionName || '',
    institutionAddress: institutionAddress || '',
    date: date || '',
    clinicNotes: clinicNotes || '',
    attachments: attachments || [],
    isBlockchainVerified: isBlockchainVerified || false
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(formData);
    }
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (onEdit) onEdit();
  };

  const handleCopy = () => {
    if (onCopy) onCopy(displayData);
  };

  const handleShare = () => {
    if (onShare) onShare(displayData);
  };

  const handleArchive = () => {
    if (onArchive) onArchive(displayData);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(displayData);
  };

  // Build options menu items
  const menuOptions = [
    ...(isEditable ? [{
      key: 'edit',
      label: 'Edit Record',
      icon: Edit,
      onClick: handleEdit
    }] : []),
    {
      key: 'copy',
      label: 'Copy Data',
      icon: Copy,
      onClick: handleCopy
    },
    {
      key: 'share',
      label: 'Share Record',
      icon: Share,
      onClick: handleShare
    },
    {
      type: 'divider'
    },
    {
      key: 'archive',
      label: 'Archive',
      icon: Archive,
      onClick: handleArchive
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash,
      onClick: handleDelete,
      destructive: true
    }
  ];

  const handleCancel = () => {
    setFormData({
      subject: subject || '',
      provider: provider || '',
      institutionName: institutionName || '',
      institutionAddress: institutionAddress || '',
      date: date || '',
      clinicNotes: clinicNotes || '',
      attachments: attachments || [],
      isBlockchainVerified: isBlockchainVerified || false
    });
    setIsEditing(false);
  };

  const addAttachment = () => {
    const newAttachment = {
      id: Date.now(),
      name: 'New Document.pdf',
      size: '0 KB'
    };
    handleInputChange('attachments', [...formData.attachments, newAttachment]);
  };

  const updateAttachment = (index, field, value) => {
    const updatedAttachments = formData.attachments.map((attachment, i) => 
      i === index ? { ...attachment, [field]: value } : attachment
    );
    handleInputChange('attachments', updatedAttachments);
  };

  const removeAttachment = (index) => {
    const updatedAttachments = formData.attachments.filter((_, i) => i !== index);
    handleInputChange('attachments', updatedAttachments);
  };

  // Use formData when editing, props when not editing
  const displayData = isEditing ? formData : {
    subject, provider, institutionName, institutionAddress, date, clinicNotes, attachments, isBlockchainVerified
  };

  return (
    <div className={`h-full relative group bg-background text-foreground rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col`}>
       {/* Options Menu */}
      {!isEditing && (
        <div className="absolute top-4 right-4">
          <HealthRecordCardMenu options={menuOptions} />
        </div>
      )}

      {/* Save/Cancel Buttons */}
      {isEditing && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="p-1 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
            title="Save Changes"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section - Subject Line, Doctor/Provider Information, Date, Institution Name/Address */}
      <div className="flex justify-between border-b border-border pb-4 mb-4 mt-4">
        <div className="flex flex-col">
          {isEditing ? (
            <>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="text-2xl font-semibold mb-3 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                placeholder="Subject"
              />
              <input
                type="text" //figure out how do format this as a date eventually
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="text-gray-600 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </>
          ) : (
            <>
              <div className="flex text-2xl font-semibold mb-3">{displayData.subject}</div>
              <div className="flex justify-left text-gray-600">{displayData.date}</div>
            </>
          )}
        </div>
        <div className="flex flex-col items-end text-right">
          {isEditing ? (
            <>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
                className="font-medium mb-1 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none text-right"
                placeholder="Provider"
              />
              <input
                type="text"
                value={formData.institutionName}
                onChange={(e) => handleInputChange('institutionName', e.target.value)}
                className="text-sm text-gray-600 mb-1 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none text-right"
                placeholder="Institution Name"
              />
              <input
                type="text"
                value={formData.institutionAddress}
                onChange={(e) => handleInputChange('institutionAddress', e.target.value)}
                className="text-sm text-gray-500 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none text-right"
                placeholder="Institution Address"
              />
            </>
          ) : (
            <>
              <div className="font-medium">{displayData.provider}</div>
              <div className="text-sm text-gray-600">{displayData.institutionName}</div>
              <div className="text-sm text-gray-500">{displayData.institutionAddress}</div>
            </>
          )}
        </div>
      </div>
      
       {/* Section 2 - Clinical Notes from Interaction */}
      <div className="flex-1 border-b border-border pb-4 mb-4">
        <h3 className="text-lg font-semibold mb-2">Clinical Notes</h3>
        {isEditing ? (
          <textarea
            value={formData.clinicNotes}
            onChange={(e) => handleInputChange('clinicNotes', e.target.value)}
            className="w-full h-32 p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Enter clinical notes..."
          />
        ) : (
          <div className="whitespace-pre-line text-left text-gray-700">
            {displayData.clinicNotes}
          </div>
        )}
      </div>
      
      {/* Section 3 - Attachments */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex justify-center items-center mb-2">
          <h3 className="flex text-lg font-semibold items-center gap-2">
            <Paperclip size={18} />
            Attachments {displayData.attachments.length > 0 && `(${displayData.attachments.length})`}
          </h3>
          {isEditing && (
            <button
              onClick={addAttachment}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
            >
              <Plus size={14} />
              Add
            </button>
          )}
        </div>
        
        {displayData.attachments.length > 0 ? (
          <div className="space-y-2">
            {displayData.attachments.map((attachment, index) => (
              <div key={attachment.id || index} className={`flex items-center ${isEditing ? 'gap-2' : 'justify-between'} p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors`}>
                {isEditing ? (
                  <>
                    <Paperclip size={16} className="text-gray-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={attachment.name}
                      onChange={(e) => updateAttachment(index, 'name', e.target.value)}
                      className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none focus:bg-white focus:border focus:border-gray-300 focus:rounded px-1"
                      placeholder="Document name"
                    />
                    <input
                      type="text"
                      value={attachment.size}
                      onChange={(e) => updateAttachment(index, 'size', e.target.value)}
                      className="w-20 text-xs text-gray-500 bg-transparent border-none focus:outline-none focus:bg-white focus:border focus:border-gray-300 focus:rounded px-1"
                      placeholder="Size"
                    />
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Paperclip size={16} className="text-gray-500" />
                      <span className="text-sm font-medium">{attachment.name}</span>
                      <span className="text-xs text-gray-500">({attachment.size})</span>
                    </div>
                    <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm">
                      <Download size={14} />
                      Download
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm italic">
            {isEditing ? 'No attachments - click Add to include files' : 'No attachments'}
          </div>
        )}
      </div>
      
      {/* Section 4 - Blockchain Verification Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBlockchainVerified ? (
            <>
              <CheckCircle size={20} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Blockchain Verified
              </span>
              <span className="text-xs text-gray-500">
                Hash verified against distributed ledger
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={20} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                Self Reported
              </span>
              <span className="text-xs text-gray-500">
                Not verified against blockchain
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthRecordCard;