'use client';

import { Share2, Download, Twitter, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface WorkoutShareData {
  type: 'workout';
  date: string;
  distance: number;
  duration: number;
  pace: string;
  workoutType: string;
  verdict?: string;
  route?: string;
}

interface WeeklyShareData {
  type: 'weekly';
  week: string;
  totalMiles: number;
  totalRuns: number;
  avgPace: string;
  adherencePercent?: number;
  highlights: string[];
}

type ShareData = WorkoutShareData | WeeklyShareData;

interface ShareCardProps {
  data: ShareData;
  onClose?: () => void;
}

export function ShareCard({ data, onClose }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  const generateShareText = (): string => {
    if (data.type === 'workout') {
      let text = `${data.distance} mi at ${data.pace}/mi\n`;
      text += `${data.date}\n`;
      if (data.verdict) {
        text += `Felt ${data.verdict}\n`;
      }
      text += `\n#running #strideos`;
      return text;
    } else {
      let text = `Week in Review: ${data.week}\n`;
      text += `${data.totalMiles} miles across ${data.totalRuns} runs\n`;
      text += `Average pace: ${data.avgPace}/mi\n`;
      if (data.adherencePercent) {
        text += `${data.adherencePercent}% plan adherence\n`;
      }
      if (data.highlights.length > 0) {
        text += `${data.highlights[0]}\n`;
      }
      text += `\n#running #training #strideos`;
      return text;
    }
  };

  const handleCopy = async () => {
    const text = generateShareText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    const text = generateShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleNativeShare = async () => {
    const text = generateShareText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        // User cancelled
      }
    }
  };

  return (
    <div className="bg-bgSecondary rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
      {/* Card Preview */}
      <div className="bg-gradient-to-br from-teal-600 to-indigo-700 p-6 text-white">
        {data.type === 'workout' ? (
          <>
            <div className="text-sm text-tertiary mb-1">{data.date}</div>
            <div className="text-4xl font-bold mb-2">{data.distance} mi</div>
            <div className="flex items-center gap-4 text-lg">
              <span>{data.pace}/mi</span>
              <span className="text-tertiary">•</span>
              <span>{Math.floor(data.duration / 60)}:{String(data.duration % 60).padStart(2, '0')}</span>
            </div>
            {data.verdict && (
              <div className="mt-3 inline-block px-3 py-1 bg-bgSecondary/20 rounded-full text-sm">
                {data.verdict === 'great' ? 'Great run!' :
                 data.verdict === 'good' ? 'Good run' :
                 data.verdict === 'fine' ? 'Got it done' :
                 data.verdict === 'rough' ? 'Tough one' : 'Run logged'}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-sm text-tertiary mb-1">{data.week}</div>
            <div className="text-4xl font-bold mb-2">{data.totalMiles} miles</div>
            <div className="flex items-center gap-4 text-lg">
              <span>{data.totalRuns} runs</span>
              <span className="text-tertiary">•</span>
              <span>{data.avgPace}/mi avg</span>
            </div>
            {data.adherencePercent && (
              <div className="mt-3 inline-block px-3 py-1 bg-bgSecondary/20 rounded-full text-sm">
                {data.adherencePercent}% plan adherence
              </div>
            )}
          </>
        )}

        <div className="mt-4 pt-4 border-t border-white/20 text-sm text-tertiary">
          stride.os
        </div>
      </div>

      {/* Share Options */}
      <div className="p-4 space-y-3">
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-bgTertiary rounded-xl hover:bg-bgInteractive-hover transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-textSecondary" />
              <span className="font-medium text-textSecondary">Copy Text</span>
            </>
          )}
        </button>

        <button
          onClick={handleTwitterShare}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1DA1F2] text-white rounded-xl hover:bg-[#1a8cd8] transition-colors"
        >
          <Twitter className="w-5 h-5" />
          <span className="font-medium">Share on Twitter</span>
        </button>

        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 py-3 border border-borderPrimary rounded-xl hover:bg-bgTertiary transition-colors"
          >
            <Share2 className="w-5 h-5 text-textSecondary" />
            <span className="font-medium text-textSecondary">More Options</span>
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-textTertiary hover:text-textSecondary"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
