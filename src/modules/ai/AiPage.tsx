import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

const useOrgId = () => {
  try { const { useOrganization } = require('@clerk/clerk-react'); return useOrganization().organization?.id ?? ''; }
  catch { return ''; }
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_QUESTIONS = [
  'Who was absent more than 3 times this month?',
  'What is the average check-in time this week?',
  'Which employees have perfect attendance?',
];

/**
 * AiPage — the LangChain + Gemini RAG attendance assistant.
 * Pro plan only — RolesGuard returns 403 if on free tier,
 * which we catch and display as an upgrade prompt.
 */
const AiPage = () => {
  const orgId = useOrgId();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your attendance analytics assistant. Ask me anything about your team\'s attendance data.' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Pre-built insights
  const { data: insights, isLoading: insightsLoading } = useQuery<{ insights: string[] }>({
    queryKey: ['ai-insights'],
    queryFn: async () => (await api.get('/ai/insights')).data,
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });

  const query = useMutation({
    mutationFn: (message: string) =>
      api.post('/ai/query', { message }).then((r) => r.data),
    onSuccess: (data: { answer: string }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    },
    onError: (err: Error) => {
      const msg = err.message.includes('Pro plan')
        ? 'The AI assistant is a Pro feature. Upgrade your plan to unlock it.'
        : err.message;
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    },
  });

  const send = (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || query.isPending) return;
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    query.mutate(message);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', height: 'calc(100vh - 80px)',
      display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={22} color="var(--md-sys-color-primary)" /> AI Assistant
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
          Ask questions about your attendance data in plain English · Pro plan
        </p>
      </div>

      {/* Insights row */}
      {!insightsLoading && insights?.insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {insights.insights.map((insight, i) => (
            <div key={i} style={{ background: 'var(--md-sys-color-surface)', borderRadius: '12px',
              border: '1px solid var(--md-sys-color-outline-variant)', padding: '14px',
              fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5 }}>
              <Bot size={14} style={{ marginBottom: '6px', color: 'var(--md-sys-color-primary)' }} />
              {insight}
            </div>
          ))}
        </div>
      )}

      {/* Chat window */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--md-sys-color-surface)',
        borderRadius: '20px', border: '1px solid var(--md-sys-color-outline-variant)', overflow: 'hidden' }}>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--md-sys-color-primary-container)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={14} color="var(--md-sys-color-on-primary-container)" />
                </div>
              )}
              <div style={{
                maxWidth: '75%', padding: '10px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-variant)',
                color: msg.role === 'user' ? '#fff' : 'var(--md-sys-color-on-surface)',
                fontSize: '14px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="#fff" />
                </div>
              )}
            </div>
          ))}
          {query.isPending && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--md-sys-color-primary-container)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={14} color="var(--md-sys-color-on-primary-container)" />
              </div>
              <div style={{ background: 'var(--md-sys-color-surface-variant)', padding: '10px 16px',
                borderRadius: '18px 18px 18px 4px', fontSize: '14px', color: '#888' }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter questions */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STARTER_QUESTIONS.map((q) => (
            <button key={q} onClick={() => send(q)}
              disabled={query.isPending}
              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '99px',
                border: '1px solid var(--md-sys-color-outline-variant)', background: 'transparent',
                cursor: query.isPending ? 'not-allowed' : 'pointer',
                opacity: query.isPending ? 0.5 : 1,
                color: 'var(--md-sys-color-on-surface-variant)' }}>
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', padding: '14px 16px',
          display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about attendance..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px',
              border: '1px solid var(--md-sys-color-outline-variant)', fontSize: '14px',
              background: 'var(--md-sys-color-surface)', color: 'var(--md-sys-color-on-surface)', outline: 'none' }}
          />
          <button onClick={() => send()} disabled={!input.trim() || query.isPending}
            style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none',
              background: input.trim() ? 'var(--md-sys-color-primary)' : '#e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Send size={16} color={input.trim() ? '#fff' : '#9ca3af'} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiPage;
