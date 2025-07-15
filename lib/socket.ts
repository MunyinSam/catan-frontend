// lib/socket.ts
import { io, Socket } from 'socket.io-client';

export const socket: Socket = io('http://localhost:4000');
// export const socket: Socket = io('https://catan-backend-bwva.onrender.com');
