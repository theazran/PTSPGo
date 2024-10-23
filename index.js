const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const nodeWebcam = require('node-webcam');
const path = require('path');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const googleTTS = require('@sefinek/google-tts-api');
const fs = require("fs")
const axios = require("axios")
const { sendText, generateTicketUrl, sendWhatsAppMessage } = require('./lib/sendWA')

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'queue_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Konekmi ke databes...');
});

function emitQueueUpdate(queue) {
    io.emit('Updet', queue);
}

const laptopCameraOptions = {
    width: 640,
    height: 480,
    quality: 50,
    frames: 60,
    delay: 0,
    saveShots: true,
    output: "jpeg",
    //device: 0,
    device: '1',
    callbackReturn: "location",
    verbose: false
};

const usbCameraOptions = {
    width: 640,
    height: 480,
    quality: 50,
    frames: 60,
    delay: 0,
    saveShots: true,
    output: "jpeg",
    device: '1',
    //device: false,
    callbackReturn: "location",
    verbose: false
};

const getNextQueueNumber = (callback) => {
    const today = new Date().toISOString().split('T')[0];
    db.query('SELECT MAX(queue_number) AS maxNumber FROM queue WHERE date = ?', [today], (err, results) => {
        if (err) return callback(err);
        const nextNumber = results[0].maxNumber ? results[0].maxNumber + 1 : 1;
        callback(null, nextNumber);
    });
};


app.get('/', (req, res) => {
    res.render('index');
});

app.get('/p', (req, res) => {
    res.render('print');
});


