
const twilio = require('twilio');

if (!process.env.TWILIO_ACCOUNT_SID) {
    console.error("Missing TWILIO_ACCOUNT_SID");
  }

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
  
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;

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
    const callerNumber = req.body.From;

    // send SMS
    client.messages.create({
        body: 'Request access here: https://your-app-link.com/request',
        from: TWILIO_NUMBER,
        to: callerNumber
    }).then(() => {
        console.log('SMS sent to', callerNumber);
    }).catch(err => {
        console.error('SMS error:', err);
    });

    response = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
    <Say voice="alice">A request link has been sent to your phone. Goodbye.</Say>
    <Hangup/>
    </Response>`;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});