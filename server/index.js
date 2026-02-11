import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Room from "./models/Room.js";

dotenv.config();

// ================= APP CONFIG =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= SERVER SETUP =================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ================= MONGODB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ================= GEMINI SETUP =================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ================= AI CHAT ENDPOINT =================
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Please enter a message." });
    }

    const result = await model.generateContent(
      `You are an AI coding assistant. Keep answers short and clear.\n\nUser: ${message}`
    );

    const reply = result.response.text();
    res.json({ reply });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({
      reply: "⚠️ AI Assistant unavailable",
    });
  }
});

// ================= SOCKET.IO =================
const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("✅ New client:", socket.id);

  // JOIN ROOM
  socket.on("join", async ({ roomId, username }) => {
    userSocketMap[socket.id] = { username, roomId };
    socket.join(roomId);

    let room = await Room.findOne({ roomId });

    if (!room) {
      room = await Room.create({
        roomId,
        files: [{ name: "main.py", content: "" }],
      });
    }

    socket.emit("initialize-files", room.files);

    const clients = [...(io.sockets.adapter.rooms.get(roomId) || [])].map(
      (id) => ({
        socketId: id,
        username: userSocketMap[id]?.username || "Anonymous",
      })
    );

    io.to(roomId).emit("joined", { clients });
  });

  // CODE CHANGE
  socket.on("code-change", async ({ roomId, code, fileIndex }) => {
    const room = await Room.findOne({ roomId });
    if (room && room.files[fileIndex]) {
      room.files[fileIndex].content = code;
      room.updatedAt = Date.now();
      await room.save();
    }

    socket.to(roomId).emit("code-change", { code, fileIndex });
  });

  // ADD FILE
  socket.on("add-file", async ({ roomId, file }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    room.files.push(file);
    await room.save();

    io.to(roomId).emit("file-added", {
      file,
      fileIndex: room.files.length - 1,
    });
  });

  // DELETE FILE
  socket.on("delete-file", async ({ roomId, fileIndex }) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    room.files.splice(fileIndex, 1);
    await room.save();

    io.to(roomId).emit("file-deleted", { fileIndex });
  });

  // CHAT
  socket.on("chat-message", ({ roomId, username, message, timestamp }) => {
    io.to(roomId).emit("chat-message", {
      username,
      message,
      timestamp,
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const { roomId } = userSocketMap[socket.id] || {};
    delete userSocketMap[socket.id];

    if (roomId) {
      io.to(roomId).emit("disconnected", {
        socketId: socket.id,
      });
    }
  });
});

// ================= JDoodle RUN CODE =================
app.post("/run", async (req, res) => {
  const { language, code } = req.body;

  const langMap = {
    python: "python3",
    java: "java",
    cpp: "cpp17",
    javascript: "nodejs",
  };

  try {
    const response = await fetch("https://api.jdoodle.com/v1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script: code,
        language: langMap[language] || "python3",
        versionIndex: "4",
      }),
    });

    const data = await response.json();
    res.json({ output: data.output || data.error });
  } catch (err) {
    console.error("JDoodle Error:", err);
    res.json({ output: "Error running code" });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
