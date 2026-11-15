# WebRTC Video Call (Firebase signaling)

One-to-one video calls. Firestore stores the offer, answer and ICE candidates (signaling); the video itself goes peer-to-peer. There is no server to run.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. Project settings > Your apps > add a **Web app** and copy its config values.
3. Build > **Firestore Database** > Create database (start in test mode while developing).
4. In `client`, copy `.env.example` to `.env` and fill in the four values.

Test mode rules expire after 30 days. Before that, publish rules that limit access to the `rooms` collection:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

These are as open as test mode (anyone with the room ID can read and write) but never expire, which is fine for a prototype. Add Firebase Anonymous Auth and check `request.auth != null` before real use.

## Run

```bash
cd client
npm install
npm start
```

Open http://localhost:3000 in two tabs. In the first, press **Create room** and copy the room ID. In the second, paste it and press **Join room**.

Camera access needs `localhost` or HTTPS. Only a STUN server is configured, so calls across strict NATs would need a TURN server. Finished rooms stay in Firestore until you delete them.
