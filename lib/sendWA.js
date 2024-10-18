const axios = require('axios');

function generateTicketUrl(queueNumber, name, date, service) {
    return `https://struk.notifku.my.id/generate-ticket?queueNumber=${queueNumber}&name=${encodeURIComponent(name)}&date=${date}&service=${service}`;
}

async function sendWhatsAppMessage(number, to, imageUrl, message) {
    const sendUrl = `https://notifku.my.id/send?number=${number}&to=${to}&type=image&img=${encodeURIComponent(imageUrl)}&message=${encodeURIComponent(message)}`;
    try {
        const response = await axios.get(sendUrl);
        console.log('Message sent:', response.data);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
}

async function sendText(to, message) {
    const sendUrl = `https://notifku.my.id/send?number=55555&to=${to}&type=chat&message=${encodeURIComponent(message)}`;
    try {
        const response = await axios.get(sendUrl);
        console.log(response.data);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
}


// sendText('6285255646434@s.whatsapp.net', 'halo')

module.exports = {
    generateTicketUrl,
    sendWhatsAppMessage,
    sendText
};
