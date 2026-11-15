import { addDoc, collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Firestore layout:
//   rooms/{roomId}                      -> { offer, answer }
//   rooms/{roomId}/callerCandidates/*   -> ICE candidates from the caller
//   rooms/{roomId}/calleeCandidates/*   -> ICE candidates from the callee

const toPlain = ({ type, sdp }) => ({ type, sdp });

// Writes every ICE candidate we find into the given sub-collection
const shareCandidates = (pc, roomRef, name) => {
  pc.onicecandidate = (event) => {
    if (event.candidate) addDoc(collection(roomRef, name), event.candidate.toJSON());
  };
};

// Applies every ICE candidate the other side writes (existing ones included)
const listenForCandidates = (pc, roomRef, name) =>
  onSnapshot(collection(roomRef, name), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') pc.addIceCandidate(change.doc.data()).catch(console.error);
    });
  });

// Caller: publishes the offer and waits for an answer. Returns the room ID to share.
export const createRoom = async (pc) => {
  const roomRef = doc(collection(db, 'rooms'));
  const listeners = [];

  shareCandidates(pc, roomRef, 'callerCandidates');
  await pc.setLocalDescription(); // creates the offer
  await setDoc(roomRef, { offer: toPlain(pc.localDescription) });

  const stopWaiting = onSnapshot(roomRef, async (snapshot) => {
    const answer = snapshot.data()?.answer;
    if (!answer) return;

    stopWaiting();
    await pc.setRemoteDescription(answer);
    listeners.push(listenForCandidates(pc, roomRef, 'calleeCandidates'));
  });
  listeners.push(stopWaiting);

  return { roomId: roomRef.id, stop: () => listeners.forEach((stop) => stop()) };
};

// Callee: reads the offer, publishes the answer. Returns a function that stops listening.
export const joinRoom = async (pc, roomId) => {
  const roomRef = doc(db, 'rooms', roomId);
  const room = await getDoc(roomRef);
  if (!room.exists()) throw new Error('Room not found');

  shareCandidates(pc, roomRef, 'calleeCandidates');
  await pc.setRemoteDescription(room.data().offer);
  const stopListening = listenForCandidates(pc, roomRef, 'callerCandidates');

  await pc.setLocalDescription(); // creates the answer
  await updateDoc(roomRef, { answer: toPlain(pc.localDescription) });

  return stopListening;
};
