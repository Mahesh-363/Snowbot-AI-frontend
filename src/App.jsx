import { useState, useEffect, useRef } from "react";

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = "llama-3.3-70b-versatile";

async function callGroq(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 1024 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Error getting response.";
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem("chatSessions")) || [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem("chatSessions", JSON.stringify(sessions));
}

export default function App() {
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const activeSession = sessions.find((s) => s.id === activeId);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  function newChat() {
    const id = generateId();
    setSessions((prev) => [
      { id, title: "New Chat", messages: [] },
      ...prev,
    ]);
    setActiveId(id);
    setSidebarOpen(false);
  }

  function deleteSession(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!GROQ_KEY) {
      alert("Add VITE_GROQ_API_KEY to your .env file");
      return;
    }

    let sessionId = activeId;
    if (!sessionId) {
      sessionId = generateId();
      setSessions((prev) => [
        { id: sessionId, title: input.slice(0, 30), messages: [] },
        ...prev,
      ]);
      setActiveId(sessionId);
    }

    const userMsg = { role: "user", content: input.trim() };
    setInput("");
    setLoading(true);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? userMsg.content.slice(0, 30) : s.title,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    try {
      const current = sessions.find((s) => s.id === sessionId);
      const history = [...(current?.messages || []), userMsg];
      const systemMsg = {
        role: "system",
        content: "You are SnowBot AI, a helpful, accurate, and concise AI assistant.",
      };
      const reply = await callGroq([systemMsg, ...history]);
      const assistantMsg = { role: "assistant", content: reply };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, assistantMsg] }
            : s
        )
      );
    } catch (e) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  { role: "assistant", content: "Error: " + e.message },
                ],
              }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="app-container">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <span className="logo">❄️ SnowBot AI</span>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <button className="new-chat-btn" onClick={newChat}>
          + New Chat
        </button>

        <div className="sessions-list">
          {sessions.length === 0 && (
            <p className="no-sessions">No conversations yet</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => {
                setActiveId(s.id);
                setSidebarOpen(false);
              }}
            >
              <span className="session-title">{s.title || "New Chat"}</span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <p>Powered by Groq · Llama 3.3</p>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="topbar-title">
            {activeSession?.title || "SnowBot AI"}
          </span>
          <button className="new-btn-top" onClick={newChat}>+</button>
        </header>

        {/* Messages */}
        <div className="messages-area">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">❄️</div>
              <h1>SnowBot AI</h1>
              <p>Your intelligent assistant powered by Llama 3.3</p>
              <div className="suggestions">
                {["Explain quantum computing", "Write a Python function", "What is machine learning?", "Help me plan my day"].map((s) => (
                  <button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeSession.messages.map((msg, i) => (
                <div key={i} className={`message-row ${msg.role}`}>
                  <div className="avatar">
                    {msg.role === "user" ? "👤" : "❄️"}
                  </div>
                  <div className="bubble">
                    <pre className="message-text">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message-row assistant">
                  <div className="avatar">❄️</div>
                  <div className="bubble">
                    <div className="typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message SnowBot AI..."
              rows={1}
              disabled={loading}
            />
            <button
              className={`send-btn ${loading || !input.trim() ? "disabled" : ""}`}
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              {loading ? "⏳" : "➤"}
            </button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </main>
    </div>
  );
}