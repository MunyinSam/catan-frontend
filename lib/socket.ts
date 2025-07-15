import { io, Socket } from 'socket.io-client';

const backendUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://catan-backend-bwva.onrender.com'
    : 'http://localhost:4000';

export const socket: Socket = io(backendUrl);