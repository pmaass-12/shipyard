/**
 * PipelineStrip — Build 033
 *
 * Horizontal step progress bar shown at the top of FeatureWorkflowScreen.
 * Renders 6 bubbles (Design → Schema → Code → Preview → QA → Live) with
 * connecting lines. Clicking a bubble navigates to that tab (if not locked).
 */

import React from 'react';
import { Check, Lock } from 'lucide-react';
import type { FeatureStep } from '@/types/db';
import { STEP_LABELS } from '@/types/db';
import { getStepRenderState } from '@/api/featureWorkflow';

interface PipelineStripProps {
  steps:         FeatureStep[];
  activeStep:    number;              // 1–6
  onSelectStep:  (stepNumber: number) => void;
}

export default function PipelineStrip({ steps, activeStep, onSelectStep }: PipelineStripProps) {
  const stepNumbers = [1, 2, 3, 4, 5, 6] as const;

  // Map step_number → FeatureStep for quick lookup
  const stepMap = steps.reduce<Record<number, FeatureStep>>((acc, s) => {
    acc[s.step_number] = s;
    return acc;
  }, {});

  return (
    <div
      data-testid="pipeline-strip"
      className="flex items-center gap-0 px-6 py-4 bg-white border-b border-gray-100"
    >
      {stepNumbers.map((num, idx) => {
        const step       = stepMap[num];
        const renderState = step ? getStepRenderState(step) : 'locked';
        const isActive   = num === activeStep;
        const isLocked   = renderState === 'locked' || !step;
        const isApproved = renderState === 'approved';
        const isLast     = idx === stepNumbers.length - 1;

        const canClick = !isLocked;

        return (
          <React.Fragment key={num}>
            {/* Step bubble + label */}
            <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
              <button
                data-testid={`pipeline-step-${num}`}
                onClick={() => canClick && onSelectStep(num)}
                disabled={isLocked}
                aria-current={isActive ? 'step' : undefined}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  isApproved && !isActive
                    ? 'bg-emerald-500 text-white focus-visible:ring-emerald-400'
                    : isActive
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 focus-visible:ring-indigo-400'
                    : renderState === 'active'
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus-visible:ring-indigo-400'
                    : renderState === 'not_started'
                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 focus-visible:ring-gray-400'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed',
                ].join(' ')}
              >
                {isApproved && !isActive ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : isLocked ? (
                  <Lock className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  num
                )}
              </button>

              <span
                className={[
                  'text-[11px] font-medium leading-none',
                  isActive
                    ? 'text-indigo-600'
                    : isApproved
                    ? 'text-emerald-600'
                    : isLocked
                    ? 'text-gray-300'
                    : 'text-gray-500',
                ].join(' ')}
              >
                {STEP_LABELS[num]}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={[
                  'flex-1 h-px mx-1 mb-[18px]',  // mb nudges line to bubble center
                  isApproved ? 'bg-emerald-300' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
