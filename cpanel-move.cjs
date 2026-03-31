const https = require('https');
const querystring = require('querystring');

const unlinkDir = () => {
    // Delete the nested /api directory recursively
    const postData = querystring.stringify({
        cpanel_jsonapi_apiversion: 2,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'fileop',
        op: 'unlink',
        sourcefiles: 'api',
        doublequote: 1,
        basedir: 'public_html/WebMyDrive/demo/1'
    });

    const options = {
        hostname: 'test.webmydrive.com',
        port: 2083,
        path: '/json-api/cpanel',
        method: 'POST',
        headers: {
            'Authorization': 'cpanel wmdtest:JOMCQE5VE9U4QXOZFSA6ZLA0DHPICHBD',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => console.log('Cleanup Result:', data));
    });

    req.write(postData);
    req.end();
};

unlinkDir();