app.get('/tes', (req, res) => {
    const query = `
        SELECT * 
        FROM queue 
        WHERE status = 'waiting' AND DATE(created_at) = CURDATE() 
        ORDER BY created_at ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching queue data:', err);
            return res.status(500).send('Error fetching queue data');
        }

        const lastCalledQuery = `
    SELECT * 
    FROM queue 
    WHERE status = 'calling' AND DATE(created_at) = CURDATE() 
    ORDER BY updated_at DESC 
    LIMIT 1
`;

        db.query(lastCalledQuery, (err, lastCalledResults) => {
            if (err) {
                console.error('Error fetching last called queue data:', err);
                return res.status(500).send('Error fetching last called queue data');
            }
            const lastCalled = lastCalledResults[0] || null;

            const queueByService = {
                umum: [],
                hukum: [],
                pidana: [],
                perdata: [],
                informasi: []
            };

            results.forEach(row => {
                const serviceName = getServiceNameById(row.service_id);
                if (queueByService[serviceName]) {
                    queueByService[serviceName].push(row);
                }
            });
            Object.keys(queueByService).forEach(service => {
                if (queueByService[service].length > 1) {
                    queueByService[service] = [queueByService[service][0]];
                }
            });

            const lastCalledServiceName = lastCalled ? getServiceNameById(lastCalled.service_id) : null;
            console.log(lastCalled);
            res.render('tes', { queueByService, lastCalled, lastCalledServiceName });
        });
    });
});

app.get('/api/rss', async (req, res) => {
    try {
        const url = 'https://rss.pt-bengkulu.go.id/?mari';
        const response = await axios.get(url);

        const titleRegex = /<title>(.*?)<\/title>/g;
        const linkRegex = /<link>(.*?)<\/link>/g;

        let titles = [];
        let links = [];
        let match;

        while ((match = titleRegex.exec(response.data)) !== null) {
            let title = match[1];
            title = title.replace('Mahkamah Agung Berita | Index Berita MA', '').trim();

            if (title) {
                titles.push(`  ` + title + `  `);
            }
        }


        while ((match = linkRegex.exec(response.data)) !== null) {
            links.push(match[1]);
        }

        res.json({ titles, links });
    } catch (error) {
        console.error('Error fetching RSS feed:', error);
        res.status(500).json({ error: 'Failed to fetch RSS feed' });
    }
});

function emitRefresh() {
    io.emit('refreshPage');
}

const servicePrefix = {
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'D',
    5: 'E'
};

function getNextServiceQueueNumber(service, callback) {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT COUNT(*) AS count FROM queue WHERE service_id = ? AND date = ?`;
    db.query(query, [service, today], (err, results) => {
        if (err) {
            return callback(err);
        }

        const count = results[0].count;
        const nextNumber = count + 1;

        const prefix = servicePrefix[service] || 'A';

        const formattedNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
        callback(null, formattedNumber);
    });
}


app.get('/service-tujuan', (req, res) => {
    const query = `
        SELECT services.name AS service_name, layanan.layanan
        FROM layanan
        JOIN services ON layanan.service_id = services.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            res.status(500).json({ error: 'Failed to retrieve data from database' });
            return;
        }

        // Struktur data sesuai kebutuhan
        const data = results.reduce((acc, row) => {
            if (!acc[row.service_name]) {
                acc[row.service_name] = [];
            }
            acc[row.service_name].push(row.layanan);
            return acc;
        }, {});

        res.json(data);
    });
});

app.get('/get-max-waktu/:tujuan', (req, res) => {
    const tujuan = req.params.tujuan;

    // Query ke database untuk mendapatkan max_waktu_pelayanan berdasarkan tujuan
    const query = 'SELECT max_waktu_pelayanan FROM layanan WHERE layanan = ?';
    db.query(query, [tujuan], (err, results) => {
        if (err) {
            return res.status(500).send('Error getting max waktu pelayanan');
        }
        if (results.length > 0) {
            res.json({ max_waktu_pelayanan: results[0].max_waktu_pelayanan });
        } else {
            res.status(404).send('Tujuan tidak ditemukan');
        }
    });
});


app.post('/take-queue', (req, res) => {

    const { name, whatsapp, service } = req.body;
    const uniqueId = uuidv4();

    const facePhotoPath = `public/photos/photo-face-${uniqueId}.jpg`;
    const ktpPhotoPath = `public/photos/photo-ktp-${uniqueId}.jpg`;

    getNextServiceQueueNumber(service, (err, serviceQueueNumber) => {
        if (err) {
            console.error('Awwah, gagalki mendapatkan antrian:', err);
            return res.status(500).send('Awwah, gagalki mendapatkan antrian');
        }

        nodeWebcam.capture(facePhotoPath, laptopCameraOptions, (err, facePath) => {
            if (err) {
                console.error('Gagalki ambil foto:', err);
                return res.status(500).send('Gagalki ambil foto');
            }

            nodeWebcam.capture(ktpPhotoPath, usbCameraOptions, (err, ktpPath) => {
                if (err) {
                    console.error('Gagalki ambil gambar KTP:', err);
                    return res.status(500).send('Gagalki ambil gambar KTP');
                }

                const today = new Date().toISOString().split('T')[0];
                const query = `INSERT INTO queue (name, whatsapp, photo, ktp_photo, service_id, service_queue_number, date, status, tujuan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                const values = [name, whatsapp, `/photos/photo-face-${uniqueId}.jpg`, `/photos/photo-ktp-${uniqueId}.jpg`, service, serviceQueueNumber, today, 'waiting', ''];

                db.query(query, values, (err, result) => {
                    if (err) {
                        console.error('Tidak bisai tersimpan di databes:', err);
                        return res.status(500).send('Tidak bisai tersimpan di databes');
                    }

                    db.query('SELECT * FROM queue WHERE id = ?', [result.insertId], (selectErr, results) => {
                        if (selectErr) {
                            console.error('Gagalki na ambil datanya:', selectErr);
                            return res.status(500).send('Gagalki na ambil datanya');
                        }

                        const newQueue = results[0];
                        function waa(nomona) {
                            nomona = nomona.replace(/\D/g, '');
                            if (nomona.startsWith('0')) {
                                nomona = '62' + nomona.slice(1);
                            }

                            return nomona;
                        }

                        const message = `Halo kak ${newQueue.name}, Nomor antrian Anda adalah *${newQueue.service_queue_number}*.\nHarap sabar menunggu.\n\n\n\`Bantu Kami Mewujudkan Zona Integritas, Dengan Tidak Memberikan Imbalan Dalam Bentuk Apapun Atas Pelayanan Yang Kami Berikan.\``;
                        //sendMessage(newQueue.whatsapp, message);
                        const queueNumber = newQueue.service_queue_number;
                        const name = newQueue.name;
                        const date = today;
                        const service = getServiceNameById(newQueue.service_id).toUpperCase()
                        const to = waa(newQueue.whatsapp) + '@s.whatsapp.net';
                        const number = '555'; //pengirimnya ini ges
                        console.log(to)

                        const imageUrl = generateTicketUrl(queueNumber, name, date, service);
                        sendWhatsAppMessage(number, to, imageUrl, message);

                        axios.get(`http://192.168.5.88/antrian/pengunjung/pages/beranda/apiPrint.php`, {
                            params: {
                                nama: name,
                                layanan: service,
                                no_antrian: queueNumber
                            }
                        })
                            .then(response => {
                                console.log('Antrian berhasil dicetak:', response.data);
                            })
                            .catch(error => {
                                console.error('Gagalki mengirim ke API Print:', error);
                            });

                        io.emit('newQueue', newQueue);

                        emitRefresh();
                        res.redirect('/');
                    });
                });
            });
        });
    });
});

