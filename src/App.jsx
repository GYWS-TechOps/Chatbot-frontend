import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hello! How can I help you with GYWS Queries?", sender: "bot", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState(() => 'user_' + Math.random().toString(36).substring(2, 15));
  const chatbotRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleClickOutside = (event) => {
    if (chatbotRef.current && !chatbotRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      scrollToBottom();
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, messages]);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;
    const userMessage = { text: input, sender: "user", timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const queryResponse = await fetch("http://localhost:8000/query/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input,
          user_id: userId,
          use_web_search: true,
        }),
      });
      const queryData = await queryResponse.json();
      const requestId = queryData.request_id;

      let completed = false;
      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`http://localhost:8000/status/${requestId}`);
        const statusData = await statusResponse.json();
        completed = statusData.completed;
      }

      const resultResponse = await fetch(`http://localhost:8000/result/${requestId}/${userId}`);
      const resultData = await resultResponse.json();
      if (resultData.completed) {
        setMessages((prev) => [
          ...prev,
          { text: resultData.answer, sender: "bot", timestamp: new Date() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { text: "Error: No answer found.", sender: "bot", timestamp: new Date() },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { text: "Sorry, there was an error processing your request.", sender: "bot", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const handleClearChat = async () => {
    try {
      await fetch(`http://localhost:8000/conversation/${userId}`, { method: "DELETE" });
      setMessages([
        { text: "Chat cleared. I'm ready to answer questions about the predefined PDF.", sender: "bot", timestamp: new Date() }
      ]);
    } catch (error) {
      console.error("Error clearing conversation:", error);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={chatbotRef}>
      {isOpen && (
        <div className={`w-[500px] max-w-[90vw] h-[800px] bg-white rounded-3xl shadow-2xl flex flex-col absolute bottom-16 right-0 transform transition-all duration-300 ease-in-out border border-gray-100 overflow-hidden ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}>
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-4 rounded-t-3xl flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight">GYaani</h2>
            <button className="p-1 hover:bg-white/10 rounded-full transition-colors" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="flex-grow p-5 overflow-y-auto bg-gray-50/50 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm transition-all duration-200 ${
                  msg.sender === "bot" 
                    ? "bg-white text-gray-800" 
                    : "bg-indigo-500 text-white"
                }`}>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    {msg.sender === "bot" ? (
                      <span className="text-indigo-500">🤖</span>
                    ) : (
                      <span className="text-white">👤</span>
                    )}
                    <span>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Render bot messages as HTML, user messages as plain text */}
                  {msg.sender === "bot" ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <span className="text-indigo-500">🤖</span>
                    <span>
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-center gap-3">
              <input
                type="text"
                className="flex-1 py-2.5 px-4 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about the PDF..."
                disabled={isLoading}
              />
              <button 
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleClearChat}
                title="Clear Chat"
              >
                <Trash2 size={18} className="text-gray-600" />
              </button>
              <button
                className="p-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white transition-all duration-200 disabled:bg-indigo-300 disabled:cursor-not-allowed group"
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                <Send size={18} className="group-hover:scale-110 transition-transform duration-200" />
              </button>
            </div>
          </div>
        </div>
      )}
      <button 
        className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        onClick={handleToggle}
      >
        <MessageCircle size={24} className={`${isOpen ? "rotate-180" : "rotate-0"} transition-transform duration-300`} />
      </button>
    </div>
  );
}