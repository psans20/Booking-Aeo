const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async message => {
    if (message.content.startsWith('$Check')) {
        // Read and update URLs from list.txt
        const filePath = path.join(__dirname, 'list.txt');
        const urls = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
        const updatedUrls = urls.map(updateDatesAndPeopleInUrl);

        const results = [];
        // Process each updated URL
        for (const url of updatedUrls) {
            try {
                const data = await visitAndScrape(url);
                if (data) {
                    const embed = new EmbedBuilder()
                        .setTitle(data.title)
                        .setImage(data.image)
                        .addFields(
                            { name: 'Price', value: data.price, inline: true },
                            { name: 'Room Size', value: data.roomSize, inline: true }
                        )
                        .setURL(url)
                        .setColor('#0099ff');
                    
                    results.push(embed);
                } else {
                    await message.channel.send(`Failed to fetch data for URL: ${url}`);
                }
            } catch (error) {
                console.error(`Failed to fetch data for URL: ${url}`, error);
                await message.channel.send(`Failed to fetch data for URL: ${url}`);
            }
        }

        if (results.length > 0) {
            await message.author.send({ embeds: results });
        }
        await message.channel.send('Details have been sent to your DM.');
    }
});

function updateDatesAndPeopleInUrl(url) {
    const today = new Date();
    const checkinDate = new Date(today);
    const checkoutDate = new Date(today);

    checkinDate.setDate(today.getDate() + 1);
    checkoutDate.setDate(today.getDate() + 2);

    const formattedCheckin = checkinDate.toISOString().split('T')[0];
    const formattedCheckout = checkoutDate.toISOString().split('T')[0];

    // Update checkin and checkout dates
    if (url.includes('checkin=')) {
        url = url.replace(/checkin=\d{4}-\d{2}-\d{2}/, `checkin=${formattedCheckin}`);
    } else {
        url += `&checkin=${formattedCheckin}`;
    }

    if (url.includes('checkout=')) {
        url = url.replace(/checkout=\d{4}-\d{2}-\d{2}/, `checkout=${formattedCheckout}`);
    } else {
        url += `&checkout=${formattedCheckout}`;
    }

    // Ensure adults=1 and children=0
    if (url.includes('adults=')) {
        url = url.replace(/adults=\d+/, 'adults=1');
    } else {
        url += '&adults=1';
    }

    if (url.includes('children=')) {
        url = url.replace(/children=\d+/, 'children=0');
    } else {
        url += '&children=0';
    }

    return url;
}

async function visitAndScrape(url) {
    const browser = await puppeteer.launch({ headless: true, args: ['--start-maximized'] });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await delay(1000); // wait for 1 second

        // Log initial URL visit
        console.log(`Visited URL: ${url}`);

        await page.waitForSelector('[data-testid="header-currency-picker-trigger"]', { visible: true, timeout: 20000 });
        const currencyButton = await page.$('[data-testid="header-currency-picker-trigger"]');
        if (currencyButton) {
            await currencyButton.click();
            await page.waitForSelector('[data-testid="selection-item"] span', { visible: true, timeout: 10000 });
            await delay(1000); // wait for 1 second

            const currencyOptionSelected = await page.evaluate(() => {
                const elements = document.querySelectorAll('[data-testid="selection-item"] span');
                const usDollarElement = Array.from(elements).find(el => el.innerText.includes('USD'));
                if (usDollarElement) {
                    usDollarElement.click();
                    return true;
                }
                return false;
            });

            if (!currencyOptionSelected) {
                console.error('USD currency option not found');
            } else {
                console.log('USD currency option selected');
            }
        } else {
            console.error('Currency button not found');
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Log post currency change URL visit
        console.log(`Visited URL after currency change: ${url}`);

        const data = await page.evaluate(() => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const imageElement = document.querySelectorAll('.active-image img')[0];
                    const priceElement = (() => {
                        const divs = document.querySelectorAll('div');
                        for (let div of divs) {
                            if (div.innerText.startsWith('US$')) {
                                return div.innerText;
                            }
                        }
                        return null;
                    })();
                    
                    const titleElement = document.querySelector('.pp-header__title');
                    const roomSizeElement = document.querySelector('[data-name-en="room size"] .bui-badge');

                    const image = imageElement ? imageElement.src : null;
                    const price = priceElement ? priceElement.innerText : null;
                    const title = titleElement ? titleElement.innerText.trim() : null;
                    const roomSize = roomSizeElement ? roomSizeElement.innerText : null;

                    resolve({ image, price, title, roomSize, imageFound: !!image, priceFound: !!price, titleFound: !!title, roomSizeFound: !!roomSize });
                }, 1000);
            });
        });

        await browser.close();

        if (!data.imageFound || !data.priceFound || !data.titleFound || !data.roomSizeFound) {
            console.log('Missing elements: ', {
                imageFound: data.imageFound,
                priceFound: data.priceFound,
                titleFound: data.titleFound,
                roomSizeFound: data.roomSizeFound
            });
            throw new Error('Required elements not found');
        }

        return data;
    } catch (error) {
        console.error(`Error while processing URL: ${url}`, error);
        await browser.close();
        return null;
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

client.login(process.env.BOT_TOKEN);
