const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateQueueTicket(queueNumber, name, date, service) {
    const width = 400;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background color
    ctx.fillStyle = '#31343C';
    ctx.fillRect(0, 0, width, height);

    // Queue Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Montserrat';
    ctx.fillText(`Nomor Antrian: ${queueNumber}`, 50, 50);

    // Name
    ctx.font = '20px Montserrat';
    ctx.fillText(`Nama: ${name}`, 50, 100);

    // Date
    ctx.fillText(`Tanggal: ${date}`, 50, 130);

    // Service
    ctx.fillText(`Layanan: ${service}`, 50, 160);

    // Simpan gambar ke folder public/photos
    const fileName = `queue_ticket_${queueNumber}.png`;
    const filePath = path.join(__dirname, 'public', 'photos', fileName);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    return filePath; // Kembalikan path gambar
}
