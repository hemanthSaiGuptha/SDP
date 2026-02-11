// src/components/EditorPage.js

import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useLocation, useParams, useNavigate } from "react-router-dom";

// CodeMirror Core
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";

// Themes
import "codemirror/theme/dracula.css";
import "codemirror/theme/eclipse.css";

// Modes (Languages)
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/clike/clike"; // Used for C, C++, Java

// Addons: Hinting (Autocompletion)
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/show-hint.js";
import "codemirror/addon/hint/javascript-hint.js";
import "codemirror/addon/hint/anyword-hint.js";

// Addons: Editing Features
import "codemirror/addon/edit/closebrackets.js"; // Auto-close parentheses, brackets, quotes
import "codemirror/addon/edit/matchbrackets.js"; // Highlight matching brackets
import "codemirror/addon/edit/closetag.js"; // Auto-close HTML/XML tags (useful for JS frameworks)

// Addons: Appearance/Utility
import "codemirror/addon/selection/active-line.js"; // Highlight the active line
import "codemirror/addon/fold/foldcode.js"; // Core folding logic
import "codemirror/addon/fold/foldgutter.js"; // Gutter for folding marks
import "codemirror/addon/fold/brace-fold.js"; // Folding for braces {}
import "codemirror/addon/fold/indent-fold.js"; // Folding based on indentation
import "codemirror/addon/fold/comment-fold.js"; // Folding for comments
import "codemirror/addon/fold/foldgutter.css"; // CSS for fold gutter

// Custom Imports
import { ACTIONS } from "../Actions"; // Assuming this path is correct
import "./EditorPage.css"; // Assuming the stylesheet is correct

// =====================================================
// 💡 HINTING UTILITY FUNCTIONS
// =====================================================

/**
 * Extends the default anyword hint to include common programming keywords.
 * @param {CodeMirror.Editor} editor
 * @returns {Object} Hint object
 */
const customAnyWordHint = (editor) => {
    const standardHint = CodeMirror.hint.anyword(editor);
    const commonKeywords = [
        "print", "range", "import", "def", "class", "for", "while",
        "const", "let", "var", "function", "public", "private", "static",
        "if", "else", "return", "await", "async", "try", "catch", "throw",
        "System", "out", "println", "void", "main" // Added some Java/C++ basics
    ];

    const combinedList = [
        ...new Set([...(standardHint ? standardHint.list : []), ...commonKeywords]),
    ].sort();

    return {
        list: combinedList,
        from: standardHint ? standardHint.from : editor.getCursor(),
        to: standardHint ? standardHint.to : editor.getCursor(),
    };
};

/**
 * Provides basic method hints when the dot operator is typed.
 * @param {CodeMirror.Editor} editor
 * @param {string} language
 * @returns {Object|null} Hint object
 */
const getDotOperatorHint = (editor, language) => {
    let methodList = [];

    if (language === 'python') {
        methodList = [
            'append', 'extend', 'insert', 'remove', 'pop', 'clear',
            'keys', 'values', 'items', 'split', 'join', 'format',
            'strip', 'lower', 'upper'
        ];
    } else if (language === 'javascript') {
        methodList = [
            'map', 'filter', 'reduce', 'forEach', 'push', 'pop',
            'slice', 'splice', 'includes', 'indexOf', 'length', 'log',
            'constructor', 'prototype'
        ];
    }

    if (methodList.length === 0) return null;

    return {
        list: methodList.sort(),
        from: editor.getCursor(),
        to: editor.getCursor(),
    };
}


