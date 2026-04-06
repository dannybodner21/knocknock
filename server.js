
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
app.use(bodyParser.urlencoded({ extended: false }));

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
  
      await db.collection('requests').add({
        toUserId: 'REPLACE_WITH_YOUR_USER_ID',
        fromNumber: 'unknown',
        name,
        message,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  
      res.send(`
        <html>
          <body style="background:black;color:lime;font-family:monospace;">
            <h2>Request sent ✅</h2>
          </body>
        </html>
      `);
    } catch (err) {
      console.error(err);
      res.status(500).send('error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});