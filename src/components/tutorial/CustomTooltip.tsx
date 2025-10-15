import React from 'react';
import Button from '../common/Button';
import type { TooltipRenderProps } from 'react-joyride';
import { X } from 'lucide-react';

interface CustomStep {
  target: string;
  title: string;
  content: string;
  placement: string;
  disableNext?: boolean;
  isLast?: boolean;
}

export default function CustomTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const customStep = step as CustomStep;
  if (
    step.target === '#settings-button' ||
    (step.target === '#start-session-btn' &&
      step.title === '' &&
      step.content === '')
  ) {
    return null;
  }

  return (
    <div
      {...tooltipProps}
      className="bg-zinc-900 border-2 border-blue-800 rounded-lg p-6 shadow-xl max-w-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-white">{step.title}</h3>
        <button {...closeProps} className="p-1 rounded-full hover:bg-gray-700">
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>
      <div className="text-gray-300 mb-6">{step.content}</div>
      <div className="flex justify-start space-x-3">
        {skipProps && (
          <Button
            onClick={(event) => {
              skipProps.onClick(
                event as React.MouseEvent<HTMLElement, MouseEvent>
              );
            }}
            variant="outline"
            size="sm"
            className="text-red-400 border-red-700/50 hover:bg-red-900/20"
          >
            Skip
          </Button>
        )}
        {index > 0 && (
          <Button
            onClick={(event) => {
              backProps.onClick(
                event as React.MouseEvent<HTMLElement, MouseEvent>
              );
            }}
            variant="outline"
            size="sm"
          >
            Back
          </Button>
        )}
        {continuous && !(customStep.disableNext && customStep.isLast) && (
          <Button
            onClick={(event) => {
              primaryProps.onClick(
                event as React.MouseEvent<HTMLButtonElement, MouseEvent>
              );
            }}
            size="sm"
          >
            Next
          </Button>
        )}
        {(!continuous || (customStep.disableNext && customStep.isLast)) && (
          <Button
            onClick={(event) => {
              primaryProps.onClick(
                event as React.MouseEvent<HTMLButtonElement, MouseEvent>
              );
            }}
            size="sm"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
