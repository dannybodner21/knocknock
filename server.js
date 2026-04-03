const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Twilio will POST here after user presses a button
app.post('/handle-input', (req, res) => {
    const digit = req.body.Digits;

    console.log("Pressed:", digit);

    let response = '';

    if (digit === '1') {
        response = `
<Response>
    <Say>Leave a message after the beep.</Say>
    <Record maxLength="30" />
</Response>
`;
    } else if (digit === '2') {
        response = `
<Response>
    <Say>A request link has been sent. Goodbye.</Say>
</Response>
`;
    } else {
        response = `
<Response>
    <Say>Invalid input. Goodbye.</Say>
</Response>
`;
    }

    res.type('text/xml');
    res.send(response);
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});