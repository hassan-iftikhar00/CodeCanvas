import React from 'react';

interface SaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export default function SaveIndicator({ isSaving, lastSaved, error }: SaveIndicatorProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400 w-[128px]">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">Failed</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#FF6B00] w-[128px]">
        <svg className="h-4 w-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-400 w-[128px]">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">Saved</span>
      </div>
    );
  }

  // Default: Not saved yet
  return (
    <div className="flex items-center gap-2 text-xs text-[#A0A0A0] w-[128px]">
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="whitespace-nowrap overflow-hidden text-ellipsis">Not saved</span>
    </div>
  );
}
