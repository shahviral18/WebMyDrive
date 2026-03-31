const https = require('https');
const querystring = require('querystring');

const listFiles = (dir) => {
    const postData = querystring.stringify({
        cpanel_jsonapi_apiversion: 2,
        cpanel_jsonapi_module: 'Fileman',
        cpanel_jsonapi_func: 'listfiles',
        dir: dir
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
        res.on('end', () => {
            const parsed = JSON.parse(data);
            console.log("DIR:", dir);
            if(parsed.cpanelresult && parsed.cpanelresult.data) {
                console.log(parsed.cpanelresult.data.map(f => f.type === 'dir' ? `[DIR] ${f.file}` : f.file).join(', '));
            } else {
                console.log(parsed.cpanelresult && parsed.cpanelresult.error ? parsed.cpanelresult.error : parsed);
            }
        });
    });

    req.write(postData);
    req.end();
};

listFiles('public_html');
listFiles('public_html/WebMyDrive');