app.get('/get-queue-data', (req, res) => {
    const { queueNumber } = req.query;

    if (!queueNumber) {
        return res.status(400).json({ success: false, message: 'Nomor antrian diperlukan' });
    }

    const query = 'SELECT name, service_id, photo FROM queue WHERE queue_number = ?';
    db.query(query, [queueNumber], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
        }

        if (results.length > 0) {
            const servicePrefix = {
                1: 'Umum',
                2: 'Hukum',
                3: 'Pidana',
                4: 'Perdata',
                5: 'Informasi'
            };

            const data = results[0];
            const service = servicePrefix[data.service_id] || 'Layanan tidak diketahui';

            return res.json({
                success: true,
                data: {
                    name: data.name,
                    service: service,
                    photo: data.photo // Asumsikan ini URL path ke gambar foto
                }
            });
        } else {
            return res.json({ success: false, message: 'Nomor antrian tidak ditemukan' });
        }
    });
});


app.put('/update-queue/:id', (req, res) => {
    const { id } = req.params;
    const { name, whatsapp, tujuan } = req.body;

    const query = 'UPDATE queue SET name = ?, whatsapp = ?, tujuan = ? WHERE id = ?';
    db.query(query, [name, whatsapp, tujuan, id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ status: 'success' });
    });
});

app.get('/officer/:service', async (req, res) => {
    const serviceIdMap = {
        umum: 1,
        hukum: 2,
        pidana: 3,
        perdata: 4,
        informasi: 5
    };

    const serviceName = req.params.service;
    const serviceId = serviceIdMap[serviceName];

    if (!serviceId) {
        return res.status(404).send('Tidak ditemukan layanannya njir');
    }

    try {
        const stats = await getServiceStats(serviceId);
        res.render('officer', { serviceId, stats });
    } catch (error) {
        console.error('Error rendering officer page:', error);
        res.status(500).send('Errorki servernya ces!');
    }
});


app.get('/get-queue/:serviceId', (req, res) => {
    const serviceId = req.params.serviceId;
    const query = 'SELECT * FROM queue WHERE service_id = ? ORDER BY created_at ASC';

    db.query(query, [serviceId], (err, results) => {
        if (err) {
            console.error('Error fetching queue:', err);
            res.status(500).json({ error: 'Failed to fetch queue' });
        } else {
            res.json(results);
        }
    });
});

