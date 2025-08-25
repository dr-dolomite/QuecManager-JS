import React, { useState, useEffect, useRef } from 'react';

const WebSocketComponent = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://192.168.224.1:8838');
    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsOpen(true);
    };
    ws.current.onmessage = (event) =>
      setMessages((prev) => [...prev, event.data]);
    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsOpen(false);
    };
    return () => {
      if (
        ws.current &&
        ws.current.readyState !== WebSocket.CLOSED &&
        ws.current.readyState !== WebSocket.CLOSING
      ) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && message.trim()) {
      ws.current.send(message);
      setMessage('');
    }
  };

  return (
    <div>
      <h1>WebSocket Chat</h1>
      <div>
        {messages.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message"
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default WebSocketComponent;