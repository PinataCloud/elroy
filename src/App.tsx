import { useState, useRef, useEffect } from "react";
import { Send, Plus, History, Trash2, MessageSquare } from "lucide-react";
import type { Message, SignTypedDataFunction } from "./utils/types";
import { createWalletClient, custom } from "viem";
import "viem/window";
import { baseSepolia } from "viem/chains";
import { useAccount } from "wagmi";
import { wrapBrowserFetchWithPayment } from "./utils/x402Proxy";
import WalletOptions from "./WalletOptions";

const DB_NAME = "ChatHistory";
const DB_VERSION = 1;
const STORE_NAME = "chats";

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event?.target?.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
};

const saveChat = async (chat: Message) => {
  const db: any = await openDB();
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  await store.put(chat);
};

const loadChats = async () => {
  const db: any = await openDB();
  const transaction = db.transaction([STORE_NAME], "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index("timestamp");
  const request = index.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
};

const deleteChat = async (chatId: string) => {
  const db: any = await openDB();
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  await store.delete(chatId);
};

const RetroMacOSChat = () => {
  const [currentChatId, setCurrentChatId] = useState(() => Date.now().toString());
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef: any = useRef(null);
  const inputRef: any = useRef(null);

  const account = useAccount();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const chats = (await loadChats()) as Message[];
      setChatHistory(chats);
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const generateChatTitle = (msgs: Message[]) => {
    const userMessage = msgs.find((m) => m.role === "user");
    if (userMessage) {
      return userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? "..." : "");
    }
    return "New Chat";
  };

  const startNewChat = () => {
    setCurrentChatId(Date.now().toString());
    setMessages([
      {
        role: "assistant",
        content: "Hello! I'm your AI assistant. How can I help you today?",
      },
    ]);
    setShowHistory(false);
  };

  const loadChat = (chat: any) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setShowHistory(false);
  };

  const deleteChatHistory = async (chatId: string, e: any) => {
    e.stopPropagation();
    try {
      await deleteChat(chatId);
      await loadChatHistory();
      if (currentChatId === chatId) {
        startNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const handleSubmit = async (e: any) => {
    if (!window.ethereum || !account.address) {
      return;
    }
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages: any = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    const walletClient = createWalletClient({
      account: account.address,
      chain: baseSepolia,
      transport: custom(window.ethereum),
    });

    // Create signTypedData function for x402
    const signTypedData: SignTypedDataFunction = async (typedData) => {
      return await walletClient.signTypedData({
        account: account.address,
        ...typedData,
      });
    };

    // Create x402 fetch function
    const fetchWithPayment = wrapBrowserFetchWithPayment(
      account.address,
      signTypedData,
      BigInt(100000), // Max 0.1 USDC
    );

    try {
      const response = await fetchWithPayment("https://402.jetson.computer/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2",
          messages: newMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.trim() === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(line);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                setStreamingMessage(assistantMessage);
              }
            } catch (parseError: any) {
              console.log("Skipping unparseable chunk:", line);
              console.log(parseError);
            }
          }
        }
      }

      if (assistantMessage) {
        const finalMessages: any = [
          ...newMessages,
          { role: "assistant", content: assistantMessage },
        ];
        setMessages(finalMessages);

        // Auto-save after each response
        setTimeout(async () => {
          const chat: any = {
            id: currentChatId,
            messages: finalMessages,
            timestamp: Date.now(),
            title: generateChatTitle(finalMessages),
          };
          await saveChat(chat);
          await loadChatHistory();
        }, 100);
      }
      setStreamingMessage("");
    } catch (error) {
      console.error("Error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-200 to-gray-300 p-4 font-mono">
      <div className="max-w-6xl mx-auto flex gap-4">
        {/* Sidebar */}
        {showHistory && (
          <div className="w-80 bg-gray-100 border-2 border-gray-400 rounded-lg shadow-lg overflow-hidden">
            {/* Sidebar Title Bar */}
            <div className="bg-gradient-to-b from-gray-300 to-gray-400 border-b border-gray-500 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History size={16} className="text-gray-800" />
                <span className="text-sm font-bold text-gray-800">Chat History</span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-3 h-3 bg-red-500 rounded-full border border-red-600 hover:bg-red-400"
              ></button>
            </div>

            {/* Chat List */}
            <div className="h-96 bg-white border-2 border-inset border-gray-300 m-2 overflow-y-auto">
              <div className="p-2 space-y-1">
                {chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => loadChat(chat)}
                    className={`p-3 rounded border cursor-pointer hover:bg-gray-50 flex items-center justify-between ${
                      currentChatId === chat.id
                        ? "bg-blue-100 border-blue-300"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{chat.title}</div>
                      <div className="text-xs text-gray-500">{formatDate(chat.timestamp)}</div>
                      <div className="text-xs text-gray-400">{chat.messages.length} messages</div>
                    </div>
                    <button
                      onClick={(e) => deleteChatHistory(chat.id, e)}
                      className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {chatHistory.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">No chat history yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Window */}
        <div className="flex-1 bg-gray-100 border-2 border-gray-400 rounded-lg shadow-lg overflow-hidden">
          {/* Title Bar */}
          <div className="bg-gradient-to-b from-gray-300 to-gray-400 border-b border-gray-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <button className="w-3 h-3 bg-red-500 rounded-full border border-red-600 hover:bg-red-400"></button>
                <button className="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-600 hover:bg-yellow-400"></button>
                <button className="w-3 h-3 bg-green-500 rounded-full border border-green-600 hover:bg-green-400"></button>
              </div>
            </div>
            <div className="text-sm font-bold text-gray-800 tracking-wide">AI Assistant</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-1 bg-gradient-to-b from-gray-200 to-gray-300 border border-gray-400 rounded text-xs font-bold text-gray-800 hover:from-gray-300 hover:to-gray-400 flex items-center space-x-1"
              >
                <History size={12} />
                <span>History</span>
              </button>
              <button
                onClick={startNewChat}
                className="px-3 py-1 bg-gradient-to-b from-gray-200 to-gray-300 border border-gray-400 rounded text-xs font-bold text-gray-800 hover:from-gray-300 hover:to-gray-400 flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Chat Area */}
          {account.isConnected ? (
            <div className="h-96 bg-white border-2 border-inset border-gray-300 m-2 overflow-hidden flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border-2 ${
                        message.role === "user"
                          ? "bg-blue-100 border-blue-300 text-blue-900"
                          : "bg-gray-100 border-gray-300 text-gray-900"
                      }`}
                    >
                      <div className="text-xs font-bold mb-1 uppercase tracking-wide">
                        {message.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Streaming Message */}
                {isStreaming && streamingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg border-2 bg-gray-100 border-gray-300 text-gray-900">
                      <div className="text-xs font-bold mb-1 uppercase tracking-wide">
                        Assistant
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {streamingMessage}
                        <span className="animate-pulse">|</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t-2 border-gray-300 bg-gray-50 p-3">
                <div className="flex space-x-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={isStreaming}
                    className="flex-1 px-3 py-2 border-2 border-inset border-gray-300 rounded bg-white text-sm focus:outline-none focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || isStreaming}
                    className="px-4 py-2 bg-gradient-to-b from-gray-200 to-gray-300 border-2 border-gray-400 rounded text-sm font-bold text-gray-800 hover:from-gray-300 hover:to-gray-400 disabled:from-gray-100 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:border-gray-500 active:from-gray-300 active:to-gray-400"
                  >
                    {isStreaming ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Send size={14} />
                        <span>Send</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <h3>Connect your wallet</h3>
              <WalletOptions />
            </div>
          )}

          {/* Status Bar */}
          <div className="bg-gradient-to-b from-gray-300 to-gray-400 border-t border-gray-500 px-4 py-1 flex items-center justify-between text-xs text-gray-800">
            <div className="flex items-center space-x-4">
              <span>Connected</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Ready</span>
              </div>
              {currentChatId && (
                <div className="flex items-center space-x-1">
                  <MessageSquare size={12} />
                  <span>Chat #{currentChatId.slice(-4)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>{chatHistory.length} saved chats</span>
              <span>{messages.length} messages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetroMacOSChat;
