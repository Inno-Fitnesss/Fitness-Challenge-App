import { AlertTriangle, Camera, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import type { CvFeedbackMessage, CvFeedbackSeverity, CvFeedbackType } from '../../types/session.types.ts';

interface AiFeedbackPanelProps {
  messages: CvFeedbackMessage[];
  cvConnected: boolean;
}

const TYPE_META: Record<
  CvFeedbackType,
  { label: string; icon: typeof Camera; accent: string }
> = {
  camera: { label: 'Камера', icon: Camera, accent: 'text-brand bg-brand-light' },
  lighting: { label: 'Свет', icon: Lightbulb, accent: 'text-amber-600 bg-amber-50' },
  posture: { label: 'Техника', icon: AlertTriangle, accent: 'text-orange-600 bg-orange-50' },
  general: { label: 'Совет', icon: Sparkles, accent: 'text-lime-hover bg-lime-pale' },
};

const SEVERITY_BORDER: Record<CvFeedbackSeverity, string> = {
  info: 'border-neutral-border',
  warning: 'border-amber-200',
  success: 'border-lime/40',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AiFeedbackPanel({ messages, cvConnected }: AiFeedbackPanelProps) {
  return (
    <section className="bg-white rounded-3xl shadow-card border border-neutral-border/60 flex flex-col">
      <header className="px-5 py-4 border-b border-neutral-border flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-text">Подсказки AI</h2>
          <p className="text-xs text-neutral-muted mt-0.5">
            Постановка, свет и техника выполнения
          </p>
        </div>
        <span
          className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${
            cvConnected ? 'bg-lime-pale text-lime-hover' : 'bg-neutral-card text-neutral-muted'
          }`}
        >
          {cvConnected ? 'CV подключён' : 'Демо-режим'}
        </span>
      </header>

      <div className="overflow-y-auto p-4 space-y-3 max-h-[280px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-lime mb-3" />
            <p className="text-sm font-medium text-neutral-text">Всё отлично!</p>
            <p className="text-xs text-neutral-muted mt-1">Продолжайте в том же темпе</p>
          </div>
        ) : (
          messages.map((message) => {
            const meta = TYPE_META[message.type];
            const Icon = meta.icon;

            return (
              <article
                key={message.id}
                className={`flex gap-3 p-3.5 rounded-2xl border bg-neutral-card/40 ${SEVERITY_BORDER[message.severity]}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.accent}`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-neutral-secondary">{meta.label}</span>
                    <time className="text-[10px] text-neutral-muted tabular-nums">
                      {formatTime(message.timestamp)}
                    </time>
                  </div>
                  <p className="text-sm text-neutral-text leading-snug">{message.text}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
