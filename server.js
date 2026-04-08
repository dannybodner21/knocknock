
const cors = require('cors');
const twilio = require('twilio');

if (!process.env.TWILIO_ACCOUNT_SID) {
    console.error("Missing TWILIO_ACCOUNT_SID");
  }

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
  
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.post('/register-device', async (req, res) => {
    try {
      const { userId, fcmToken } = req.body;
  
      if (!userId || !fcmToken) {
        return res.status(400).send('Missing fields');
      }
  
      await db.collection('users').doc(userId).set({
        fcmToken
      }, { merge: true });
  
      console.log('Saved FCM token for', userId);
  
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.status(500).send('error');
    }
  });

app.post('/handle-input', (req, res) => {
  console.log('BODY:', req.body);

  const digit = req.body.Digits;
  let response = '';

  if (digit === '1') {
    response = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
    <Say voice="alice">Leave a message after the beep. Press pound when you are done.</Say>
    <Record maxLength="30" finishOnKey="#" action="https://knockknock-server.onrender.com/recording-complete" method="POST" />
    </Response>`;

  } else if (digit === '2') {

    response = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
    <Say voice="alice">
        To request access, please visit knock knock go away dot web flow dot I O forward slash request.
    </Say>
    <Pause length="1"/>
    <Say>
        That is knock knock go away dot web flow dot I O forward slash request.
    </Say>
    <Hangup/>
    </Response>`;

    // const callerNumber = req.body.From;

    // send SMS
    // client.messages.create({
    //     body: 'Request access here: https://knockknock-server.onrender.com/request',
    //     from: TWILIO_NUMBER,
    //     to: callerNumber
    // }).then(() => {
    //     console.log('SMS sent to', callerNumber);
    // }).catch(err => {
    //     console.error('SMS error:', err);
    // });

    // response = `<?xml version="1.0" encoding="UTF-8"?>
    // <Response>
    // <Say voice="alice">A request link has been sent to your phone. Goodbye.</Say>
    // <Hangup/>
    // </Response>`;

  } else {
    response = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
    <Say voice="alice">Invalid input. Goodbye.</Say>
    <Hangup/>
    </Response>`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(response);
});

app.post('/recording-complete', (req, res) => {
  console.log('RECORDING:', req.body);

  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`);
});

app.get('/request', (req, res) => {
    res.send(`
      <html>
        <body style="background:black;color:lime;font-family:monospace;">
          <h2>KnockKnock Request</h2>
          <form method="POST" action="/submit-request">
            <input name="name" placeholder="Your name" /><br/><br/>
            <input name="message" placeholder="Reason for calling" /><br/><br/>
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `);
});

app.post('/submit-request', async (req, res) => {
    try {
      const name = req.body.name;
      const message = req.body.message;
      const fromNumber = req.body.fromNumber;
      const toNumber = req.body.toNumber;
  
      const snapshot = await db.collection('users')
        .where('phoneNumber', '==', toNumber)
        .limit(1)
        .get();
  
      if (snapshot.empty) {
        console.log('No user found for number:', toNumber);
  
        return res.status(200).send(`
          <html>
            <body style="background:black;color:lime;font-family:monospace;">
              <h2>Request sent</h2>
            </body>
          </html>
        `);
      }
  
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;
      const fcmToken = userData.fcmToken;
  
      await db.collection('requests').add({
        toUserId: userId,
        toNumber,
        fromNumber,
        name,
        message,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  
      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: 'KnockKnock',
            body: `${name} requested access`
          },
          data: {
            type: 'access_request',
            fromNumber: fromNumber || '',
            name: name || '',
            message: message || ''
          }
        });
      } else {
        console.log('No FCM token for user:', userId);
      }
  
      res.status(200).send(`
        <html>
          <body style="background:black;color:lime;font-family:monospace;">
            <h2>Request sent</h2>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('submit-request error:', err);
      res.status(500).send('error');
    }
});

app.post('/voice', async (req, res) => {
    const fromNumber = req.body.From;
    const toNumber = req.body.To;

    const callSid = req.body.CallSid;
    console.log("CALL SID:", callSid);

    await db.collection('activeCalls').doc(callSid).set({
        toNumber,
        fromNumber,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  
    console.log("Incoming call from:", fromNumber, "to:", toNumber);

    console.log("VOICE DEBUG → From:", req.body.From, "To:", req.body.To);
  
    const allowed = await isNumberAllowed(toNumber, fromNumber);
  
    let response;
  
    if (allowed) {
      console.log("ALLOWING CALL → sending push");
  
      const snapshot = await db.collection('users')
        .where('phoneNumber', '==', toNumber)
        .limit(1)
        .get();
  
      if (!snapshot.empty) {
        const user = snapshot.docs[0].data();
        const fcmToken = user.fcmToken;
  
        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "Incoming Call",
              body: `${fromNumber} is calling`
            },
            data: {
              type: "incoming_call",
              fromNumber: fromNumber || ""
            }
          });
        } else {
          console.log("No FCM token for user");
        }
      } else {
        console.log("No user found for number:", toNumber);
      }
  
      // keep call alive briefly
      response = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Pause length="10"/>
        </Response>`;
  
    } else {
      console.log("BLOCKING → show menu");
  
      response = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Gather numDigits="1" action="https://knockknock-server.onrender.com/handle-input" method="POST">
            <Say voice="alice">
                This number does not accept calls from unknown callers.
            </Say>
            <Pause length="1"/>
            <Say>
                Press 1 to leave a voicemail.
                Press 2 to request permission to call.
            </Say>
            </Gather>
        </Response>`;
    }
  
    res.set('Content-Type', 'text/xml');
    res.send(response);
});

async function isNumberAllowed(toNumber, fromNumber) {
    console.log("CHECK → toNumber:", toNumber, "fromNumber:", fromNumber);
  
    const snapshot = await db.collection('users')
      .where('phoneNumber', '==', toNumber)
      .limit(1)
      .get();
  
    console.log("SNAPSHOT SIZE:", snapshot.size);
  
    if (!snapshot.empty) {
      const user = snapshot.docs[0].data();
      console.log("USER DATA:", user);
  
      const whitelist = user.whitelist || [];
      console.log("WHITELIST:", whitelist);
  
      return whitelist.includes(fromNumber);
    }
  
    return false;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});