import { useEffect, useRef, useState } from 'react';
import { createRoom, joinRoom } from './signaling';
import './App.css';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const stopTracks = (stream) => stream?.getTracks().forEach((track) => track.stop());

function App() {
  const pcRef = useRef();
  const stopSignalingRef = useRef(() => {});
  const localVideo = useRef();
  const remoteVideo = useRef();

  const [roomId, setRoomId] = useState('');
  const [ready, setReady] = useState(false);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    let stream;
    let cancelled = false;
    pcRef.current = pc;

    const startCamera = async () => {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (cancelled) return stopTracks(media);

      stream = media;
      localVideo.current.srcObject = media;
      media.getTracks().forEach((track) => pc.addTrack(track, media));
      setReady(true);
    };

    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };
    startCamera().catch(console.error);

    return () => {
      cancelled = true;
      stopTracks(stream);
      stopSignalingRef.current();
      pc.close();
    };
  }, []);

  // Runs a create/join action and remembers how to stop its Firestore listeners
  const start = async (action) => {
    setInCall(true);
    try {
      stopSignalingRef.current = await action();
    } catch (error) {
      setInCall(false);
      alert(error.message);
    }
  };

  const create = () =>
    start(async () => {
      const room = await createRoom(pcRef.current);
      setRoomId(room.roomId);
      return room.stop;
    });

  const join = () => start(() => joinRoom(pcRef.current, roomId.trim()));

  return (
    <div className="App">
      <h1>WebRTC Video Call</h1>

      <input
        placeholder="Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={create} disabled={!ready || inCall}>Create room</button>
      <button onClick={join} disabled={!ready || inCall || !roomId}>Join room</button>

      <div className="videos">
        <video ref={localVideo} autoPlay playsInline muted />
        <video ref={remoteVideo} autoPlay playsInline />
      </div>
    </div>
  );
}

export default App;