const EditorPage = () => {
    // =====================================================
    // 🏠 STATE DECLARATIONS
    // =====================================================
    const editorRef = useRef(null);
    const socketRef = useRef(null);
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [language, setLanguage] = useState("python");
    const [output, setOutput] = useState("");
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState([{ name: "main.py", content: "" }]);
    const [menuIndex, setMenuIndex] = useState(null); // For file tab context menu
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [userCursors, setUserCursors] = useState({});
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dracula");

    // 🧠 AI Assistant State (Integrated)
    const [showAIChat, setShowAIChat] = useState(false);
    const [aiMessages, setAiMessages] = useState([
        { sender: "ai", text: "Hi! I'm your coding assistant. Ask me anything about your code or tasks." },
    ]);
    const [aiInput, setAiInput] = useState("");

    // Routing Hooks
    const location = useLocation();
    const { roomId } = useParams();
    const username = location.state?.username || "Anonymous";
    const navigate = useNavigate();

    // =====================================================
    // 🧠 AI Assistant Handler
    // =====================================================
    const handleAISend = async () => {
        if (!aiInput.trim()) return;

        const code = editorRef.current ? editorRef.current.getValue() : "";
        const userMsg = { sender: "user", text: aiInput };

        // 1. Add user message and clear input
        setAiMessages((prev) => [...prev, userMsg]);
        const currentInput = aiInput;
        setAiInput("");

        // 2. Simulate API Call (Replace with actual fetch to your backend)
        const loadingMsg = { sender: "ai", text: "Thinking...", isTemp: true };
        setAiMessages((prev) => [...prev, loadingMsg]);

        try {
            // Placeholder: Replace with your actual AI endpoint logic
            const res = await fetch("http://localhost:5000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: currentInput, code, language, roomId, username }),
            });

            // 3. Remove loading message
            setAiMessages((prev) => prev.filter(msg => !msg.isTemp));

            if (!res.ok) throw new Error("AI server responded with an error.");

            const data = await res.json();
            const replyText = data.reply || `I processed your request about: "${currentInput}". The AI service didn't return a specific reply.`;

            setAiMessages((prev) => [...prev, { sender: "ai", text: replyText }]);

        } catch (err) {
            console.error("AI Chat Error:", err);
            // 4. Remove loading message and add error message
            setAiMessages((prev) => prev.filter(msg => !msg.isTemp));
            setAiMessages((prev) => [
                ...prev,
                { sender: "ai", text: `⚠️ Error: Could not connect to AI service. Check the server is running. (${err.message})` },
            ]);
        }
    };

    // 🌗 Theme Toggle Function
    const toggleTheme = () => {
        const newTheme = theme === "dracula" ? "eclipse" : "dracula";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        if (editorRef.current) {
            editorRef.current.setOption("theme", newTheme);
        }
    };


    // =====================================================
    //                 SOCKET CONNECTION & SETUP
    // =====================================================
    useEffect(() => {
        socketRef.current = io("http://localhost:5000");

        socketRef.current.on("connect", () => {
            socketRef.current.emit(ACTIONS.JOIN, { roomId, username });
        });

        // User/Peer Management
        socketRef.current.on(ACTIONS.JOINED, ({ clients }) => setConnectedUsers(clients));
        socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId }) =>
            setConnectedUsers((prev) => prev.filter((u) => u.socketId !== socketId))
        );

        // Chat Synchronization
        socketRef.current.on("chat-message", ({ username: msgUser, message: msgText, timestamp }) =>
            setMessages((prev) => [...prev, { username: msgUser, message: msgText, timestamp }])
        );

        // Code Synchronization
        socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code, fileIndex }) => {
            setFiles((prev) => {
                const updated = [...prev];
                if (updated[fileIndex]) {
                    updated[fileIndex].content = code;
                    // Only update CodeMirror if this file is currently open and content is different
                    if (fileIndex === currentFileIndex && editorRef.current && editorRef.current.getValue() !== code) {
                        const cursor = editorRef.current.getCursor();
                        editorRef.current.setValue(code);
                        editorRef.current.setCursor(cursor);
                    }
                }
                return updated;
            });
        });

        // File Management Synchronization
        socketRef.current.on("initialize-files", (serverFiles) => {
            if (serverFiles.length > 0) setFiles(serverFiles);
        });

        socketRef.current.on("file-added", ({ file }) => {
            setFiles((prev) => {
                if (prev.find((f) => f.name === file.name)) return prev;
                return [...prev, file];
            });
        });

        socketRef.current.on("file-renamed", ({ fileIndex, newName }) => {
            setFiles((prev) => {
                const updated = [...prev];
                if (updated[fileIndex]) updated[fileIndex].name = newName;
                return updated;
            });
        });

        socketRef.current.on("file-deleted", ({ fileIndex }) => {
            setFiles((prev) => prev.filter((_, i) => i !== fileIndex));
            // Move to file index 0 if the current file was deleted
            if (fileIndex === currentFileIndex && files.length > 1) {
                 setCurrentFileIndex(0);
            } else if (files.length === 1) {
                 // Handle case where the last file is deleted (optional: recreate a default file)
                 setFiles([{ name: "main.py", content: "" }]);
                 setCurrentFileIndex(0);
            }
        });

        // Cursor Synchronization
        socketRef.current.on("cursor-change", ({ username: user, cursor }) => {
            if (user !== username) {
                setUserCursors((prev) => ({ ...prev, [user]: cursor }));
            }
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [roomId, username, currentFileIndex, navigate, files.length]);


    // =====================================================
    //                CODEMIRROR SETUP (Initialization & Code Sync)
    // =====================================================
    useEffect(() => {
        // Initialize CodeMirror instance if it doesn't exist
        const editor =
            editorRef.current ||
            CodeMirror.fromTextArea(document.getElementById("code-editor"), {
                mode:
                    language === "python"
                        ? "python"
                        : language === "java"
                        ? "text/x-java"
                        : language === "cpp"
                        ? "text/x-c++src"
                        : language === "c"
                        ? "text/x-csrc"
                        : "javascript",
                theme: theme,
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                autoCloseTags: true,
                highlightActiveLine: true,
                foldGutter: true,
                gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
                extraKeys: {
                    "Ctrl-Space": customAnyWordHint, // Custom autocompletion trigger
                    "Cmd-Space": customAnyWordHint,
                    "Tab": "autocomplete", // Use autocomplete when Tab is pressed
                    "Ctrl-Q": (cm) => { cm.foldCode(cm.getCursor()); } // Folding shortcut
                },
            });

        editorRef.current = editor;

        // Sync editor content with the current file state
        const currentFileContent = files[currentFileIndex]?.content || "";
        if (editor.getValue() !== currentFileContent) {
            const cursor = editor.getCursor();
            editor.setValue(currentFileContent);
            editor.setCursor(cursor);
            editor.refresh(); // Important for proper display after setValue
        }

        // Change Event Handler (Emit changes to other clients)
        const onChange = (instance, changes) => {
            if (changes.origin !== "setValue") {
                const updatedFiles = [...files];
                updatedFiles[currentFileIndex].content = instance.getValue();
                setFiles(updatedFiles); // Update local state immediately

                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code: instance.getValue(),
                    fileIndex: currentFileIndex,
                });
            }
        };

        // Input Read Handler (Trigger hinting automatically)
        const onInputRead = (instance, change) => {
            const charTyped = change.text[0];
            const isWordChar = /[a-zA-Z0-9_]/.test(charTyped);

            if (change.text.length === 1) {
                if (charTyped === '.') {
                    // Trigger dot operator hint
                    const dotHint = getDotOperatorHint(instance, language);
                    if (dotHint) {
                        instance.showHint({ hint: () => dotHint, completeSingle: false });
                    }
                } else if (isWordChar) {
                    // Trigger general word hint/autocompletion
                    instance.showHint({
                        hint: CodeMirror.hint.auto,
                        completeSingle: false,
                    });
                }
            }
        };

        // Cursor Activity Handler (Emit cursor position)
        const onCursorActivity = () => {
            const cursor = editor.getCursor();
            socketRef.current.emit("cursor-change", { roomId, username, cursor });
        };


        // Attach listeners
        editor.on("change", onChange);
        editor.on("inputRead", onInputRead);
        editor.on("cursorActivity", onCursorActivity);


        // Cleanup listeners
        return () => {
            editor.off("change", onChange);
            editor.off("inputRead", onInputRead);
            editor.off("cursorActivity", onCursorActivity);
        };
    }, [currentFileIndex, files, roomId, username, language, theme]);


    // =====================================================
    // 💡 UPDATE CODEMIRROR MODE & FILE EXTENSION ON LANGUAGE CHANGE
    // =====================================================
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !socketRef.current) return;

        let mode;
        let newExtension = "";
        const currentFile = files[currentFileIndex];
        const currentFileName = currentFile?.name || "file";
        const baseNameWithoutExtension = currentFileName.replace(/\.[^/.]+$/, "");

        switch (language) {
            case "python":
                mode = "python";
                newExtension = ".py";
                break;
            case "java":
                mode = "text/x-java";
                newExtension = ".java";
                break;
            case "cpp":
                mode = "text/x-c++src";
                newExtension = ".cpp";
                break;
            case "c":
                mode = "text/x-csrc";
                newExtension = ".c";
                break;
            case "javascript":
            default:
                mode = "javascript";
                newExtension = ".js";
                break;
        }

        editor.setOption("mode", mode);

        const updatedFileName = baseNameWithoutExtension + newExtension;

        // Synchronize file name change (e.g., main.js -> main.py)
        if (currentFile && currentFile.name !== updatedFileName) {
            setFiles((prev) => {
                const updated = [...prev];
                updated[currentFileIndex].name = updatedFileName;
                return updated;
            });

            socketRef.current.emit("rename-file", {
                roomId,
                fileIndex: currentFileIndex,
                newName: updatedFileName,
            });
        }
    }, [language, currentFileIndex, files, roomId]);


    // =====================================================
    //               DISPLAY OTHER USERS' CURSORS
    // =====================================================
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        // Clear existing marks (cursors)
        editor.getAllMarks().forEach((mark) => mark.clear());
        const users = Object.keys(userCursors);

        // Draw new marks
        users.forEach((user, i) => {
            const cursorPos = userCursors[user];

            // Assign a stable color based on index
            const color = `hsl(${(i * 60 + 30) % 360}, 70%, 60%)`;

            // Create the cursor element
            const cursorEl = document.createElement("span");
            cursorEl.className = "user-cursor";
            cursorEl.style.borderLeft = `2px solid ${color}`;
            cursorEl.style.height = `${editor.defaultTextHeight()}px`;
            cursorEl.title = user; // Display username on hover

            // Add the cursor as a text bookmark
            editor.getDoc().setBookmark(cursorPos, { widget: cursorEl });
        });
    }, [userCursors]);

    // =====================================================
    //                     FUNCTIONS
    // =====================================================
    const copyRoomId = async () => {
        await navigator.clipboard.writeText(roomId);
        alert("Room ID copied!");
    };

    const leaveRoom = () => navigate("/");

    const runCode = async () => {
        const code = editorRef.current.getValue();
        if (!code.trim()) return setOutput("Please enter some code.");
        setOutput("Running...");

        try {
            const response = await fetch("http://localhost:5000/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language, code }),
            });
            const data = await response.json();
            setOutput(data.output || "No output received");
        } catch (error) {
            console.error("Run code error:", error);
            setOutput("Error connecting to backend execution server.");
        }
    };

    const sendMessage = () => {
        if (!message.trim()) return;
        const now = new Date();
        const timestamp = `${now.getDate().toString().padStart(2, "0")}/${
            (now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;

        socketRef.current.emit("chat-message", { roomId, username, message, timestamp });
        setMessage("");
    };

    const downloadCode = () => {
        const code = editorRef.current.getValue();
        if (!code.trim()) return alert("No code to download!");

        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = files[currentFileIndex]?.name || "file.txt";
        link.click();
    };


    // =====================================================
    //                      RENDER UI
    // =====================================================
    return (
        <div className="main-container">

            {/* --- HEADER/CONTROL BAR (Top Toolbar) --- */}
            <div className="header-bar">
                <div className="header-title">
                    Collaborative Editor
                </div>

                {/* Controls & Theme Toggle Group */}
                <div className="controls-group">

                    {/* Theme Toggle */}
                    <div className="theme-toggle">
                        <button onClick={toggleTheme} className="action-button secondary">
                            {theme === "dracula" ? "Light Mode" : "Dark Mode"}
                        </button>
                    </div>

                    {/* Language Selection & Run Button */}
                    <div className="lang-select-container">
                        <label htmlFor="lang-select" className="lang-select-label">Language:</label>
                        <select
                            id="lang-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="lang-select"
                        >
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                            <option value="c">C</option>
                        </select>
                        <button onClick={runCode} className="action-button primary" style={{ marginLeft: '10px' }}>
                            Run Code
                        </button>
                    </div>

                    {/* Room Actions */}
                    <div>
                        <button onClick={copyRoomId} className="action-button secondary" style={{ marginRight: "8px" }}>
                            Copy Room ID
                        </button>
                        <button onClick={downloadCode} className="action-button secondary" style={{ marginRight: "8px" }}>
                            Download
                        </button>
                        <button onClick={leaveRoom} className="action-button danger">
                            Leave
                        </button>
                    </div>
                </div>
            </div>
            {/* --- END HEADER/CONTROL BAR --- */}

            <div className="editor-main">

                {/* ================= LEFT PANEL (Editor Area) ================= */}
                <div className="editor-area">

                    {/* File Tabs */}
                    <div className="file-tabs-bar">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className={`file-tab ${index === currentFileIndex ? 'active' : ''}`}
                            >
                                {/* File Button */}
                                <button
                                    onClick={() => setCurrentFileIndex(index)}
                                    className="file-tab-button"
                                >
                                    {file.name}
                                </button>

                                {/* Dots menu - Using CSS Classes */}
                                <div className="file-menu">
                                    <button
                                        className="file-menu-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuIndex(menuIndex === index ? null : index);
                                        }}
                                    >
                                        &#8942; {/* Vertical ellipsis */}
                                    </button>

                                    {/* Rename & Delete Logic Dropdown */}
                                    {menuIndex === index && (
                                        <div className="file-menu-dropdown">
                                            <button
                                                onClick={() => {
                                                    const newName = prompt("Enter new file name:", file.name);
                                                    if (newName && newName.trim() !== "") {
                                                        socketRef.current.emit("rename-file", {
                                                            roomId,
                                                            fileIndex: index,
                                                            newName,
                                                        });
                                                    }
                                                    setMenuIndex(null);
                                                }}
                                            >
                                                Rename
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => {
                                                    if (window.confirm(`Delete ${file.name}?`)) {
                                                        socketRef.current.emit("delete-file", { roomId, fileIndex: index });
                                                    }
                                                    setMenuIndex(null);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Add File Button */}
                        <button
                            onClick={() => {
                                let newExtension = ".py";
                                if (language === "javascript") newExtension = ".js";
                                else if (language === "java") newExtension = ".java";
                                else if (language === "cpp") newExtension = ".cpp";
                                else if (language === "c") newExtension = ".c";

                                const existingCount = files.filter(f => f.name.endsWith(newExtension)).length;

                                let defaultName;
                                if (files.length === 0) {
                                    defaultName = `main${newExtension}`;
                                } else {
                                    const nextIndex = existingCount + 1;
                                    defaultName = `script${nextIndex}${newExtension}`;
                                }

                                const newFile = { name: defaultName, content: "" };
                                socketRef.current.emit("add-file", { roomId, file: newFile });
                            }}
                            className="add-file-button"
                        >
                            + New File
                        </button>
                    </div>

                    {/* Editor Container */}
                    <div id="monaco-container">
                        <textarea id="code-editor" style={{ display: 'none' }} />
                    </div>

                    {/* === Floating AI Chat Button === */}
                    {!showAIChat && (
                        <button className="ai-float-btn" onClick={() => setShowAIChat(true)}>
                            AI Chat
                        </button>
                    )}

                    {/* === AI Chat Panel === */}
                    {showAIChat && (
                        <div className="ai-chat-panel">
                            <div className="ai-chat-header">
                                <button className="back-btn" onClick={() => setShowAIChat(false)}>
                                    &larr; Back
                                </button>
                                <h3>AI Assistant</h3>
                            </div>

                            <div className="ai-chat-body">
                                {aiMessages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`ai-msg ${msg.sender === "user" ? "user" : "bot"}`}
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                            </div>

                            <div className="ai-chat-input">
                                <input
                                    type="text"
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder="Ask about your code..."
                                    onKeyDown={(e) => e.key === "Enter" && handleAISend()}
                                />
                                <button onClick={handleAISend} disabled={!aiInput.trim()}>Send</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ================= RIGHT PANEL (Users, Output, Chat) ================= */}
                <div className="side-panel">

                    {/* Active Peers Section */}
                    <div className="panel-section">
                        <h4 className="panel-title">Active Peers ({connectedUsers.length})</h4>
                        <ul className="peer-list">
                            {connectedUsers.map((user, idx) => (
                                <li key={idx} className="peer-item">
                                    <span className="peer-status-dot"></span>
                                    {user.username || "Anonymous"}
                                    {user.username === username && <span style={{color: '#007acc', marginLeft: '5px', fontWeight: 'bold'}}>(You)</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <hr/>

                    {/* Execution Output Section */}
                    <div className="panel-section">
                        <h4 className="panel-title">Execution Output</h4>
                        <pre className="output-area">{output}</pre>
                    </div>
                    
                    <hr/>

                    {/* Chat Section */}
                    <div className="panel-section" style={{ flexGrow: 1 }}>
                        <h4 className="panel-title">Room Chat</h4>
                        <div className="chat-messages">
                            {messages.map((msg, index) => (
                                <div key={index} className="chat-message">
                                    <strong className="chat-username">{msg.username}: </strong>
                                    <p className="chat-text">{msg.message}</p>
                                    <div className="chat-timestamp">{msg.timestamp}</div>
                                </div>
                            ))}
                        </div>

                        <div className="chat-input-group">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                placeholder="Message the room..."
                                className="chat-input"
                            />
                            <button
                                onClick={sendMessage}
                                className="chat-send-button"
                                disabled={!message.trim()}
                            >Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditorPage;