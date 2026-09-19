import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/app/AppContext';
import { ChatThread, ChatMessage } from '@/shared/types';
import { apiService } from '@/shared/services/apiService';

export function useChatViewModel() {
  const { agents } = useApp();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('thread-default');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    }
  }, [activeThreadId]);

  const loadThreads = async () => {
    try {
      const data = await apiService.getChatThreads();
      if (data && data.length > 0) {
        setThreads(data);
        if (!activeThreadId) setActiveThreadId(data[0].id);
      }
    } catch {
      // Fallback
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const data = await apiService.getChatMessages(threadId);
      setMessages(data || []);
    } catch {
      // Fallback
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    setIsSending(true);

    try {
      const result = await apiService.sendChatMessage({
        threadId: activeThreadId,
        content: text,
        senderName: 'You'
      });
      if (result) {
        setMessages(prev => [...prev, result.userMessage, result.agentMessage]);
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const createNewThread = async (title?: string) => {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: title || 'New Conversation',
      lastMessageSnippet: '',
      lastMessageAt: new Date().toISOString(),
      // Participant history is empty until an agent actually answers; the
      // Chats view chooses a responder through the thread target fields.
      agentIds: [],
      pinned: false,
      createdAt: new Date().toISOString()
    };
    try {
      const created = await apiService.createChatThread(newThread);
      setThreads(prev => [created, ...prev]);
      setActiveThreadId(created.id);
      setMessages([]);
    } catch {
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      setMessages([]);
    }
  };

  const activeThread = useMemo(() => {
    return threads.find(t => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  return {
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    messages,
    inputText,
    setInputText,
    isSending,
    handleSendMessage,
    createNewThread,
    agents
  };
}
