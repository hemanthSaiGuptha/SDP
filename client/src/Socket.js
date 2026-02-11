import { io } from "socket.io-client";

export const initSocket = async () => {
  const options = {
    transports: ["websocket"],
    cors: {
      origin: "http://localhost:3000", // your frontend
      methods: ["GET", "POST"],
    },
  };
  return io("http://localhost:5000", options); // your backend socket server
};
