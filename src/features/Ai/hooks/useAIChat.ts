import { useState, useCallback, useRef } from 'react';
import { HealthRecordSearch } from '../service/healthRecordSearch';
import { FHIRBundle } from '@/types/fhir';
import { ChatMessage } from '../components/ui/ChatMessage';
import { AIModel } from '../components/ui/ModelSelector';

interface UseAIChatProps {
  fhirBundle: FHIRBundle | null; // User's decrypted health records
}

export interface ChatError {
  message: string;
  code?: string;
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ChatError | null;
  selectedModel: AIModel;
  availableModels: AIModel[];
  sendMessage: (message: string) => Promise<void>;
  setSelectedModel: (model: AIModel) => void;
  clearChat: () => void;
}

const AVAILABLE_MODELS: AIModel[] = [
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'claude' },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'claude' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
];

const MOCK_DATA_ENABLED = true;
const MOCK_DATA = MOCK_DATA_ENABLED
  ? [
      {
        id: '1',
        role: 'user' as const, // Add 'as const' to match literal types
        content: 'What were my blood pressure readings from last month?',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // Remove .toISOString()
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: `Based on your health records, here are your blood pressure readings from last month:

**Week of January 6-12:**
- Jan 8: 118/76 mmHg
- Jan 10: 122/78 mmHg

**Week of January 13-19:**
- Jan 15: 120/75 mmHg
- Jan 17: 119/77 mmHg

**Week of January 20-26:**
- Jan 22: 125/80 mmHg
- Jan 24: 121/76 mmHg

Your readings are consistently within the normal range (less than 120/80 mmHg). The highest reading was 125/80 on January 22nd, which is still considered normal. Overall, your blood pressure appears to be well-controlled.`,
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
      },
      {
        id: '3',
        role: 'user' as const,
        content: 'Am I taking any medications for blood pressure?',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: `According to your medication records, you are not currently taking any blood pressure medications. Your records show:

**Current Medications:**
- Levothyroxine 50mcg - once daily (for thyroid)
- Vitamin D3 2000 IU - once daily (supplement)

Since your blood pressure readings are consistently in the normal range, it makes sense that you're not on any blood pressure medications. However, if you have concerns about your blood pressure or are considering starting any new medications, please consult with your healthcare provider.`,
        timestamp: new Date(Date.now() - 1 * 60 * 1000),
      },
    ]
  : [];

export function useAIChat({ fhirBundle }: UseAIChatProps): UseAIChatReturn {
  const [messages, setMessages] = useState(MOCK_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[0]!);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      // Cancel the previous request if abort controller exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create a new controller for the current request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Add user message
      const userChatMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      let currentHistory: ChatMessage[] = [];
      setMessages(prev => {
        currentHistory = prev;
        return [...prev, userChatMessage];
      });

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Search health records for relevant context
        const { context } = HealthRecordSearch.searchRecords(fhirBundle, userMessage);

        // Step 2: Call your backend API
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: userMessage,
            healthContext: context,
            model: selectedModel.id,
            provider: selectedModel.provider,
            conversationHistory: currentHistory.slice(-6),
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          model: selectedModel.name,
        };

        setMessages(prev => [...prev, assistantMessage]);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request Aborted');
          return;
        }

        console.error('Error sending message:', err);
        const errorMessage: ChatError = {
          message: err instanceof Error ? err.message : 'Failed to send message',
        };
        setError(errorMessage);

        // Add error message to chat
        const errorChatMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorChatMessage]);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      }
    },
    [fhirBundle, selectedModel]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    selectedModel,
    availableModels: AVAILABLE_MODELS,
    sendMessage,
    setSelectedModel,
    clearChat,
  };
}
