/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dynoshi Android Lab - AI Lab Assistant & Google Search Grounding Console
 * Calls server-side /api/ai/chat and /api/ai/search routes (never client-side SDK).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Smartphone,
  Sparkles,
  Loader2,
  AlertTriangle,
  Search,
  Cloud,
  X,
} from 'lucide-react';
import { VirtualDevice } from '../types';
import { GroundingSourceLink } from '../logic/diagnostics_log';
import { useFirebase } from './FirebaseProvider';

interface LocalChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources: GroundingSourceLink[];
  webSearchQueries?: string[];
  createdAt: string;
}

interface AiLabAssistantViewProps {
  devices: VirtualDevice[];
  activeDeviceId: string | null;
}

const QUICK_PROMPTS = [
  'Latest Android 15 and 16 official emulator system images with Google Play Store',
  'How do I fix ADB device unauthorized and verify com.android.vending via shell?',
  'Compare Samsung Galaxy S24 Ultra vs Google Pixel 9 Pro resolution and ABI specs',
  'Best flags for starting headless Android emulator AVDs with KVM and Play Store',
];

export const AiLabAssistantView: React.FC<AiLabAssistantViewProps> = ({
  devices,
  activeDeviceId,
}) => {
  const {
    user,
    profileReady,
    cloudThreads,
    createAiThread,
    deleteAiThread,
    appendAiMessage,
    subscribeThreadMessages,
  } = useFirebase();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'>(
    'gemini-4-hydrogen'
  );
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(true);
  const [selectedContextDeviceId, setSelectedContextDeviceId] = useState<string>(
    activeDeviceId || ''
  );
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQueryInput, setSearchQueryInput] = useState('');
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  const scrollBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Select first cloud thread automatically when signed in
  useEffect(() => {
    if (user && profileReady && cloudThreads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(cloudThreads[0].id);
    }
  }, [user, profileReady, cloudThreads, selectedThreadId]);

  // Subscribe to selected cloud thread messages
  useEffect(() => {
    if (!user || !profileReady || !selectedThreadId) return;
    const unsub = subscribeThreadMessages(selectedThreadId, (cloudMsgs) => {
      setMessages(
        cloudMsgs.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          sources: (m.sourceUrls || []).map((uri, i) => ({
            uri,
            title: m.sourceTitles?.[i] || uri,
          })),
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
        }))
      );
    });
    return () => unsub();
  }, [user, profileReady, selectedThreadId, subscribeThreadMessages]);

  const buildDeviceContextSummary = (): string => {
    const dev = devices.find((d) => d.id === selectedContextDeviceId);
    if (!dev) {
      return `Host has ${devices.length} registered device(s), ${
        devices.filter((d) => d.status === 'running').length
      } currently running.`;
    }
    return `Selected Device: ${dev.name} | Serial: ${dev.adbSerial || 'Not attached'} | Status: ${
      dev.status
    } | OS: Android ${dev.androidVersion} (API ${dev.apiLevel}) | ABI: ${dev.abi} | Play Store: ${
      dev.googlePlay?.playStoreInstalled ? 'Installed' : 'Not Detected'
    }`;
  };

  const handleNewThread = async () => {
    setErrorMsg(null);
    if (user && profileReady) {
      const tid = await createAiThread(
        `Lab Session ${new Date().toLocaleTimeString()}`,
        model,
        useSearchGrounding
      );
      if (tid) setSelectedThreadId(tid);
      setMessages([]);
    } else {
      setSelectedThreadId(null);
      setMessages([]);
    }
  };

  const handleSendChat = async (promptOverride?: string) => {
    const textToSend = (promptOverride ?? input).trim();
    if (!textToSend || isSending) return;

    setErrorMsg(null);
    if (!promptOverride) setInput('');
    setIsSending(true);

    let activeThreadId = selectedThreadId;
    const priorHistory = messages.map((m) => ({ role: m.role, text: m.text }));

    const optimisticUserMsg: LocalChatMessage = {
      id: `local-u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      sources: [],
      createdAt: new Date().toISOString(),
    };

    if (!user || !profileReady) {
      setMessages((prev) => [...prev, optimisticUserMsg]);
    } else {
      if (!activeThreadId) {
        activeThreadId = await createAiThread(
          textToSend.slice(0, 64),
          model,
          useSearchGrounding
        );
        if (activeThreadId) setSelectedThreadId(activeThreadId);
      }
      if (activeThreadId) {
        await appendAiMessage(activeThreadId, 'user', textToSend, []);
      }
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: priorHistory,
          message: textToSend,
          model,
          useSearchGrounding,
          deviceContext: buildDeviceContextSummary(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Gemini assistant returned HTTP ${res.status}`);
      }

      const sources: GroundingSourceLink[] = Array.isArray(data.sources) ? data.sources : [];
      if (user && profileReady && activeThreadId) {
        await appendAiMessage(activeThreadId, 'model', data.text, sources);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-m-${Date.now()}`,
            role: 'model',
            text: data.text,
            sources,
            webSearchQueries: data.webSearchQueries || [],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to communicate with Gemini Assistant.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDirectWebSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQueryInput.trim();
    if (!q || isSearchingWeb) return;
    setIsSearchingWeb(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          deviceContext: buildDeviceContextSummary(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Google Search grounding returned HTTP ${res.status}`);
      }
      setSearchQueryInput('');

      const sources: GroundingSourceLink[] = Array.isArray(data.sources) ? data.sources : [];
      if (user && profileReady) {
        let tid = selectedThreadId;
        if (!tid) {
          tid = await createAiThread(`Search: ${q.slice(0, 48)}`, 'gemini-4-hydrogen', true);
          if (tid) setSelectedThreadId(tid);
        }
        if (tid) {
          await appendAiMessage(tid, 'user', `[Google Search Probe] ${q}`, []);
          await appendAiMessage(tid, 'model', data.text, sources);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-su-${Date.now()}`,
            role: 'user',
            text: `[Google Search Probe] ${q}`,
            sources: [],
            createdAt: new Date().toISOString(),
          },
          {
            id: `local-sm-${Date.now() + 1}`,
            role: 'model',
            text: data.text,
            sources,
            webSearchQueries: data.webSearchQueries || [],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Search grounding request failed.');
    } finally {
      setIsSearchingWeb(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-400" />
            <h1 className="font-tech text-2xl font-bold tracking-wide text-slate-100">
              AI LAB ASSISTANT &amp; GOOGLE SEARCH GROUNDING
            </h1>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
              SERVER-SIDE GEMINI
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multi-turn Android systems engineering assistant grounded with live Google Search citations and optional Firestore thread history.
          </p>
        </div>

        {/* Dedicated Google Search Grounding Bar */}
        <form onSubmit={handleDirectWebSearch} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQueryInput}
              onChange={(e) => setSearchQueryInput(e.target.value)}
              placeholder="Google Search Grounding query..."
              aria-label="Google Search Grounding query"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingWeb || !searchQueryInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            {isSearchingWeb ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            <span>Search Web</span>
          </button>
        </form>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[540px]">
        {/* Left Sidebar: Config & Saved Threads */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-slate-200 tracking-wide">
                ASSISTANT CONTROLS
              </span>
              <button
                type="button"
                onClick={handleNewThread}
                className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-700/50 text-cyan-300 text-[11px] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Thread</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-mono-code block">
                Model Selection
              </label>
              <select
                value={model}
                onChange={(e) =>
                  setModel(e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite')
                }
                aria-label="Select Gemini model"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono-code text-[11px] focus:outline-none focus:border-cyan-500"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Recommended + Search)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Lite)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-mono-code flex items-center gap-1.5">
                <Smartphone className="w-3 h-3 text-cyan-400" />
                <span>Inject Live Device Context</span>
              </label>
              <select
                value={selectedContextDeviceId}
                onChange={(e) => setSelectedContextDeviceId(e.target.value)}
                aria-label="Select device context"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono-code text-[11px] focus:outline-none focus:border-cyan-500"
              >
                <option value="">Host Overview ({devices.length} devices)</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              aria-pressed={useSearchGrounding}
              onClick={() => setUseSearchGrounding((v) => !v)}
              className={`w-full px-3 py-2 rounded-lg border text-[11px] font-mono-code flex items-center justify-between transition ${
                useSearchGrounding
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Google Search Grounding</span>
              </span>
              <span className="font-bold">{useSearchGrounding ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Cloud Threads List */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-tech font-bold text-slate-200 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-violet-400" />
                <span>CONVERSATION THREADS</span>
              </span>
              <span className="text-[10px] font-mono-code text-slate-500">
                {user ? `${cloudThreads.length} synced` : 'Guest Session'}
              </span>
            </div>

            {!user ? (
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                Sign in with Google from the top titlebar to persist chat history &amp; grounding sources in Cloud Firestore.
              </div>
            ) : cloudThreads.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                No saved threads yet. Ask a question to create your first Firestore-backed session.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {cloudThreads.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition ${
                      selectedThreadId === t.id
                        ? 'bg-cyan-950/50 border-cyan-600/60 text-cyan-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                    onClick={() => setSelectedThreadId(t.id)}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold truncate">{t.title}</div>
                      <div className="text-[10px] font-mono-code text-slate-500">{t.model}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAiThread(t.id);
                        if (selectedThreadId === t.id) {
                          setSelectedThreadId(null);
                          setMessages([]);
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400"
                      aria-label={`Delete thread ${t.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Chat Thread & Input */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl bg-[#090d18] border border-slate-800 overflow-hidden">
          {errorMsg && (
            <div className="p-3 bg-rose-950/70 border-b border-rose-800/70 text-rose-200 text-xs flex items-center justify-between gap-2 font-mono-code">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="break-words">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-300 hover:text-white shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Scrollable Message Thread */}
          <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[520px]">
            {messages.length === 0 ? (
              <div className="py-8 space-y-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/70 border border-cyan-700/50 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-tech text-lg font-bold text-slate-100">
                    DYNOSHI Android Engineering Assistant
                  </h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Ask anything about ADB diagnostics, Play Store system images, emulator flags, or click a grounded query below.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto text-left">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSendChat(q)}
                      className="p-3 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-cyan-700/60 text-xs text-slate-300 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-cyan-950/70 border border-cyan-700/50 text-cyan-50'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono-code text-slate-400">
                      <span className="uppercase font-bold text-cyan-400">
                        {msg.role === 'user' ? 'Operator' : 'Gemini Assistant'}
                      </span>
                      <span>•</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="whitespace-pre-wrap break-words font-sans text-[13px]">
                      {msg.text}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-mono-code text-emerald-400 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span>Google Search Grounding Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[10px] text-cyan-300 max-w-xs truncate"
                            >
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isSending && (
              <div className="flex items-center gap-2 text-xs font-mono-code text-cyan-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  Querying {model}
                  {useSearchGrounding ? ' with Google Search grounding' : ''}...
                </span>
              </div>
            )}
            <div ref={scrollBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemini about ADB, Android AVDs, Play Store images, or search live Android docs..."
              aria-label="Chat message input"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
