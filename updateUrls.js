const fs = require('fs');
const path = require('path');

// Function to update dates in the URL
function updateDatesInUrl(url) {
    const today = new Date();
    const checkinDate = new Date(today);
    const checkoutDate = new Date(today);

    checkinDate.setDate(today.getDate() + 1);
    checkoutDate.setDate(today.getDate() + 2);

    const formattedCheckin = checkinDate.toISOString().split('T')[0];
    const formattedCheckout = checkoutDate.toISOString().split('T')[0];

    return url.replace(/checkin=\d{4}-\d{2}-\d{2};checkout=\d{4}-\d{2}-\d{2}/, `checkin=${formattedCheckin};checkout=${formattedCheckout}`);
}

// Read the list.txt file and update the URLs
function processUrls(filePath) {
    const urls = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);

    const updatedUrls = urls.map(updateDatesInUrl);

    // Print updated URLs to console
    updatedUrls.forEach(url => console.log(url));

    // Print the count of URLs
    console.log(`Total number of URLs: ${urls.length}`);
}

// Path to the list.txt file
const filePath = path.join(__dirname, 'list.txt');

// Process the URLs in the file
processUrls(filePath);
