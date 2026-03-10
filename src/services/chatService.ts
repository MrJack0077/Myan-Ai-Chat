import { io, Socket } from "socket.io-client";

interface Message {
  room: string;
  sender: string;
  message: string;
  timestamp: string;
  senderRole: 'VENDOR' | 'ADMIN';
}

class ChatService {
  private socket: Socket | null = null;
  private messageHandlers: ((message: Message) => void)[] = [];

  connect() {
    if (this.socket) return;

    // Connect to the same origin where the app is served
    this.socket = io(window.location.origin, {
      transports: ["websocket"]
    });

    this.socket.on("receive_message", (data: Message) => {
      this.messageHandlers.forEach(handler => handler(data));
    });

    this.socket.on("connect", () => {
      console.log("Connected to chat server");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from chat server");
    });
  }

  joinRoom(room: string) {
    if (!this.socket) this.connect();
    this.socket?.emit("join_room", room);
  }

  sendMessage(room: string, sender: string, message: string, senderRole: 'VENDOR' | 'ADMIN') {
    if (!this.socket) this.connect();
    const data: Message = {
      room,
      sender,
      message,
      timestamp: new Date().toISOString(),
      senderRole
    };
    this.socket?.emit("send_message", data);
  }

  onMessage(handler: (message: Message) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const chatService = new ChatService();
export type { Message };