app.post('/finish-queue/:id', (req, res) => {
    const queueId = req.params.id;

    db.query('SELECT * FROM queue WHERE id = ?', [queueId], (err, results) => {
        if (err) {
            console.error('Error fetching queue:', err);
            return res.status(500).json({ error: 'Failed to fetch queue' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Queue not found' });
        }

        const queue = results[0];
        console.log('Current queue status:', queue.status);

        let newStatus;
        switch (queue.status) {
            case 'waiting':
                newStatus = 'calling';
                break;
            case 'calling':
                newStatus = 'served';
                break;
            case 'served':
                return res.json({ message: 'Queue already served', status: 'served' });
            default:

                newStatus = 'served';
                console.log('Unexpected status, setting to served');
        }

        db.query('UPDATE queue SET status = ? WHERE id = ?', [newStatus, queueId], (updateErr) => {
            if (updateErr) {
                console.error('Error updating queue status:', updateErr);
                return res.status(500).json({ error: 'Failed to update queue status' });
            }

            console.log(`Updated queue ${queueId} status to ${newStatus}`);
            res.json({ message: 'Queue status updated successfully', status: newStatus });
        });
    });
});

app.get('/get-all-queues', (req, res) => {
    const query = `
        SELECT q.*, 
               (SELECT COUNT(*) FROM queue WHERE service_id = q.service_id AND status = 'waiting' AND id <= q.id) as position
        FROM queue q
        WHERE q.status IN ('waiting', 'calling')
        ORDER BY q.service_id, q.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching queues:', err);
            return res.status(500).json({ error: 'Failed to fetch queues' });
        }

        const queuesByService = {};
        const lastCalled = {};
        const nextQueue = {};

        results.forEach(queue => {
            if (queue.status === 'calling') {
                lastCalled[queue.service_id] = queue;
            } else if (queue.status === 'waiting') {
                if (!queuesByService[queue.service_id]) {
                    queuesByService[queue.service_id] = [];
                }
                queuesByService[queue.service_id].push(queue);

                if (!nextQueue[queue.service_id]) {
                    nextQueue[queue.service_id] = queue;
                }
            }
        });

        const response = {
            lastCalled: lastCalled,
            queues: queuesByService,
            nextQueue: nextQueue
        };

        res.json(response);
    });
});

app.post('/call-queue/:serviceId', (req, res) => {
    const queueId = req.body.id;
    const serviceId = req.params.serviceId;
    db.query('SELECT * FROM queue WHERE id = ?', [queueId], (err, results) => {
        if (err) {
            console.error('Error fetching queue:', err);
            return res.status(500).json({ error: 'Failed to fetch queue' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Queue not found' });
        }

        const queue = results[0];

        const query = 'UPDATE queue SET status = ?, last_called = CURRENT_TIMESTAMP WHERE id = ?';
        db.query(query, ['calling', queueId], (updateErr) => {
            if (updateErr) {
                console.error('Error updating queue status:', updateErr);
                return res.status(500).json({ error: 'Failed to update queue status' });
            }

            console.log(`Updated queue ${serviceId} status to calling`);
            sendText(`${queue.whatsapp}@s.whatsapp.net`, `Halo kak, Silahkan menuju ke loket *${getServiceNameById(queue.service_id).toUpperCase()}*, Terima kasih!`)

            res.json({
                message: 'Queue called successfully',
                status: 'calling',
                queue_number: queue.queue_number,
                name: queue.name,
                service_id: serviceId,
                service_queue_number: queue.service_queue_number
            });

            io.emit('updateQueue', { queueId });

            io.emit('queueUpdate', {
                id: queueId,
                status: 'calling',
                service_id: serviceId,
                serviceName: getServiceNameById(queue.service_id),
                queue_number: queue.queue_number,
                name: queue.name,
                whatsapp: queue.whatsapp,
                photo: queue.photo,
                ktp_photo: queue.ktp_photo,
                service_queue_number: queue.service_queue_number
            });
        });
    });
});

function getServiceNameById(id) {
    switch (id) {
        case 1: return 'umum';
        case 2: return 'hukum';
        case 3: return 'pidana';
        case 4: return 'perdata';
        case 5: return 'informasi';
        default: return 'unknown';
    }
}

function getServiceIdByName(name) {
    switch (name) {
        case 'umum': return 1;
        case 'hukum': return 2;
        case 'pidana': return 3;
        case 'perdata': return 4;
        case 'informasi': return 5;
        default: return -1;
    }
}

app.get('/display', (req, res) => {
    const query = `
        SELECT * 
        FROM queue 
        WHERE status = 'waiting' AND DATE(created_at) = CURDATE() 
        ORDER BY created_at ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching queue data:', err);
            return res.status(500).send('Error fetching queue data');
        }

        const lastCalledQuery = `
    SELECT * 
    FROM queue 
    WHERE status = 'calling' AND DATE(created_at) = CURDATE() 
    ORDER BY updated_at DESC 
    LIMIT 1
`;

        db.query(lastCalledQuery, (err, lastCalledResults) => {
            if (err) {
                console.error('Error fetching last called queue data:', err);
                return res.status(500).send('Error fetching last called queue data');
            }
            const lastCalled = lastCalledResults[0] || null;

            const queueByService = {
                umum: [],
                hukum: [],
                pidana: [],
                perdata: [],
                informasi: []
            };

            results.forEach(row => {
                const serviceName = getServiceNameById(row.service_id);
                if (queueByService[serviceName]) {
                    queueByService[serviceName].push(row);
                }
            });
            Object.keys(queueByService).forEach(service => {
                if (queueByService[service].length > 1) {
                    queueByService[service] = [queueByService[service][0]]; // Ambil yang pertama
                }
            });

            const lastCalledServiceName = lastCalled ? getServiceNameById(lastCalled.service_id) : null;
            console.log(lastCalled);
            res.render('display', { queueByService, lastCalled, lastCalledServiceName });
        });
    });
});

