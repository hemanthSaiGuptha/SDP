import React, { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  // --- State Hooks ---
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  
  // --- Navigation Hook ---
  const navigate = useNavigate();

  // ✅ NEW FLOW: Only create and fill the Room ID, DO NOT navigate immediately.
  const createNewRoom = useCallback((event) => {
    event.preventDefault();
    
    const newId = uuid();
    setRoomId(newId);
    
    // 📝 Style change: Use toast.success for a clear visual confirmation.
    toast.success('New Room ID generated! Enter your username and click JOIN.', {
        duration: 4000
    });
    
  }, []); // Dependencies are removed as we only need to set the Room ID, not check username.

  // ✅ Join an existing room (Logic is UNCHANGED)
  const handleJoinRoom = useCallback(() => {
    if (!roomId.trim() || !username.trim()) {
      toast.error('Both Room ID and Username are required!');
      return;
    }

    navigate(`/editor/${roomId}`, {
      state: { username },
    });
    toast.success('Joined room successfully!');
  }, [roomId, username, navigate]);

  // ✅ Join when pressing Enter key (Logic is UNCHANGED)
  const handleInputEnter = useCallback((event) => {
    const { code } = event;
    if (code === 'Enter') {
      handleJoinRoom();
    }
  }, [handleJoinRoom]);

  // --- Rendered JSX (Styling is the same as the last version) ---
  return (
    <div className="container-fluid">
      <div className="row justify-content-center align-items-center min-vh-100">
        <div className="col-12 col-sm-8 col-md-6 col-lg-4">
          <div className="card bg-dark text-white border-0 shadow-lg p-3"> 
            <div className="card-body text-center">
              <img
                src="/images/codecast.png"
                alt="Codecast Logo"
                className="img-fluid mx-auto mb-4"
                style={{ maxWidth: '120px' }}
              />
              <h4 className="card-title mb-4 fw-light">
                Enter Room Details
              </h4>

              <div className="mb-3">
                <input
                  type="text"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)} 
                  className="form-control form-control-lg bg-secondary text-white border-0"
                  placeholder="ROOM ID"
                  onKeyUp={handleInputEnter}
                />
              </div>
              <div className="mb-4">
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="form-control form-control-lg bg-secondary text-white border-0"
                  placeholder="USERNAME"
                  onKeyUp={handleInputEnter}
                />
              </div>

              <button
                onClick={handleJoinRoom}
                className="btn btn-success w-100 py-2 mb-3"
              >
                JOIN ROOM
              </button>

              <p className="mt-3 text-muted">
                Don’t have a Room ID?{' '}
                <span
                  onClick={createNewRoom}
                  className="text-info"
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create New Room
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;