function getServiceNameById(id) {
    switch (id) {
        case 1: return 'umum';
        case 2: return 'hukum';
        case 3: return 'pidana';
        case 4: return 'perdata';
        case 5: return 'informasi';
        default: return 'unknown';
    }
}



app.get('/tts/:text', async (req, res) => {
    const text = req.params.text;
    try {
        const audioBase64 = await googleTTS.getAudioBase64(text, {
            lang: 'id',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const filePath = path.join(__dirname, 'public', 'audio', 'announcement.mp3');
        fs.writeFileSync(filePath, audioBuffer);

        res.sendFile(filePath);
    } catch (error) {
        console.error('Error generating audio:', error);
        res.status(500).send('Error generating audio');
    }
});

app.post('/call-again/:id', (req, res) => {
    const queueId = parseInt(req.params.id, 10);

    db.query('UPDATE queue SET status = "waiting" WHERE id = ?', [queueId], (err) => {
        if (err) {
            console.error('Error updating queue status:', err);
            return res.status(500).send('Error updating queue status');
        }

        io.emit('queueUpdate');
        res.redirect(`/officer/${serviceName}`);
    });
});

app.post('/mark-served', (req, res) => {
    const { id } = req.body;
    db.query('UPDATE queue SET status = "served" WHERE id = ?', [id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Failed to mark as served' });
        }
        res.json({ success: true });
    });
});

const mys = require('mysql2/promise');

async function getServiceStats(serviceId) {
    try {
        const connection = await mys.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'queue_db'
        });

        const today = new Date().toISOString().split('T')[0]; // Hanya data hari ini

        const [rows] = await connection.execute(`
            SELECT 
                name,
                last_called,
                updated_at,
                photo,
                service_id
            FROM queue
            WHERE service_id = ? AND DATE(created_at) = ? AND status = 'served'
        `, [serviceId, today]);

        const serviceStats = rows.map(row => {
            const lastCalled = new Date(row.last_called);
            const updatedAt = new Date(row.updated_at);
            const serviceTime = Math.floor((updatedAt - lastCalled) / 60000); // Hitung dalam menit

            return {
                name: row.name,
                average_time: serviceTime,
                photo: row.photo,
                layanan: row.service_id
            };
        });

        return serviceStats;
    } catch (error) {
        console.error('Awwah ada eror::', error);
        throw error;
    }
}

app.get('/api/service-stats/:service', async (req, res) => {
    console.log('PTSP:', req.params.service);

    const serviceIdMap = {
        umum: 1,
        hukum: 2,
        pidana: 3,
        perdata: 4,
        informasi: 5
    };

    const serviceName = req.params.service;
    const serviceId = serviceIdMap[serviceName];

    if (!serviceId) {
        return res.status(404).send('Tidak ditemukan layanannya njir');
    }

    try {
        const stats = await getServiceStats(serviceId);
        res.send({ serviceId, stats });
    } catch (error) {
        console.error('Awwah ada eror::', error);
        res.status(500).send('Errorki servernya ces!');
    }
});


const server = app.listen(3000, () => {
    console.log('Berjalanmi di port 3000');
});

// const io = socketIO(server);

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
io.on('connection', (socket) => {

    console.log('Terkoneksi ges...');

    socket.on('callQueue', (queue) => {
        console.log('Nda tau:', queue);
        io.emit('updateAntrian', queue);

        const announcementText = `Nomor antrian ${queue.queue_number} silahkan ke loket ${getServiceNameById(queue.service_id)}`;
        googleTTS.getAudioBase64(announcementText, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        })
            .then((audioBase64) => {
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                const filePath = path.join(__dirname, 'public', 'audio', 'announcement.mp3');
                fs.writeFileSync(filePath, audioBuffer);

                io.emit('playAudio', '/audio/announcement.mp3');
            })
            .catch((error) => {
                console.error('Error generating audio:', error);
            });
    });
});
